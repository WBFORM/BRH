import { renderMenuScreen, renderGameScreen, renderCollectionScreen, renderMemeDetailModal, renderLegendModal, renderDailyBonusModal, renderTopBarHTML, renderBoardHTML, renderSettingsScreen, renderProgressBarHTML, renderInvasionBarHTML, renderBossModal, renderUpgradesScreen, renderGuideScreen, renderBossDetailModal } from './screens.js';
import { initGameState, buyMeme, selectCell, canAffordMeme, getMemeCost, formatNumber, gameState, startIncomeTimer, stopIncomeTimer, saveGameState, loadGameState, checkDailyBonus, claimDailyBonus, activateBoost, activateBoostAd, getBoostStatus, BOARD_SIZE, isCellSelected, startInvasionTimer, stopInvasionTimer, getInvasionRemaining, generateHappyHour, getHappyHourStatus, BOSS_FRAGMENTS_NEEDED, upgradeOffline, upgradeBoost, claimCollectedBoss, getOfflineUpgradeCost, getBoostUpgradeCost, getOfflineMultiplier, getBoostDuration } from './game.js';
import { getMemeByLevel } from './data.js';
import { getBossDataByWeek } from './bossData.js';
import { init as initAudio, playSFX, playBGM, setBGMVolume, getBGMVolume, toggleMute } from './audio.js';
import { init as initSDK, ready as sdkReady, showRewardedVideo, getPlayerData, setPlayerData } from './sdk.js';
import { t, initLang, setLang, getLang } from './lang.js';

let currentScreen = 'menu';
let currentModal = null;

initLang();

(function initTheme() {
  const saved = localStorage.getItem('merge_meme_bots_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'light') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('merge_meme_bots_theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('merge_meme_bots_theme', 'light');
  }
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? t('themeDark') : t('themeLight');
  }
}

window.addEventListener('beforeunload', function () {
  if (currentScreen === 'game') {
    saveGameState();
    syncCloud();
  }
});

let saveTimeout = null;
function saveSoon() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(function () {
    saveGameState();
    syncCloud();
    saveTimeout = null;
  }, 500);
}

function syncCloud() {
  const raw = localStorage.getItem('merge_meme_bots_save');
  if (!raw) return;
  setPlayerData({ save: JSON.parse(raw) });
}

async function loadCloud() {
  const data = await getPlayerData(['save']);
  if (data && data.save) {
    localStorage.setItem('merge_meme_bots_save', JSON.stringify(data.save));
    return true;
  }
  return false;
}

function refreshUpgradesScreen() {
  const cards = document.querySelectorAll('.upgrade-card');
  if (cards.length < 2) return;

  const offlineCost = getOfflineUpgradeCost();
  const boostCost = getBoostUpgradeCost();
  const offlineLvl = gameState.offlineUpgradeLevel;
  const boostLvl = gameState.boostUpgradeLevel;
  const offlinePct = Math.round(getOfflineMultiplier() * 100);
  const boostSec = Math.round(getBoostDuration() / 1000);

  const titleEls = cards[0].querySelectorAll('.upgrade-level');
  const curEls = cards[0].querySelectorAll('.upgrade-current');
  const nextEls = cards[0].querySelectorAll('.upgrade-next');
  const progEls = cards[0].querySelectorAll('.progress-fill');
  const btnEls = cards[0].querySelectorAll('.btn-upgrade-buy');

  if (titleEls[0]) titleEls[0].textContent = 'Уровень ' + offlineLvl + '/20';
  if (curEls[0]) curEls[0].textContent = 'Текущий: ' + offlinePct + '%';
  if (nextEls[0]) nextEls[0].textContent = (offlineLvl >= 20 ? 'Максимум' : 'Следующий: ' + (offlinePct + 1) + '%');
  if (progEls[0]) progEls[0].style.width = (offlineLvl / 20 * 100) + '%';
  if (btnEls[0]) {
    btnEls[0].textContent = (offlineLvl >= 20 ? 'Максимум' : 'Улучшить за ' + formatNumber(offlineCost));
    btnEls[0].classList.toggle('btn-disabled', gameState.coins < offlineCost || offlineLvl >= 20);
  }

  const t2 = cards[1].querySelector('.upgrade-level');
  const c2 = cards[1].querySelector('.upgrade-current');
  const n2 = cards[1].querySelector('.upgrade-next');
  const p2 = cards[1].querySelector('.progress-fill');
  const b2 = cards[1].querySelector('.btn-upgrade-buy');

  if (t2) t2.textContent = 'Уровень ' + boostLvl + '/30';
  if (c2) c2.textContent = 'Текущая: ' + boostSec + ' сек';
  if (n2) n2.textContent = (boostLvl >= 30 ? 'Максимум' : 'Следующая: ' + (boostSec + 1) + ' сек');
  if (p2) p2.style.width = (boostLvl / 30 * 100) + '%';
  if (b2) {
    b2.textContent = (boostLvl >= 30 ? 'Максимум' : 'Улучшить за ' + formatNumber(boostCost));
    b2.classList.toggle('btn-disabled', gameState.coins < boostCost || boostLvl >= 30);
  }
}

