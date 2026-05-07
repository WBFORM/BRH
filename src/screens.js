import { BOARD_SIZE, gameState, isCellSelected, getMemeCost, canAffordMeme, formatNumber, DAILY_MULTIPLIERS, getBoostStatus, getProgressData, getInvasionRemaining, getHappyHourStatus, BOSS_FRAGMENTS_NEEDED, getWeekId, getOfflineUpgradeCost, getBoostUpgradeCost, getOfflineMultiplier, getBoostDuration } from './game.js';
import { memeData, getMemeByLevel } from './data.js';
import { bossData, getBossDataByWeek } from './bossData.js';
import { isMuted, getBGMVolume } from './audio.js';
import { t, getLang, getMemeDescriptionEn, getBossDescriptionEn } from './lang.js';

function renderMenuScreen() {
  const hh = getHappyHourStatus();
  let hhHTML = '';
  if (hh.active) {
    hhHTML = '<div class="menu-hh"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt="">' + t('hhActive') + '</div>';
  } else if (hh.text) {
    hhHTML = '<div class="menu-hh"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt="">' + t('hhPending') + ' ' + hh.text + '</div>';
  } else if (hh.completed) {
    hhHTML = '<div class="menu-hh menu-hh-done"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt="">' + t('hhDone') + '</div>';
  }

  return `
    <div class="screen screen-menu">
      <img class="menu-logo" src="assets/bg/logo.png" alt="${t('gameTitle')}">
      ${hhHTML}
      <div class="menu-buttons">
        <button class="btn btn-start" data-action="start">${t('play')}</button>
        <button class="btn btn-collection" data-action="collection"><img class="icon-inline" src="assets/icons/icon-collection.png" alt="">${t('collection')}</button>
        <button class="btn btn-settings" data-action="settings"><img class="icon-inline" src="assets/icons/icon-settings.png" alt="">${t('settings')}</button>
        <button class="btn btn-upgrades" data-action="upgrades"><img class="icon-inline" src="assets/icons/icon-boost.png" alt="">${t('upgrades')}</button>
        <button class="btn btn-guide" data-action="guide">${t('howToPlay')}</button>
      </div>
    </div>
  `;
}

function renderGameScreen() {
  const boss = getBossDataByWeek(1);
  let boardHTML = '';
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!gameState.board[row]) continue;
    for (let col = 0; col < BOARD_SIZE; col++) {
      const level = gameState.board[row][col];
      const selected = isCellSelected(row, col) ? ' cell-selected' : '';
      if (level !== null) {
        if (level < 0) {
          const imgSrc = boss ? 'assets/bosses/' + boss.image : '';
          boardHTML += `<div class="cell cell-filled cell-boss${selected}" data-cell-row="${row}" data-cell-col="${col}"><img src="${imgSrc}" alt="Boss"></div>`;
        } else {
          const meme = getMemeByLevel(level);
          const imgSrc = meme ? 'assets/memes/' + meme.image : '';
          boardHTML += `<div class="cell cell-filled${selected}" data-cell-row="${row}" data-cell-col="${col}"><img src="${imgSrc}" alt="M${level}"></div>`;
        }
      } else {
        boardHTML += `<div class="cell${selected}" data-cell-row="${row}" data-cell-col="${col}">—</div>`;
      }
    }
  }

  const boostStatus = getBoostStatus();
  let boostBtnClass = 'btn btn-boost';
  let boostBtnText = '×2';
  let boostBtnDisabled = '';
  if (boostStatus.state === 'active') {
    boostBtnClass += ' btn-boost-active';
    boostBtnText = '×2 ' + boostStatus.remainingSec + 's';
    boostBtnDisabled = ' btn-disabled';
  } else if (boostStatus.state === 'cooldown') {
    boostBtnClass += ' btn-boost-ad';
    const mins = Math.floor(boostStatus.remainingSec / 60);
    const secs = boostStatus.remainingSec % 60;
    boostBtnText = mins + ':' + String(secs).padStart(2, '0') + ' +🎬';
    boostBtnDisabled = '';
  }

  return `
    <div class="screen screen-game">
      <div class="top-bar">
        <span class="resource"><img class="icon-inline" src="assets/icons/icon-pasta.png" alt="">${t('pasta')}: <strong>${formatNumber(gameState.coins)}</strong> <button class="btn-pasta-ad-inline" data-action="watchAdPasta">▶️</button></span>
        <span class="resource"><img class="icon-inline" src="assets/icons/icon-income.png" alt="">${t('incomePerSec')}: <strong>${formatNumber(gameState.incomePerSecond)}</strong></span>
      </div>
      <div class="invasion-bar">
        <span class="invasion-timer"><img class="icon-emoji" src="assets/icons/icon-invasion.png" alt="">${getInvasionRemaining().formatted}</span>
        ${(() => { const hh = getHappyHourStatus(); if (hh.active) return '<span class="invasion-sep">|</span><span class="invasion-timer hh-active">' + hh.text + '</span>'; if (hh.text) return '<span class="invasion-sep">|</span><span class="invasion-timer hh-pending"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + hh.text + '</span>'; if (hh.completed) return '<span class="invasion-sep">|</span><span class="invasion-timer hh-done"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + t('hhDoneShort') + '</span>'; return ''; })()}
        <button class="invasion-info-btn" data-action="invasionInfo">?</button>
      </div>
      <div class="board-container">
        <div class="board${gameState.boostActive ? ' board-boost' : ''}${gameState.happyHourActive ? ' board-boost-hh' : ''}">${boardHTML}</div>
      </div>
      <div class="progress-bar">${renderProgressBarHTML()}</div>
      <div class="bottom-bar">
        <button class="${boostBtnClass}${boostBtnDisabled}" data-action="${boostStatus.state === 'cooldown' ? 'watchAdBoost' : 'boost'}">${boostBtnText}</button>
        <button class="btn btn-buy${canAffordMeme() ? '' : ' btn-disabled'}" data-action="buyLvl1">${t('lvl')}.${gameState.selectedBuyLevel} ${t('buyFor')} ${formatNumber(getMemeCost())}</button>
        <button class="btn btn-legend" data-action="legend"><img class="icon-inline" src="assets/icons/icon-legend.png" alt="">${t('selectMemes')}</button>
        <button class="btn btn-back" data-action="menu">${t('menu')}</button>
      </div>
    </div>
  `;
}

