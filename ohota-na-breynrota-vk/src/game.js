const BOARD_SIZE = 5;
const MEME_BUY_COST = 20;

function formatNumber(n) {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1) + 'K';
  if (n < 1000000) return Math.round(n / 1000) + 'K';
  return (n / 1000000).toFixed(2) + 'M';
}
const SAVE_KEY = 'merge_meme_bots_save';
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_MULTIPLIERS = [1000, 10000, 200000, 500000, 1000000, 5000000, 10000000];
const BOOST_DURATION_MS = 30000;
const BOOST_COOLDOWN_MS = 300000;
const INVASION_INTERVAL_MS = 2 * 60 * 60 * 1000;
const HAPPY_HOUR_DURATION_MS = 15 * 60 * 1000;
const BOSS_FRAGMENTS_NEEDED = 9;
const BOSS_DROP_CHANCE = 0.02;

let incomeTimerId = null;
let invasionTimerId = null;

const gameState = {
  board: [],
  coins: 0,
  incomePerSecond: 0,
  unlockedLevels: new Set(),
  selectedCell: null,
  purchases: 0,
  lastSaveTime: null,
  offlineMultiplier: 0.1,
  dailyStreak: 0,
  lastDailyTime: null,
  incomeMultiplier: 1.0,
  boostActive: false,
  boostEndTime: 0,
  boostCooldownEnd: 0,
  invasionNextTime: 0,
  happyHourActive: false,
  happyHourStart: 0,
  happyHourEnd: 0,
  lastHappyHourDay: '',
  happyHourMultiplier: 1.0,
  selectedBuyLevel: 1,
  bossFragments: 0,
  bossFragmentsToday: 0,
  lastFragmentDay: '',
  bossActive: false,
  bossLevel: 0,
  bossRow: -1,
  bossCol: -1,
  bossWeekId: '',
  offlineUpgradeLevel: 0,
  boostUpgradeLevel: 0,
};

function initGameState() {
  gameState.board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const rowArray = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      rowArray.push(null);
    }
    gameState.board.push(rowArray);
  }
  gameState.coins = 100;
  gameState.incomePerSecond = 0;
  gameState.unlockedLevels = new Set();
  gameState.selectedCell = null;
  gameState.purchases = 0;
  gameState.lastSaveTime = null;
  gameState.offlineMultiplier = 0.1;
  gameState.dailyStreak = 0;
  gameState.lastDailyTime = null;
  gameState.incomeMultiplier = 1.0;
  gameState.boostActive = false;
  gameState.boostEndTime = 0;
  gameState.boostCooldownEnd = 0;
  gameState.invasionNextTime = Date.now() + INVASION_INTERVAL_MS;
  gameState.happyHourActive = false;
  gameState.happyHourMultiplier = 1.0;
  generateHappyHour();
  gameState.selectedBuyLevel = 1;
  gameState.bossActive = false;
  gameState.bossLevel = 0;
  gameState.bossRow = -1;
  gameState.bossCol = -1;
  gameState.bossWeekId = getWeekId(Date.now());
  gameState.offlineUpgradeLevel = 0;
  gameState.boostUpgradeLevel = 0;
}

function updateIncome() {
  let total = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!gameState.board[row]) continue;
    for (let col = 0; col < BOARD_SIZE; col++) {
      const level = gameState.board[row][col];
      if (level !== null && level > 0) {
        total += Math.round(Math.pow(2.4, level - 1));
      }
    }
  }
  if (gameState.bossActive) total += getBossIncome();
  gameState.incomePerSecond = total;
}

let onBossSpawnCb = null;