function updateHUD() {
  if (currentScreen !== 'game') return;
  const coinsEl = document.querySelector('.top-bar .resource:first-child strong');
  const incomeEl = document.querySelector('.top-bar .resource:last-child strong');
  if (coinsEl) coinsEl.textContent = formatNumber(gameState.coins);
  if (incomeEl) incomeEl.textContent = formatNumber(gameState.incomePerSecond);

  const buyBtn = document.querySelector('[data-action="buyLvl1"]');
  if (buyBtn) {
    const cost = getMemeCost();
    buyBtn.textContent = t('lvl') + '.' + gameState.selectedBuyLevel + ' ' + t('buyFor') + ' ' + formatNumber(cost);
    if (canAffordMeme()) {
      buyBtn.classList.remove('btn-disabled');
    } else {
      buyBtn.classList.add('btn-disabled');
    }
  }

  const boostBtn = document.querySelector('.btn-boost');
  if (boostBtn) {
    const status = getBoostStatus();
    boostBtn.className = 'btn btn-boost';
    if (status.state === 'active') {
      boostBtn.classList.add('btn-boost-active', 'btn-disabled');
      boostBtn.textContent = '×2 ' + status.remainingSec + 's';
    } else if (status.state === 'cooldown') {
      boostBtn.classList.add('btn-boost-ad');
      const m = Math.floor(status.remainingSec / 60);
      const s = status.remainingSec % 60;
      boostBtn.textContent = m + ':' + String(s).padStart(2, '0') + ' +🎬';
      boostBtn.setAttribute('data-action', 'watchAdBoost');
    } else {
      boostBtn.textContent = '×2';
      boostBtn.setAttribute('data-action', 'boost');
    }
  }

  const boardEl = document.querySelector('.board');
  if (boardEl) {
    if (gameState.boostActive) {
      boardEl.classList.add('board-boost');
    } else {
      boardEl.classList.remove('board-boost');
    }
  }

  const invasionBar = document.querySelector('.invasion-bar');
  if (invasionBar) {
    const inv = getInvasionRemaining();
    const hh = getHappyHourStatus();
    const timerEl = invasionBar.querySelector('.invasion-timer:first-child');
    if (timerEl) timerEl.innerHTML = '<img class="icon-emoji" src="assets/icons/icon-invasion.png" alt=""> ' + inv.formatted;

    const hhEl = invasionBar.querySelector('.invasion-timer.hh-active, .invasion-timer.hh-pending');
    const sepEl = invasionBar.querySelector('.invasion-sep');
    if (hh.active) {
      if (!hhEl) {
        const sep = document.createElement('span');
        sep.className = 'invasion-sep';
        sep.textContent = '|';
        const span = document.createElement('span');
        span.className = 'invasion-timer hh-active';
        span.textContent = hh.text;
        invasionBar.insertBefore(sep, invasionBar.querySelector('.invasion-info-btn'));
        invasionBar.insertBefore(span, invasionBar.querySelector('.invasion-info-btn'));
      } else {
        hhEl.textContent = hh.text;
        hhEl.className = 'invasion-timer hh-active';
      }
    } else if (hh.text) {
      if (!hhEl) {
        const sep = document.createElement('span');
        sep.className = 'invasion-sep';
        sep.textContent = '|';
        const span = document.createElement('span');
        span.className = 'invasion-timer hh-pending';
        span.innerHTML = '<img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + hh.text;
        invasionBar.insertBefore(sep, invasionBar.querySelector('.invasion-info-btn'));
        invasionBar.insertBefore(span, invasionBar.querySelector('.invasion-info-btn'));
      } else {
        hhEl.innerHTML = '<img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + hh.text;
        hhEl.className = 'invasion-timer hh-pending';
      }
      if (sepEl) sepEl.style.display = '';
    } else if (hh.completed) {
      const hhEl = invasionBar.querySelector('.invasion-timer.hh-done');
      const sepEl2 = invasionBar.querySelector('.invasion-sep');
      if (!hhEl) {
        const sep = document.createElement('span');
        sep.className = 'invasion-sep';
        sep.textContent = '|';
        const span = document.createElement('span');
        span.className = 'invasion-timer hh-done';
        span.innerHTML = '<img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + t('hhDoneShort');
        invasionBar.insertBefore(sep, invasionBar.querySelector('.invasion-info-btn'));
        invasionBar.insertBefore(span, invasionBar.querySelector('.invasion-info-btn'));
      } else {
        hhEl.innerHTML = '<img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + t('hhDoneShort');
      }
      if (sepEl2) sepEl2.style.display = '';
    } else {
      if (hhEl) hhEl.remove();
      if (sepEl) sepEl.remove();
    }
  }
}