function renderCollectionScreen() {
  let cardsHTML = '';
  for (const meme of memeData) {
    const unlocked = gameState.unlockedLevels.has(meme.level);
    if (unlocked) {
      cardsHTML += `
        <div class="meme-card" data-meme-id="${meme.id}">
          <div class="meme-card-inner"><img class="meme-card-img" src="assets/memes/${meme.image}" alt="${meme.nameEn}"></div>
        </div>
      `;
    } else {
      cardsHTML += `
        <div class="meme-card meme-card-locked">
          <div class="meme-card-inner"><div class="meme-card-placeholder"><img class="icon-inline icon-lock" src="assets/icons/icon-lock.png" alt=""></div></div>
        </div>
      `;
    }
  }

  return `
    <div class="screen screen-collection">
      <h2 class="title">${t('collection')}</h2>
      <div class="bottom-bar">
        <button class="btn btn-legend" data-action="openBossModal">${t('boss')}</button>
        <button class="btn btn-back" data-action="menu">${t('back')}</button>
      </div>
      <div class="collection-grid">${cardsHTML}</div>
    </div>
  `;
}

function renderMemeDetailModal(memeId) {
  const meme = memeData.find(m => m.id === memeId);
  if (!meme) return '';

  const desc = getLang() === 'en' && getMemeDescriptionEn(memeId)
    ? getMemeDescriptionEn(memeId).replace(/\n/g, '<br>')
    : meme.description.replace(/\n/g, '<br>').replace(/—\s/g, '— ');

  return `
    <div class="modal-overlay" data-action="closeModal">
      <div class="modal modal-detail" data-action="noop">
        <button class="modal-close" data-action="closeModal">&times;</button>
        <img class="modal-detail-img" src="assets/memes/${meme.image}" alt="${meme.nameEn}">
        <h2 class="modal-detail-title">${getLang() === 'en' ? meme.nameEn : meme.nameRu}</h2>
        <p class="modal-detail-subtitle">${meme.nameEn} / ${t('levelX')} ${meme.level} / ${meme.income}/${t('sec')}</p>
        <div class="modal-detail-body">${desc}</div>
      </div>
    </div>
  `;
}