function startIncomeTimer(onTick, onBossSpawn) {
  stopIncomeTimer();
  onBossSpawnCb = onBossSpawn;
  incomeTimerId = setInterval(function () {
    const now = Date.now();
    if (gameState.boostActive && now >= gameState.boostEndTime) {
      deactivateBoost();
    }
    if (!gameState.happyHourActive && now >= gameState.happyHourStart && now < gameState.happyHourEnd) {
      activateHappyHour();
    }
    if (gameState.happyHourActive && now >= gameState.happyHourEnd) {
      deactivateHappyHour();
    }
    resetBossWeek();
    if (gameState.incomePerSecond > 0) {
      gameState.coins += Math.floor(gameState.incomePerSecond * gameState.incomeMultiplier * gameState.happyHourMultiplier);
    }
    if (onTick) onTick();
  }, 1000);
}

function stopIncomeTimer() {
  if (incomeTimerId !== null) {
    clearInterval(incomeTimerId);
    incomeTimerId = null;
  }
}

function checkInvasion() {
  const now = Date.now();
  if (now < gameState.invasionNextTime) return null;

  const emptyCells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (gameState.board[row][col] === null) emptyCells.push({ row, col });
    }
  }

  if (emptyCells.length === 0) {
    gameState.invasionNextTime = now + INVASION_INTERVAL_MS;
    return { row: -1, col: -1, level: 0 };
  }

  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const level = 3 + Math.floor(Math.random() * 3);
  gameState.board[cell.row][cell.col] = level;
  gameState.unlockedLevels.add(level);
  gameState.invasionNextTime = now + INVASION_INTERVAL_MS;
  updateIncome();
  return { row: cell.row, col: cell.col, level };
}

function startInvasionTimer(onInvasion) {
  stopInvasionTimer();
  invasionTimerId = setInterval(function () {
    const result = checkInvasion();
    if (result && onInvasion) onInvasion(result);
  }, 1000);
}

function stopInvasionTimer() {
  if (invasionTimerId !== null) {
    clearInterval(invasionTimerId);
    invasionTimerId = null;
  }
}

function getInvasionRemaining() {
  const remaining = Math.max(0, gameState.invasionNextTime - Date.now());
  const totalSec = Math.ceil(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { ms: remaining, seconds: totalSec, formatted: totalSec === 0 ? 'сейчас' : h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') };
}

function generateHappyHour() {
  const now = new Date(Date.now());
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

  if (gameState.lastHappyHourDay === todayStr) return;

  gameState.lastHappyHourDay = todayStr;
  const startHour = 10 + Math.floor(Math.random() * 13);
  const startMin = Math.floor(Math.random() * 60);

  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin, 0, 0);
  gameState.happyHourStart = startDate.getTime();
  gameState.happyHourEnd = gameState.happyHourStart + HAPPY_HOUR_DURATION_MS;
  gameState.happyHourActive = false;
  gameState.happyHourMultiplier = 1.0;

  const nowTs = Date.now();
  if (nowTs >= gameState.happyHourStart && nowTs < gameState.happyHourEnd) {
    gameState.happyHourActive = true;
    gameState.happyHourMultiplier = 3.0;
  }
}

function activateHappyHour() {
  gameState.happyHourActive = true;
  gameState.happyHourMultiplier = 3.0;
}

function deactivateHappyHour() {
  gameState.happyHourActive = false;
  gameState.happyHourMultiplier = 1.0;
}

function getHappyHourStatus() {
  const now = Date.now();
  if (gameState.happyHourActive) {
    const remaining = Math.max(0, Math.ceil((gameState.happyHourEnd - now) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return { active: true, text: '🍀 ×3 ' + m + ':' + String(s).padStart(2, '0') };
  }
  if (now < gameState.happyHourStart) {
    const remaining = Math.ceil((gameState.happyHourStart - now) / 1000);
    if (remaining <= 0) return { active: false, text: '' };
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    return { active: false, text: h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') };
  }
  if (now < gameState.happyHourEnd) {
    const remaining = Math.max(0, Math.ceil((gameState.happyHourEnd - now) / 1000));
    if (remaining <= 0) return { active: false, text: '' };
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return { active: true, text: '🍀 ×3 ' + m + ':' + String(s).padStart(2, '0') };
  }
  return { active: false, text: '', completed: true };
}

function getWeekId(ts) {
  const d = new Date(ts);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const y = monday.getFullYear();
  const mm = monday.getMonth() + 1;
  const dd = monday.getDate();
  return y + '-W' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
}

function resetBossWeek() {
  const now = Date.now();
  const currentWeek = getWeekId(now);
  if (gameState.bossWeekId === currentWeek) return;
  gameState.bossFragments = 0;
  gameState.bossFragmentsToday = 0;
  gameState.bossWeekId = currentWeek;
  if (gameState.bossActive) {
    gameState.board[gameState.bossRow][gameState.bossCol] = null;
    gameState.bossActive = false;
    gameState.bossLevel = 0;
    gameState.bossRow = -1;
    gameState.bossCol = -1;
  }
}

function claimCollectedBoss() {
  return spawnBossOnBoard();
}

function spawnBossOnBoard() {
  if (gameState.bossActive || gameState.bossFragments < BOSS_FRAGMENTS_NEEDED) return null;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (gameState.board[row][col] === null) {
        gameState.bossActive = true;
        gameState.bossLevel = getMaxLevelOnBoard();
        gameState.bossRow = row;
        gameState.bossCol = col;
        gameState.board[row][col] = -gameState.bossLevel;
        return { row, col, level: gameState.bossLevel };
      }
    }
  }
  return null;
}

function getBossIncome() {
  if (!gameState.bossActive) return 0;
  return 10 * Math.round(Math.pow(2.4, gameState.bossLevel - 1));
}

function getMaxLevelOnBoard() {
  let maxLevel = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!gameState.board[row]) continue;
    for (let col = 0; col < BOARD_SIZE; col++) {
      const level = gameState.board[row][col];
      if (level !== null && level > maxLevel) maxLevel = level;
    }
  }
  return maxLevel;
}