function showOfflineToast(coins, seconds) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const timeText = minutes >= 60
    ? hours + ' ' + (getLang() === 'en' ? 'h' : 'ч') + ' ' + (minutes % 60) + ' ' + (getLang() === 'en' ? 'min' : 'мин')
    : minutes + ' ' + (getLang() === 'en' ? 'min' : 'мин');

  const toast = document.createElement('div');
  toast.className = 'offline-toast';
  toast.innerHTML = '<span>+' + formatNumber(coins) + ' ' + t('offlineToast') + '</span><br><small>' + t('offlineAway') + ' ' + timeText + ' ' + t('offlineAbsence') + '</small>';
  document.body.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('offline-toast-out');
    setTimeout(function () { toast.remove(); }, 400);
  }, 3000);
}

function renderApp() {
  boardClickHandlerAttached = false;
  const app = document.getElementById('app');
  if (!app) { setTimeout(renderApp, 100); return; }

  let html = '';
  switch (currentScreen) {
    case 'menu':
      try { html = renderMenuScreen(); } catch(e) { console.error('Menu render error:', e); html = '<div class="screen"><h1>Brainrot Hunt</h1><button class="btn btn-start" data-action="start">Play</button></div>'; }
      break;
    case 'game':
      html = renderGameScreen();
      break;
    case 'collection':
      html = renderCollectionScreen();
      break;
    case 'settings':
      html = renderSettingsScreen();
      break;
    case 'upgrades':
      html = renderUpgradesScreen();
      break;
    case 'guide':
      html = renderGuideScreen();
      break;
    default:
      html = renderMenuScreen();
  }

  app.innerHTML = html;
  attachScreenListeners();
}

function updateGameBoard() {
  updateHUD();

  const boardEl = document.querySelector('.board');
  if (boardEl) {
    if (gameState.boostActive) {
      boardEl.classList.add('board-boost');
    } else {
      boardEl.classList.remove('board-boost');
    }
    if (gameState.happyHourActive) {
      boardEl.classList.add('board-boost-hh');
    } else {
      boardEl.classList.remove('board-boost-hh');
    }
  }

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = document.querySelector('[data-cell-row="' + row + '"][data-cell-col="' + col + '"]');
      if (!cell) continue;
      const level = gameState.board[row][col];
      const selected = isCellSelected(row, col);
      if (selected) {
        cell.classList.add('cell-selected');
      } else {
        cell.classList.remove('cell-selected');
      }
      if (level !== null) {
        if (level < 0) {
          cell.classList.add('cell-filled', 'cell-boss');
          const boss = getBossDataByWeek(1);
          const imgSrc = boss ? 'assets/bosses/' + boss.image : '';
          if (!cell.querySelector('img') || cell.querySelector('img').src.indexOf(imgSrc) === -1) {
            cell.innerHTML = '<img src="' + imgSrc + '" alt="Boss">';
          }
        } else {
          cell.classList.add('cell-filled');
          cell.classList.remove('cell-boss');
          const meme = getMemeByLevel(level);
          const imgSrc = meme ? 'assets/memes/' + meme.image : '';
          if (!cell.querySelector('img') || cell.querySelector('img').src.indexOf(imgSrc) === -1) {
            cell.innerHTML = '<img src="' + imgSrc + '" alt="M' + level + '">';
          }
        }
      } else {
        cell.classList.remove('cell-filled', 'cell-boss');
        if (cell.querySelector('img')) {
          cell.innerHTML = '—';
        }
      }
    }
  }

  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) progressBar.innerHTML = renderProgressBarHTML();

  const buyBtn = document.querySelector('[data-action="buyLvl1"]');
  if (buyBtn) {
    buyBtn.textContent = t('lvl') + '.' + gameState.selectedBuyLevel + ' ' + t('buyFor') + ' ' + formatNumber(getMemeCost());
    if (canAffordMeme()) {
      buyBtn.classList.remove('btn-disabled');
    } else {
      buyBtn.classList.add('btn-disabled');
    }
  }

  attachCellListeners();
}