function renderLegendModal() {
  const unlocked = [...gameState.unlockedLevels].sort((a, b) => a - b);
  let rowsHTML = '';

  if (unlocked.length === 0) {
    rowsHTML = '<p class="legend-empty">' + t('noMemeFound') + '</p>';
  } else {
    for (const level of unlocked) {
      const meme = getMemeByLevel(level);
      if (!meme) continue;
      const selClass = gameState.selectedBuyLevel === level ? ' legend-row-selected' : '';
      rowsHTML += `
        <div class="legend-row${selClass}" data-action="selectBuyLevel" data-level="${meme.level}">
          <img class="legend-row-img" src="assets/memes/${meme.image}" alt="${meme.nameEn}">
          <span class="legend-row-name">${getLang() === 'en' ? meme.nameEn : meme.nameRu}</span>
          <span class="legend-row-level">${t('lvl')}. ${meme.level}</span>
          <span class="legend-row-income">${meme.income}/${t('sec')}</span>
        </div>`;
    }
  }

  return `
    <div class="modal-overlay" data-action="closeModal">
      <div class="modal modal-legend" data-action="noop">
        <button class="modal-close" data-action="closeModal">&times;</button>
        <h2 class="modal-legend-title">${t('selectMeme')}</h2>
        <div class="legend-list">${rowsHTML}</div>
      </div>
    </div>
  `;
}

function renderDailyBonusModal(streak, reward, maxLevel) {
  let slotsHTML = '';
  for (let day = 1; day <= 7; day++) {
    const dayReward = DAILY_MULTIPLIERS[day - 1] * Math.max(maxLevel, 1);
    let statusClass = 'bonus-slot-locked';
    let statusIcon = '🔒';
    if (day < streak) {
      statusClass = 'bonus-slot-done';
      statusIcon = '✓';
    } else if (day === streak) {
      statusClass = 'bonus-slot-current';
      statusIcon = '→';
    }
    slotsHTML += '<div class="bonus-slot ' + statusClass + '">'
      + '<div class="bonus-slot-icon">' + statusIcon + '</div>'
      + '<div class="bonus-slot-day">' + t('dailyDayOf') + ' ' + day + '</div>'
      + '<div class="bonus-slot-reward">' + formatNumber(dayReward) + '</div>'
      + '</div>';
  }

  return ''
    + '<div class="modal-overlay" data-action="noop">'
    + '<div class="modal modal-daily" data-action="noop">'
    + '<h2 class="modal-daily-title"><img class="icon-inline" src="assets/icons/icon-bonus.png" alt="">' + t('dailyBonus') + '</h2>'
    + '<div class="modal-daily-subtitle">' + t('dailyDayOf') + ' ' + streak + ' / 7</div>'
    + '<div class="bonus-grid">' + slotsHTML + '</div>'
    + '<button class="btn btn-daily-claim" data-action="claimDaily">' + t('dailyClaim') + ' +' + formatNumber(reward) + '</button>'
    + '</div>'
    + '</div>';
}

function renderInvasionBarHTML() {
  const inv = getInvasionRemaining();
  const hh = getHappyHourStatus();
  let right = '';
  if (hh.active) {
    right = '<span class="invasion-timer hh-active">' + hh.text + '</span>';
  } else if (hh.text) {
    right = '<span class="invasion-timer hh-pending"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + hh.text + '</span>';
  }
  return '<div class="invasion-bar">'
    + '<span class="invasion-timer"><img class="icon-emoji" src="assets/icons/icon-invasion.png" alt=""> ' + inv.formatted + '</span>'
    + (right ? '<span class="invasion-sep">|</span>' + right : '')
    + '<button class="invasion-info-btn" data-action="invasionInfo">?</button>'
    + '</div>';
}

function renderTopBarHTML() {
  const inv = getInvasionRemaining();
  return '<div class="top-bar">'
    + '<span class="resource"><img class="icon-inline" src="assets/icons/icon-pasta.png" alt="">' + t('pasta') + ': <strong>' + formatNumber(gameState.coins) + '</strong> <button class="btn-pasta-ad-inline" data-action="watchAdPasta">▶️</button></span>'
    + '<span class="resource"><img class="icon-inline" src="assets/icons/icon-income.png" alt="">' + t('incomePerSec') + ': <strong>' + formatNumber(gameState.incomePerSecond) + '</strong></span>'
    + '</div>'
    + renderInvasionBarHTML();
}

