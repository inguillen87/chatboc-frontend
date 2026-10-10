(function bootstrapAssetRecovery() {
  var recoveryKey = 'chatboc_asset_recovery_at';
  var recoveryWindowMs = 60 * 1000;
  var assetPattern = /\/assets\/.*\.(?:js|css)(?:[?#].*)?$/i;
  var chunkErrorPattern =
    /chunkloaderror|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to load module script/i;
  var pwaCachePattern = /^(?:workbox-precache|chatboc-(?:assets|shell)-)/;

  function registrationWorkerUrl(registration) {
    var worker = registration.installing || registration.waiting || registration.active;
    return worker && worker.scriptURL ? worker.scriptURL : '';
  }

  function isChatbocRegistration(registration) {
    try {
      var scriptUrl = registrationWorkerUrl(registration);
      if (!scriptUrl) {
        return registration.scope === new URL('/', window.location.origin).href;
      }
      var parsedScriptUrl = new URL(scriptUrl);
      return parsedScriptUrl.origin === window.location.origin && parsedScriptUrl.pathname === '/sw.js';
    } catch (_error) {
      return false;
    }
  }

  function currentRecoveryTimestamp() {
    try {
      return Number(window.sessionStorage.getItem(recoveryKey) || 0);
    } catch (_error) {
      return 0;
    }
  }

  function markRecoveryAttempt() {
    try {
      window.sessionStorage.setItem(recoveryKey, String(Date.now()));
    } catch (_error) {
      // Storage can be unavailable in strict privacy modes.
    }
  }

  async function recover(reason) {
    if (window.navigator && window.navigator.onLine === false) {
      return false;
    }

    if (Date.now() - currentRecoveryTimestamp() < recoveryWindowMs) {
      return false;
    }

    markRecoveryAttempt();

    try {
      if (window.navigator && window.navigator.serviceWorker) {
        var registrations = await window.navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter(isChatbocRegistration)
            .map(function unregister(registration) {
              return registration.unregister();
            }),
        );
      }
    } catch (_error) {
      // Reload still helps when service-worker cleanup is unavailable.
    }

    try {
      if (window.caches) {
        var cacheNames = await window.caches.keys();
        await Promise.all(
          cacheNames
            .filter(function isPwaCache(cacheName) {
              return pwaCachePattern.test(cacheName);
            })
            .map(function removeCache(cacheName) {
              return window.caches.delete(cacheName);
            }),
        );
      }
    } catch (_error) {
      // Reload still helps when Cache Storage is unavailable.
    }

    var nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('__chatboc_refresh', String(Date.now()));
    nextUrl.searchParams.set('__chatboc_reason', String(reason || 'asset'));
    window.location.replace(nextUrl.toString());
    return true;
  }

  window.__CHATBOC_ASSET_RECOVERY__ = { recover: recover };

  window.addEventListener(
    'error',
    function handleAssetError(event) {
      var target = event && event.target;
      var assetUrl = target && (target.src || target.href);
      if (typeof assetUrl === 'string' && assetPattern.test(assetUrl)) {
        void recover('asset-load');
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', function handleChunkRejection(event) {
    var reason = event && event.reason;
    var message = reason && (reason.message || reason.name) ? String(reason.message || reason.name) : String(reason || '');
    if (chunkErrorPattern.test(message)) {
      void recover('chunk-load');
    }
  });

  // Vite emits this event when a hashed dynamic import disappeared during a
  // deployment cutover. Handle it directly because some browsers consume the
  // underlying promise rejection before the generic listener can observe it.
  window.addEventListener('vite:preloadError', function handleVitePreloadError(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    void recover('vite-preload');
  });

  window.setTimeout(function clearSuccessfulRecoveryGuard() {
    var root = window.document && window.document.getElementById('root');
    if (root && root.childElementCount > 0) {
      try {
        window.sessionStorage.removeItem(recoveryKey);
      } catch (_error) {
        // A successful app boot is enough; storage cleanup is optional.
      }
    }
  }, 5000);
})();