let boardClickHandlerAttached = false;

function attachCellListeners() {
  if (boardClickHandlerAttached) return;
  boardClickHandlerAttached = true;
  const board = document.querySelector('.board');
  if (!board) return;
  board.addEventListener('click', function (e) {
    const cell = e.target.closest('[data-cell-row]');
    if (!cell) return;
    e.preventDefault();
    const row = parseInt(cell.getAttribute('data-cell-row'));
    const col = parseInt(cell.getAttribute('data-cell-col'));
    const result = selectCell(row, col);
    updateGameBoard();
    if (result.action === 'merge') {
      playSFX('merge');
      saveSoon();
      const mergedCell = document.querySelector('[data-cell-row="' + result.row + '"][data-cell-col="' + result.col + '"]');
      if (mergedCell) {
        mergedCell.classList.add('cell-merge-pop');
        setTimeout(function () { mergedCell.classList.remove('cell-merge-pop'); }, 400);
        spawnParticles(mergedCell);
      }
      if (result.isNewLevel) {
        playSFX('unlock');
        const meme = getMemeByLevel(result.newLevel);
        if (meme) {
          showPhraseToast(t('newCharacter'), getLang() === 'en' ? meme.nameEn : meme.nameRu);
        }
      }
      if (result.fragmentDropped) {
        playSFX('fragment');
        showPhraseToast(t('fragmentFound'), '');
        const fragCell = document.querySelector('[data-cell-row="' + result.row + '"][data-cell-col="' + result.col + '"]');
        if (fragCell) spawnParticles(fragCell, ['#00ccff', '#fff', '#0066ff']);
      }
    } else if (result.action === 'select' || result.action === 'deselect') {
      playSFX('cellClick');
    }
  });
}

function spawnParticles(el, colors) {
  const palette = colors || ['#f5c542', '#e67e22', '#fff', '#27ae60', '#8e44ad'];
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 14; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.4;
    const dist = 30 + Math.random() * 35;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    particle.style.left = cx + 'px';
    particle.style.top = cy + 'px';
    particle.style.setProperty('--px', dx + 'px');
    particle.style.setProperty('--py', dy + 'px');
    particle.style.width = (4 + Math.random() * 5) + 'px';
    particle.style.height = (4 + Math.random() * 5) + 'px';
    particle.style.background = palette[Math.floor(Math.random() * palette.length)];
    document.body.appendChild(particle);
    setTimeout(function () { particle.remove(); }, 650);
  }
}

let phraseToastEl = null;
let phraseToastTimer = null;

function showPhraseToast(name, text) {
  const cleanText = text.replace(/^\d+\.\s*/, '').replace(/\s*-\s*$/, '').trim();
  const short = cleanText.length > 80 ? cleanText.slice(0, 78) + '…' : cleanText;

  if (phraseToastEl) {
    clearTimeout(phraseToastTimer);
  } else {
    phraseToastEl = document.createElement('div');
    phraseToastEl.className = 'phrase-toast';
    document.body.appendChild(phraseToastEl);
  }

  phraseToastEl.innerHTML = '<strong>' + name + '</strong><br>' + short;
  phraseToastEl.classList.remove('phrase-toast-out');
  phraseToastTimer = setTimeout(function () {
    phraseToastEl.classList.add('phrase-toast-out');
    setTimeout(function () {
      if (phraseToastEl) phraseToastEl.remove();
      phraseToastEl = null;
    }, 400);
  }, 2600);
}

function handleBossSpawn(result) {
  const boss = getBossDataByWeek(1);
  const name = boss ? boss.nameRu : 'Босс';
  saveGameState();
  updateGameBoard();
  showPhraseToast(t('bossAwake'), name + ' — ' + t('bossIncome'));
}