function getProgressData() {
  const maxLevel = getMaxLevelOnBoard();
  if (maxLevel === 0) return { maxLevel: 0, count: 0, nextLevel: 1, percent: 0 };
  let count = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!gameState.board[row]) continue;
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (gameState.board[row][col] === maxLevel) count++;
    }
  }
  return { maxLevel, count: Math.min(count, 2), nextLevel: maxLevel + 1, percent: Math.min(count / 2, 1) * 100 };
}

function checkDailyBonus() {
  const now = Date.now();
  const last = gameState.lastDailyTime;
  let newStreak;

  if (last === null) {
    newStreak = 1;
  } else {
    const elapsed = now - last;
    if (elapsed >= DAY_MS && elapsed < DAY_MS * 2) {
      newStreak = Math.min(gameState.dailyStreak + 1, 7);
    } else if (elapsed >= DAY_MS * 2) {
      newStreak = 1;
    } else {
      const maxLevel = getMaxLevelOnBoard();
      const safeMax = Math.max(maxLevel, 1);
      const idx = Math.min(gameState.dailyStreak, 7) - 1;
      return { available: false, streak: gameState.dailyStreak, reward: DAILY_MULTIPLIERS[Math.max(idx, 0)], maxLevel: safeMax };
    }
  }

  const maxLevel = getMaxLevelOnBoard();
  const reward = DAILY_MULTIPLIERS[newStreak - 1];
  return { available: true, streak: newStreak, reward, maxLevel: Math.max(maxLevel, 1) };
}

function claimDailyBonus() {
  const bonus = checkDailyBonus();
  if (!bonus.available) return null;
  gameState.dailyStreak = bonus.streak;
  gameState.lastDailyTime = Date.now();
  gameState.coins += bonus.reward;
  return bonus;
}

function activateBoost() {
  if (gameState.boostActive) return false;
  if (Date.now() < gameState.boostCooldownEnd) return false;
  gameState.boostActive = true;
  gameState.incomeMultiplier = 2.0;
  gameState.boostEndTime = Date.now() + getBoostDuration();
  return true;
}