function renderBoardHTML() {
  let html = '';
  const boss = getBossDataByWeek(1);
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!gameState.board[row]) continue;
    for (let col = 0; col < BOARD_SIZE; col++) {
      const level = gameState.board[row][col];
      const selected = isCellSelected(row, col) ? ' cell-selected' : '';
      if (level !== null) {
        if (level < 0) {
          const imgSrc = boss ? 'assets/bosses/' + boss.image : '';
          html += '<div class="cell cell-filled cell-boss' + selected + '" data-cell-row="' + row + '" data-cell-col="' + col + '"><img src="' + imgSrc + '" alt="Boss"></div>';
        } else {
          const meme = getMemeByLevel(level);
          const imgSrc = meme ? 'assets/memes/' + meme.image : '';
          html += '<div class="cell cell-filled' + selected + '" data-cell-row="' + row + '" data-cell-col="' + col + '"><img src="' + imgSrc + '" alt="M' + level + '"></div>';
        }
      } else {
        html += '<div class="cell' + selected + '" data-cell-row="' + row + '" data-cell-col="' + col + '">—</div>';
      }
    }
  }
  return html;
}

function renderSettingsScreen() {
  const vol = Math.round(getBGMVolume() * 100);
  const muted = isMuted();

  return ''
    + '<div class="screen screen-settings">'
    + '<h2 class="title">' + t('settings') + '</h2>'

    + '<div class="settings-group">'
    + '<label class="settings-label"><img class="icon-inline" src="assets/icons/icon-volume.png" alt="">' + t('volumeLabel') + '</label>'
    + '<div class="settings-row">'
    + '<span class="settings-vol-val">' + (muted ? '0' : vol) + '%</span>'
    + '<input type="range" min="0" max="100" value="' + (muted ? 0 : vol) + '" class="settings-slider" data-action="volChange">'
    + '</div>'
    + '</div>'

    + '<div class="settings-group">'
    + '<button class="btn btn-settings-mute" data-action="toggleMute">' + (muted ? t('muteOff') : t('muteOn')) + '</button>'
    + '</div>'

    + '<div class="settings-group">'
    + '<button class="btn btn-settings-theme" data-action="toggleTheme" id="themeBtn">' + (document.documentElement.getAttribute('data-theme') === 'light' ? t('themeDark') : t('themeLight')) + '</button>'
    + '</div>'

    + '<div class="settings-group">'
    + '<button class="btn btn-settings-theme" data-action="toggleLang" id="langBtn">' + t('langLabel') + ': ' + (getLang() === 'ru' ? t('langRu') : t('langEn')) + '</button>'
    + '</div>'

    + '<div class="settings-spacer"></div>'

    + '<div class="settings-group">'
    + '<button class="btn btn-back" data-action="menu">' + t('returnMenu') + '</button>'
    + '</div>'
    + '</div>';
}

function renderProgressBarHTML() {
  const p = getProgressData();
  if (p.maxLevel === 0) return '<span class="progress-text">' + t('buyFirstMeme') + '</span>';
  return '<span class="progress-text">' + t('progressLabel') + '. ' + p.maxLevel + ' ' + t('progressArrow') + ' ' + p.nextLevel + ': ' + p.count + '/2</span>'
    + '<div class="progress-track"><div class="progress-fill" style="width:' + p.percent + '%"></div></div>';
}

