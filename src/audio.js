const SFX = {
  cellClick: 'assets/sounds/sfx-cell-click.mp3',
  merge: 'assets/sounds/sfx-merge.mp3',
  buy: 'assets/sounds/sfx-buy.mp3',
  unlock: 'assets/sounds/sfx-unlock.mp3',
  boost: 'assets/sounds/sfx-boost.mp3',
  bonus: 'assets/sounds/sfx-bonus.mp3',
  error: 'assets/sounds/sfx-error.mp3',
  transition: 'assets/sounds/sfx-transition.mp3',
  fragment: 'assets/sounds/sfx-fragment.mp3',
  upgrade: 'assets/sounds/sfx-upgrade.mp3',
};

const BGM = {
  menu: { src: 'assets/bgm/bgm-menu.mp3', baseVol: 0.8 },
  game: { src: 'assets/bgm/bgm-game.mp3', baseVol: 0.5 },
  collection: { src: 'assets/bgm/bgm-collection.mp3', baseVol: 0.7 },
};

let sfxPool = {};
let bgmCurrent = null;
let bgmNext = null;
let bgmFadeTimer = null;
let muted = false;
let initialized = false;
let currentBgmScreen = null;
let bgmVolume = 0.6;

function init() {
  if (initialized) return;
  initialized = true;

  const savedMuted = localStorage.getItem('merge_meme_bots_muted');
  if (savedMuted !== null) muted = savedMuted === 'true';

  const savedVol = localStorage.getItem('merge_meme_bots_bgm_volume');
  if (savedVol !== null) bgmVolume = parseFloat(savedVol);

  for (const key of Object.keys(SFX)) {
    const pool = [];
    for (let i = 0; i < 6; i++) {
      const audio = new Audio(SFX[key]);
      audio.volume = muted ? 0 : 1;
      pool.push(audio);
    }
    sfxPool[key] = { pool: pool, idx: 0 };
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      pauseBGM();
    } else {
      resumeBGM();
    }
  });
}

function playSFX(name) {
  if (!initialized) return;
  const slot = sfxPool[name];
  if (!slot) return;
  const audio = slot.pool[slot.idx];
  slot.idx = (slot.idx + 1) % slot.pool.length;
  audio.volume = muted ? 0 : 1;
  audio.play().catch(function () {});
}

function playBGM(screen) {
  if (!initialized || muted) return;
  if (currentBgmScreen === screen) return;
  currentBgmScreen = screen;

  const track = BGM[screen];
  if (!track) return;

  if (bgmFadeTimer) {
    clearInterval(bgmFadeTimer);
    bgmFadeTimer = null;
  }

  if (bgmNext) {
    bgmNext.pause();
    bgmNext.src = '';
    bgmNext = null;
  }

  const prev = bgmCurrent;
  const next = new Audio(track.src);
  next.loop = true;
  next.volume = 0;
  next.play().catch(function () {});

  bgmNext = next;

  const fadeSteps = 15;
  const fadeInterval = 100;
  let step = 0;

  bgmFadeTimer = setInterval(function () {
    step++;
    const targetVol = muted ? 0 : bgmVolume * track.baseVol;
    if (prev) {
      prev.volume = Math.max(0, targetVol * (1 - step / fadeSteps));
    }
    next.volume = Math.min(targetVol, targetVol * step / fadeSteps);

    if (step >= fadeSteps) {
      clearInterval(bgmFadeTimer);
      bgmFadeTimer = null;
      if (prev) {
        prev.pause();
        prev.src = '';
      }
      bgmCurrent = next;
      bgmNext = null;
    }
  }, fadeInterval);
}

function stopBGM() {
  if (bgmFadeTimer) {
    clearInterval(bgmFadeTimer);
    bgmFadeTimer = null;
  }
  if (bgmCurrent) {
    bgmCurrent.pause();
    bgmCurrent.src = '';
    bgmCurrent = null;
  }
  if (bgmNext) {
    bgmNext.pause();
    bgmNext.src = '';
    bgmNext = null;
  }
  currentBgmScreen = null;
}

function pauseBGM() {
  if (bgmCurrent) bgmCurrent.pause();
  if (bgmNext) bgmNext.pause();
}

function resumeBGM() {
  if (bgmCurrent && currentBgmScreen) {
    bgmCurrent.play().catch(function () {});
  }
}

function toggleMute() {
  muted = !muted;
  localStorage.setItem('merge_meme_bots_muted', muted ? 'true' : 'false');

  for (const key of Object.keys(sfxPool)) {
    const slot = sfxPool[key];
    for (const a of slot.pool) {
      a.volume = muted ? 0 : 1;
    }
  }

  if (muted) {
    stopBGM();
  } else if (currentBgmScreen) {
    const screen = currentBgmScreen;
    currentBgmScreen = null;
    playBGM(screen);
  }

  return muted;
}

function isMuted() {
  return muted;
}

function setBGMVolume(v) {
  bgmVolume = Math.max(0, Math.min(1, v));
  localStorage.setItem('merge_meme_bots_bgm_volume', bgmVolume);
  if (bgmCurrent && !muted && currentBgmScreen) {
    const track = BGM[currentBgmScreen];
    if (track) bgmCurrent.volume = bgmVolume * track.baseVol;
  }
}

function getBGMVolume() {
  return bgmVolume;
}

export { init, playSFX, playBGM, stopBGM, toggleMute, isMuted, setBGMVolume, getBGMVolume };