function activateBoostAd() {
  if (gameState.boostActive) return false;
  gameState.boostActive = true;
  gameState.incomeMultiplier = 2.0;
  gameState.boostEndTime = Date.now() + getBoostDuration();
  return true;
}

function deactivateBoost() {
  gameState.boostActive = false;
  gameState.incomeMultiplier = 1.0;
  gameState.boostCooldownEnd = Date.now() + BOOST_COOLDOWN_MS;
}

function getBoostStatus() {
  const now = Date.now();
  if (gameState.boostActive) {
    const remaining = Math.max(0, Math.ceil((gameState.boostEndTime - now) / 1000));
    return { state: 'active', remainingSec: remaining };
  }
  if (now < gameState.boostCooldownEnd) {
    const remaining = Math.ceil((gameState.boostCooldownEnd - now) / 1000);
    return { state: 'cooldown', remainingSec: remaining };
  }
  return { state: 'ready', remainingSec: 0 };
}

function getOfflineMultiplier() {
  return 0.1 + gameState.offlineUpgradeLevel * 0.01;
}

function getBoostDuration() {
  return Math.min(60000, 30000 + gameState.boostUpgradeLevel * 1000);
}

function getOfflineUpgradeCost() {
  return Math.round(100000 * Math.pow(3, gameState.offlineUpgradeLevel));
}

function getBoostUpgradeCost() {
  return Math.round(100000 * Math.pow(3, gameState.boostUpgradeLevel));
}

function upgradeOffline() {
  const cost = getOfflineUpgradeCost();
  if (gameState.coins < cost || gameState.offlineUpgradeLevel >= 20) return false;
  gameState.coins -= cost;
  gameState.offlineUpgradeLevel++;
  return true;
}

function upgradeBoost() {
  const cost = getBoostUpgradeCost();
  if (gameState.coins < cost || gameState.boostUpgradeLevel >= 30) return false;
  gameState.coins -= cost;
  gameState.boostUpgradeLevel++;
  return true;
}

function getCostForLevel(level) {
  const equivalents = 1 << (level - 1);
  if (equivalents === 1) {
    return MEME_BUY_COST + gameState.purchases * 15;
  }
  const avg = MEME_BUY_COST + 15 * (gameState.purchases + (equivalents - 1) / 2);
  return Math.round(equivalents * avg);
}

function getMemeCost() {
  return getCostForLevel(gameState.selectedBuyLevel);
}

function canAffordMeme() {
  return gameState.coins >= getMemeCost();
}

function buyMeme(level) {
  const lvl = level || gameState.selectedBuyLevel;
  const cost = getMemeCost();
  if (gameState.coins < cost) {
    return { success: false, reason: 'not_enough_coins', cost };
  }
  if (!addMemeToBoard(lvl)) {
    return { success: false, reason: 'board_full', cost };
  }
  gameState.coins -= cost;
  gameState.purchases += 1 << (lvl - 1);
  updateIncome();
  return { success: true, cost };
}

function addMemeToBoard(level) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (!gameState.board[row]) continue;
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (gameState.board[row][col] === null) {
        gameState.board[row][col] = level;
        gameState.unlockedLevels.add(level);
        return true;
      }
    }
  }
  return false;
}