function renderBossModal() {
  const currentWeek = getWeekId(Date.now());
  const boss = getBossDataByWeek(1);
  const openFrags = Math.min(gameState.bossFragments, BOSS_FRAGMENTS_NEEDED);
  const completed = openFrags >= BOSS_FRAGMENTS_NEEDED;
  const bossName = completed && boss ? boss.nameRu : '???';

  let puzzleHTML = '';
  for (let i = 0; i < BOSS_FRAGMENTS_NEEDED; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    if (i < openFrags) {
      puzzleHTML += '<div class="puzzle-piece puzzle-open" style="background-image:url(assets/bg/boss-puzzle.jpg);background-size:300% 300%;background-position:' + (col * 50) + '% ' + (row * 50) + '%"></div>';
    } else {
      puzzleHTML += '<div class="puzzle-piece puzzle-locked"><img src="assets/icons/icon-lock.png" alt="" class="icon-lock"></div>';
    }
  }

  if (gameState.bossActive) {
    return ''
      + '<div class="modal-overlay" data-action="closeModal">'
      + '<div class="modal modal-boss" data-action="noop">'
      + '<button class="modal-close" data-action="closeModal">&times;</button>'
      + '<h2 class="modal-boss-title">' + t('boss') + '</h2>'
      + '<div class="modal-boss-name">' + bossName + '</div>'
      + '<div class="boss-collected" data-action="bossDetail">'
      + '<img class="boss-collected-img" src="assets/bosses/' + (boss ? boss.image : '') + '" alt="' + bossName + '">'
      + '</div>'
      + '<div class="boss-frag-count">' + t('bossPuzzleComplete') + '</div>'
      + '</div>'
      + '</div>';
  }

  let bottomHTML = '';
  let puzzleGrid = '<div class="puzzle-grid" style="width:220px;height:220px;grid-template-columns:repeat(3,1fr)">'
    + '<div class="puzzle-bg" style="background-image:url(assets/bg/boss-puzzle.jpg)"></div>'
    + puzzleHTML
    + '</div>';

  if (completed) {
    bottomHTML = '<button class="btn btn-upgrade-buy" data-action="claimBoss" style="margin-top:8px">' + t('claimBoss') + '</button>';
  } else {
    bottomHTML = '<div class="boss-frag-count"><img class="icon-emoji" src="assets/icons/icon-fragment.png" alt=""> ' + openFrags + '/' + BOSS_FRAGMENTS_NEEDED + '</div>';
  }

  return ''
    + '<div class="modal-overlay" data-action="closeModal">'
    + '<div class="modal modal-boss" data-action="noop">'
    + '<button class="modal-close" data-action="closeModal">&times;</button>'
    + '<h2 class="modal-boss-title">' + t('bossTitle') + ' <button class="invasion-info-btn" data-action="bossInfo" style="display:inline-flex;margin-left:8px;vertical-align:middle">?</button></h2>'
    + '<div class="modal-boss-name">' + bossName + '</div>'
    + puzzleGrid
    + bottomHTML
    + '</div>'
    + '</div>';
}

function renderUpgradesScreen() {
  const offlineCost = getOfflineUpgradeCost();
  const boostCost = getBoostUpgradeCost();
  const offlineLvl = gameState.offlineUpgradeLevel;
  const boostLvl = gameState.boostUpgradeLevel;
  const offlinePct = Math.round(getOfflineMultiplier() * 100);
  const boostSec = Math.round(getBoostDuration() / 1000);
  const offlineMaxed = offlineLvl >= 20;
  const boostMaxed = boostLvl >= 30;
  const canOffline = gameState.coins >= offlineCost && !offlineMaxed;
  const canBoost = gameState.coins >= boostCost && !boostMaxed;

  return ''
    + '<div class="screen screen-upgrades">'
    + '<h2 class="title">' + t('upgrades') + '</h2>'

    + '<div class="upgrade-card">'
    + '<div class="upgrade-header"><img class="icon-inline" src="assets/icons/icon-income.png" alt="">' + t('offlineHeader') + '</div>'
    + '<div class="upgrade-level">' + t('levelX') + ' ' + offlineLvl + '/20</div>'
    + '<div class="upgrade-current">' + t('currentOffline') + ': ' + offlinePct + '%</div>'
    + '<div class="upgrade-next">' + (offlineMaxed ? t('finish') : t('nextOffline') + ': ' + (offlinePct + 1) + '%') + '</div>'
    + '<div class="progress-track upgrade-track"><div class="progress-fill" style="width:' + (offlineLvl / 20 * 100) + '%"></div></div>'
    + '<button class="btn btn-upgrade-buy' + (canOffline ? '' : ' btn-disabled') + '" data-action="buyOfflineUpgrade"' + (offlineMaxed ? ' disabled' : '') + '>'
    + (offlineMaxed ? t('finish') : t('upgradeBuy') + ' ' + formatNumber(offlineCost))
    + '</button>'
    + '</div>'

    + '<div class="upgrade-card">'
    + '<div class="upgrade-header"><img class="icon-inline" src="assets/icons/icon-boost.png" alt="">' + t('boostHeader') + '</div>'
    + '<div class="upgrade-level">' + t('levelX') + ' ' + boostLvl + '/30</div>'
    + '<div class="upgrade-current">' + t('currentBoost') + ': ' + boostSec + ' ' + t('sec') + '</div>'
    + '<div class="upgrade-next">' + (boostMaxed ? t('finish') : t('nextBoost') + ': ' + (boostSec + 1) + ' ' + t('sec')) + '</div>'
    + '<div class="progress-track upgrade-track"><div class="progress-fill" style="width:' + (boostLvl / 30 * 100) + '%"></div></div>'
    + '<button class="btn btn-upgrade-buy' + (canBoost ? '' : ' btn-disabled') + '" data-action="buyBoostUpgrade"' + (boostMaxed ? ' disabled' : '') + '>'
    + (boostMaxed ? t('finish') : t('upgradeBuy') + ' ' + formatNumber(boostCost))
    + '</button>'
    + '</div>'

    + '<div class="settings-group">'
    + '<button class="btn btn-back" data-action="menu">' + t('returnMenu') + '</button>'
    + '</div>'
    + '</div>'
}