function handleInvasion(result) {
  if (result.row === -1) {
    showPhraseToast(t('invasionBlocked'), t('invasionNoSpace'));
    return;
  }

  saveGameState();
  updateGameBoard();

  const cell = document.querySelector('[data-cell-row="' + result.row + '"][data-cell-col="' + result.col + '"]');
  if (cell) {
    cell.classList.add('cell-invasion');
    setTimeout(function () { cell.classList.remove('cell-invasion'); }, 1600);
  }

  const meme = getMemeByLevel(result.level);
  const name = meme ? meme.nameRu : 'Мем ' + result.level;
  showPhraseToast(t('invasionTitle'), name);
}

function invasionInfoModal() {
  return ''
    + '<div class="modal-overlay" data-action="closeModal">'
    + '<div class="modal modal-legend" data-action="noop">'
    + '<button class="modal-close" data-action="closeModal">&times;</button>'
    + '<h2 class="modal-legend-title"><img class="icon-emoji" src="assets/icons/icon-invasion.png" alt=""> ' + t('invasionInfoTitle') + '</h2>'
    + '<div class="legend-list">'
    + '<p style="color:var(--text-dim);font-size:13px;line-height:1.5;padding:8px 0">'
    + t('invasionInfoText')
    + '</p>'
    + '</div>'
    + '<h2 class="modal-legend-title" style="margin-top:12px"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> ' + t('hhInfoTitle') + '</h2>'
    + '<div class="legend-list">'
    + '<p style="color:var(--text-dim);font-size:13px;line-height:1.5;padding:8px 0">'
    + t('hhInfoText')
    + '</p>'
    + '</div>'
    + '<h2 class="modal-legend-title" style="margin-top:12px"><img class="icon-emoji" src="assets/icons/icon-happyhour.png" alt=""> Счастливый час</h2>'
    + '<div class="legend-list">'
    + '<p style="color:var(--text-dim);font-size:13px;line-height:1.5;padding:8px 0">'
    + 'Раз в день в случайное время между 10:00 и 22:00 — доход ×3 на 15 минут. Совмещается с бустом ×2.'
    + '</p>'
    + '</div>'
    + '</div>'
    + '</div>';
}

function bossInfoModal() {
  return ''
    + '<div class="modal-overlay" data-action="closeModal">'
    + '<div class="modal modal-legend" data-action="noop">'
    + '<button class="modal-close" data-action="closeModal">&times;</button>'
    + '<h2 class="modal-legend-title"><img class="icon-emoji" src="assets/icons/icon-fragment.png" alt=""> ' + t('bossInfo') + '</h2>'
    + '<div class="legend-list">'
    + '<p style="color:var(--text-dim);font-size:13px;line-height:1.5;padding:8px 0">'
    + t('bossModalInfo')
    + '</p>'
    + '</div>'
    + '</div>'
    + '</div>';
}

function openModal(modalHTML) {
  currentModal = modalHTML;
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-container';
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);
  attachModalListeners(modalContainer);
}

function closeModal() {
  currentModal = null;
  const containers = document.querySelectorAll('.modal-container');
  if (containers.length > 0) {
    containers[containers.length - 1].remove();
  }
}

function attachModalListeners(container) {
  const elements = container.querySelectorAll('[data-action]');
  for (const el of elements) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const action = this.getAttribute('data-action');
      if (action === 'closeModal') {
        closeModal();
      } else if (action === 'claimDaily') {
        const claimed = claimDailyBonus();
        if (claimed) {
          playSFX('bonus');
          saveGameState();
          syncCloud();
          closeModal();
          renderApp();
        }
      } else if (action === 'selectBuyLevel') {
        const level = parseInt(this.getAttribute('data-level'));
        gameState.selectedBuyLevel = level;
        closeModal();
        updateGameBoard();
      } else if (action === 'bossInfo') {
        openModal(bossInfoModal());
      } else if (action === 'bossDetail') {
        openModal(renderBossDetailModal());
      } else if (action === 'claimBoss') {
        const result = claimCollectedBoss();
        if (result) {
          saveSoon();
          closeModal();
          updateGameBoard();
          const boss = getBossDataByWeek(1);
          showPhraseToast('Босс пробудился!', (boss ? boss.nameRu : 'Босс') + ' — ×10 дохода');
        }
      }
    });
  }
}