function selectCell(row, col) {
  const clickedLevel = gameState.board[row][col];

  if (gameState.selectedCell === null) {
    if (clickedLevel !== null) {
      gameState.selectedCell = { row, col };
      return { action: 'select' };
    }
    return { action: 'none' };
  }

  const sel = gameState.selectedCell;
  const selLevel = gameState.board[sel.row][sel.col];

  if (sel.row === row && sel.col === col) {
    gameState.selectedCell = null;
    return { action: 'deselect' };
  }

  if (clickedLevel === null) {
    gameState.selectedCell = null;
    return { action: 'deselect' };
  }

  if (selLevel === clickedLevel) {
    const newLevel = selLevel + 1;
    const isNewLevel = !gameState.unlockedLevels.has(newLevel);
    gameState.board[row][col] = newLevel;
    gameState.board[sel.row][sel.col] = null;
    gameState.selectedCell = null;
    gameState.unlockedLevels.add(newLevel);
    gameState.coins += selLevel;
    updateIncome();
    const today = new Date(Date.now()).toDateString();
    if (gameState.lastFragmentDay !== today) {
      gameState.lastFragmentDay = today;
      gameState.bossFragmentsToday = 0;
    }
    const fragmentDropped = selLevel >= 4 && Math.random() < BOSS_DROP_CHANCE && gameState.bossFragments < BOSS_FRAGMENTS_NEEDED && !gameState.bossActive && gameState.bossFragmentsToday < 3;
    if (fragmentDropped) { gameState.bossFragments++; gameState.bossFragmentsToday++; }
    return { action: 'merge', newLevel, row, col, isNewLevel, fragmentDropped };
  }

  gameState.selectedCell = { row, col };
  return { action: 'select' };
}

function isCellSelected(row, col) {
  if (!gameState.selectedCell) return false;
  return gameState.selectedCell.row === row && gameState.selectedCell.col === col;
}