function renderGuideScreen() {
  return ''
    + '<div class="screen">'
    + '<h2 class="title">' + t('guideTitle') + '</h2>'
    + '<div class="guide-list">'

    + '<div class="guide-item">'
    + '<div class="guide-title">🔄 ' + t('guideMergeTitle') + '</div>'
    + '<div class="guide-text">' + t('guideMergeText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title">💰 ' + t('guideBuyTitle') + '</div>'
    + '<div class="guide-text">' + t('guideBuyText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title">📊 ' + t('guideIncomeTitle') + '</div>'
    + '<div class="guide-text">' + t('guideIncomeText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title">⚡ ' + t('guideBoostTitle') + '</div>'
    + '<div class="guide-text">' + t('guideBoostText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title">💤 ' + t('guideOfflineTitle') + '</div>'
    + '<div class="guide-text">' + t('guideOfflineText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title">🎁 ' + t('guideDailyTitle') + '</div>'
    + '<div class="guide-text">' + t('guideDailyText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title"><img class="icon-emoji" src="assets/icons/icon-invasion.png" alt=""> ' + t('guideInvasionTitle') + '</div>'
    + '<div class="guide-text">' + t('guideInvasionText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + t('guideHHTitle') + '</div>'
    + '<div class="guide-text">' + t('guideHHText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title"><img class="icon-emoji" src="assets/icons/icon-fragment.png" alt=""> ' + t('guideBossTitle') + '</div>'
    + '<div class="guide-text">' + t('guideBossText') + '</div>'
    + '</div>'

    + '<div class="guide-item">'
    + '<div class="guide-title">🔧 ' + t('guideUpgradeTitle') + '</div>'
    + '<div class="guide-text">' + t('guideUpgradeText') + '</div>'
    + '</div>'

    + '</div>'
    + '<div class="bottom-bar">'
    + '<button class="btn btn-back" data-action="menu">' + t('guideReturn') + '</button>'
    + '</div>'
    + '</div>';
}

function renderBossDetailModal() {
  const boss = getBossDataByWeek(1);
  if (!boss) return '';
  const desc = getLang() === 'en' && getBossDescriptionEn(boss.week)
    ? getBossDescriptionEn(boss.week).replace(/\n/g, '<br>')
    : boss.description.replace(/\n/g, '<br>');
  return ''
    + '<div class="modal-overlay" data-action="closeModal">'
    + '<div class="modal modal-detail" data-action="noop">'
    + '<button class="modal-close" data-action="closeModal">&times;</button>'
    + '<img class="modal-detail-img" src="assets/bosses/' + boss.image + '" alt="' + boss.nameEn + '">'
    + '<h2 class="modal-detail-title">' + (getLang() === 'en' ? boss.nameEn : boss.nameRu) + '</h2>'
    + '<p class="modal-detail-subtitle">' + boss.nameEn + ' / ' + t('bossIncome') + '</p>'
    + '<div class="modal-detail-body">' + desc + '</div>'
    + '</div>'
    + '</div>';
}

export { renderMenuScreen, renderGameScreen, renderCollectionScreen, renderMemeDetailModal, renderLegendModal, renderDailyBonusModal, renderTopBarHTML, renderBoardHTML, renderSettingsScreen, renderProgressBarHTML, renderInvasionBarHTML, renderBossModal, renderUpgradesScreen, renderGuideScreen, renderBossDetailModal };