function attachScreenListeners() {
  const buttons = document.querySelectorAll('[data-action]:not(input[type=range])');
  for (const btn of buttons) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      initAudio();
      const action = this.getAttribute('data-action');

      switch (action) {
        case 'start':
          initAudio();
          initSDK().then(function () {
            sdkReady();
            return loadCloud();
          }).then(function () {
            const loadResult = loadGameState();
            if (!loadResult.success) {
              initGameState();
            }
            generateHappyHour();
            currentScreen = 'game';
            renderApp();
            startIncomeTimer(updateHUD, handleBossSpawn);
            startInvasionTimer(handleInvasion);
            playBGM('game');
            if (loadResult.offlineCoins > 0) {
              showOfflineToast(loadResult.offlineCoins, loadResult.offlineSeconds);
            }
            const bonus = checkDailyBonus();
            if (bonus.available) {
              openModal(renderDailyBonusModal(bonus.streak, bonus.reward, bonus.maxLevel));
            }
          });
          break;
        case 'collection':
          currentScreen = 'collection';
          renderApp();
          playSFX('transition');
          playBGM('collection');
          break;
        case 'settings':
          if (currentScreen === 'game') { saveGameState(); syncCloud(); }
          stopIncomeTimer();
          stopInvasionTimer();
          currentScreen = 'settings';
          renderApp();
          break;
        case 'toggleTheme':
          toggleTheme();
          break;
        case 'toggleMute':
          toggleMute();
          renderApp();
          break;
        case 'toggleLang':
          setLang(getLang() === 'ru' ? 'en' : 'ru');
          renderApp();
          break;
        case 'boost':
          if (activateBoost()) {
            playSFX('boost');
            updateGameBoard();
          }
          break;
        case 'watchAdBoost':
          showRewardedVideo(function (rewarded) {
            if (rewarded && activateBoostAd()) {
              playSFX('boost');
              updateGameBoard();
            }
          });
          break;
        case 'watchAdPasta':
          showRewardedVideo(function (rewarded) {
            if (rewarded) {
              gameState.coins += Math.round(60 * gameState.incomePerSecond * gameState.incomeMultiplier);
              saveSoon();
              updateGameBoard();
            }
          });
          break;
        case 'upgrades':
          currentScreen = 'upgrades';
          renderApp();
          break;
        case 'guide':
          currentScreen = 'guide';
          renderApp();
          break;
        case 'buyOfflineUpgrade':
          if (upgradeOffline()) {
            playSFX('upgrade');
            saveGameState();
            syncCloud();
            refreshUpgradesScreen();
          }
          break;
        case 'buyBoostUpgrade':
          if (upgradeBoost()) {
            playSFX('upgrade');
            saveGameState();
            syncCloud();
            refreshUpgradesScreen();
          }
          break;
        case 'menu':
          stopIncomeTimer();
          stopInvasionTimer();
          saveGameState();
          syncCloud();
          currentScreen = 'menu';
          renderApp();
          playSFX('transition');
          playBGM('menu');
          break;
        case 'buyLvl1':
          if (canAffordMeme()) {
            const result = buyMeme();
            if (result.success) {
              saveSoon();
              playSFX('buy');
            } else {
              playSFX('error');
            }
          } else {
            playSFX('error');
          }
          updateGameBoard();
          break;
        case 'legend':
          openModal(renderLegendModal());
          break;
        case 'openBossModal':
          openModal(renderBossModal());
          break;
        case 'invasionInfo':
          openModal(invasionInfoModal());
          break;
        case 'bossInfo':
          openModal(bossInfoModal());
          break;
        default:
          break;
      }
    });
  }

  const cards = document.querySelectorAll('[data-meme-id]');
  for (const card of cards) {
    card.addEventListener('click', function (e) {
      e.preventDefault();
      const memeId = parseInt(this.getAttribute('data-meme-id'));
      openModal(renderMemeDetailModal(memeId));
    });
  }

  const sliders = document.querySelectorAll('[data-action="volChange"]');
  for (const slider of sliders) {
    slider.addEventListener('input', function () {
      const vol = parseInt(this.value) / 100;
      setBGMVolume(vol);
      const valEl = document.querySelector('.settings-vol-val');
      if (valEl) valEl.textContent = Math.round(vol * 100) + '%';
    });
  }

  attachCellListeners();
}

renderApp();

export { currentScreen, renderApp };