function saveGameState() {
  gameState.lastSaveTime = Date.now();
  const data = {
    board: gameState.board,
    coins: gameState.coins,
    incomePerSecond: gameState.incomePerSecond,
    unlockedLevels: [...gameState.unlockedLevels],
    purchases: gameState.purchases,
    lastSaveTime: gameState.lastSaveTime,
    offlineMultiplier: gameState.offlineMultiplier,
    dailyStreak: gameState.dailyStreak,
    lastDailyTime: gameState.lastDailyTime,
    incomeMultiplier: gameState.incomeMultiplier,
    boostActive: gameState.boostActive,
    boostEndTime: gameState.boostEndTime,
    boostCooldownEnd: gameState.boostCooldownEnd,
    invasionNextTime: gameState.invasionNextTime,
    happyHourActive: gameState.happyHourActive,
    happyHourStart: gameState.happyHourStart,
    happyHourEnd: gameState.happyHourEnd,
    lastHappyHourDay: gameState.lastHappyHourDay,
    happyHourMultiplier: gameState.happyHourMultiplier,
    selectedBuyLevel: gameState.selectedBuyLevel,
    bossFragments: gameState.bossFragments,
    bossFragmentsToday: gameState.bossFragmentsToday,
    lastFragmentDay: gameState.lastFragmentDay,
    bossActive: gameState.bossActive,
    bossLevel: gameState.bossLevel,
    bossRow: gameState.bossRow,
    bossCol: gameState.bossCol,
    bossWeekId: gameState.bossWeekId,
    offlineUpgradeLevel: gameState.offlineUpgradeLevel,
    boostUpgradeLevel: gameState.boostUpgradeLevel,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { success: false };
    const data = JSON.parse(raw);
    if (typeof data.coins !== 'number' || !Array.isArray(data.board) || data.board.length !== BOARD_SIZE) {
      console.warn('Save data corrupted, starting fresh');
      return { success: false };
    }
    let boardOk = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!Array.isArray(data.board[r]) || data.board[r].length !== BOARD_SIZE) { boardOk = false; break; }
    }
    if (!boardOk) {
      console.warn('Board data corrupted, starting fresh');
      return { success: false };
    }
    gameState.board = data.board;
    gameState.coins = data.coins;
    gameState.incomePerSecond = data.incomePerSecond || 0;
    gameState.unlockedLevels = new Set(data.unlockedLevels || []);
    gameState.purchases = data.purchases || 0;
    gameState.selectedCell = null;
    gameState.lastSaveTime = data.lastSaveTime || Date.now();
    gameState.offlineMultiplier = data.offlineMultiplier || 0.1;
    gameState.dailyStreak = data.dailyStreak || 0;
    gameState.lastDailyTime = data.lastDailyTime || null;
    gameState.incomeMultiplier = data.incomeMultiplier || 1.0;
    gameState.boostActive = data.boostActive || false;
    gameState.boostEndTime = data.boostEndTime || 0;
    gameState.boostCooldownEnd = data.boostCooldownEnd || 0;
    gameState.invasionNextTime = data.invasionNextTime || Date.now() + INVASION_INTERVAL_MS;
    gameState.happyHourActive = data.happyHourActive || false;
    gameState.happyHourStart = data.happyHourStart || 0;
    gameState.happyHourEnd = data.happyHourEnd || 0;
    gameState.lastHappyHourDay = data.lastHappyHourDay || '';
    gameState.happyHourMultiplier = data.happyHourMultiplier || 1.0;
    if (!gameState.happyHourActive && gameState.happyHourMultiplier > 1.0) {
      gameState.happyHourMultiplier = 1.0;
    }
    gameState.selectedBuyLevel = data.selectedBuyLevel || 1;
    gameState.bossFragments = data.bossFragments || 0;
    gameState.bossFragmentsToday = data.bossFragmentsToday || 0;
    gameState.lastFragmentDay = data.lastFragmentDay || '';
    gameState.bossActive = data.bossActive || false;
    gameState.bossLevel = data.bossLevel || 0;
    gameState.bossRow = data.bossRow != null ? data.bossRow : -1;
    gameState.bossCol = data.bossCol != null ? data.bossCol : -1;
    gameState.bossWeekId = data.bossWeekId || '';
    gameState.offlineUpgradeLevel = data.offlineUpgradeLevel || 0;
    gameState.boostUpgradeLevel = data.boostUpgradeLevel || 0;
    if (gameState.boostActive && !gameState.incomeMultiplier) {
      gameState.incomeMultiplier = 2.0;
    }
    if (!gameState.boostActive && gameState.incomeMultiplier > 1.0) {
      gameState.incomeMultiplier = 1.0;
    }
    updateIncome();

    const now = Date.now();
    const elapsed = Math.floor((now - gameState.lastSaveTime) / 1000);
    const mult = getOfflineMultiplier();
    const MAX_AWAY = 14400;
    const capped = Math.min(elapsed, MAX_AWAY);
    const offlineCoins = (capped > 5 && gameState.incomePerSecond > 0)
      ? Math.floor(capped * gameState.incomePerSecond * mult)
      : 0;

    if (offlineCoins > 0) {
      gameState.coins += offlineCoins;
      gameState.lastSaveTime = now;
      return { success: true, offlineCoins, offlineSeconds: capped };
    }
    return { success: true, offlineCoins: 0 };
  } catch (e) {
    console.warn('Failed to load save:', e);
    return { success: false };
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // ignore
  }
}

export { BOARD_SIZE, MEME_BUY_COST, formatNumber, DAILY_MULTIPLIERS, BOSS_FRAGMENTS_NEEDED, BOSS_DROP_CHANCE, gameState, initGameState, buyMeme, addMemeToBoard, selectCell, isCellSelected, getMemeCost, canAffordMeme, updateIncome, startIncomeTimer, stopIncomeTimer, saveGameState, loadGameState, clearSave, checkDailyBonus, claimDailyBonus, activateBoost, activateBoostAd, deactivateBoost, getBoostStatus, getProgressData, startInvasionTimer, stopInvasionTimer, checkInvasion, getInvasionRemaining, generateHappyHour, getHappyHourStatus, getCostForLevel, claimCollectedBoss, getBossIncome, getWeekId, getOfflineUpgradeCost, getBoostUpgradeCost, upgradeOffline, upgradeBoost, getOfflineMultiplier, getBoostDuration };
