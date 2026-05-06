let ysdk = null;
let initialized = false;

async function init() {
  if (initialized) return;
  try {
    if (typeof YaGames !== 'undefined') {
      ysdk = await YaGames.init();
    }
  } catch (e) {
    console.warn('SDK not available, running without Yandex features');
  }
  initialized = true;
}

function ready() {
  if (!ysdk || !ysdk.features || !ysdk.features.LoadingAPI) return;
  ysdk.features.LoadingAPI.ready();
}

function gameplayStart() {
  if (!ysdk || !ysdk.features || !ysdk.features.GameplayAPI) return;
  ysdk.features.GameplayAPI.start();
}

function gameplayStop() {
  if (!ysdk || !ysdk.features || !ysdk.features.GameplayAPI) return;
  ysdk.features.GameplayAPI.stop();
}

function showRewardedVideo(onRewarded) {
  if (ysdk && ysdk.adv) {
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: function () {},
        onRewarded: function () { if (onRewarded) onRewarded(true); },
        onClose: function () {},
        onError: function (e) { console.warn('Rewarded video error:', e); if (onRewarded) onRewarded(false); },
      },
    });
    return;
  }
  if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
    window.CrazyGames.SDK.ad.requestAd('rewarded', {
      callbacks: {
        adFinished: function () { if (onRewarded) onRewarded(true); },
        adError: function (e) { console.warn('CG ad error:', e); if (onRewarded) onRewarded(false); },
      },
    });
    return;
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    if (onRewarded) onRewarded(true);
  }
}

function showInterstitial() {
  if (!ysdk || !ysdk.adv) return;
  ysdk.adv.showFullscreenAdv({
    callbacks: {
      onClose: function (wasShown) {},
      onError: function (e) { console.warn('Interstitial error:', e); },
    },
  });
}

function getPlayerData(keys) {
  if (!ysdk || !ysdk.getPlayer) return Promise.resolve(null);
  return ysdk.getPlayer({ signed: true }).then(function () {
    return ysdk.getPlayerData(keys);
  }).catch(function () {
    return null;
  });
}

function setPlayerData(data) {
  if (!ysdk || !ysdk.getPlayer) return;
  ysdk.getPlayer({ signed: true }).then(function () {
    return ysdk.setPlayerData(data);
  }).catch(function () {});
}

function isReady() {
  return ysdk !== null;
}

export { init, ready, gameplayStart, gameplayStop, showRewardedVideo, showInterstitial, getPlayerData, setPlayerData, isReady };
