(function clearLegacySensitiveRuntimeCaches() {
  var privacyContractCache = 'chatboc-pwa-contract-api-network-only-v1';
  var legacySensitiveCaches = {
    'app-api': true,
    'public-api': true,
    'public-demo-api': true,
  };

  function removeLegacySensitiveCaches() {
    return self.caches.keys().then(function removeSensitiveCaches(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function isSensitiveLegacyCache(cacheName) {
            return legacySensitiveCaches[cacheName] === true;
          })
          .map(function removeCache(cacheName) {
            return self.caches.delete(cacheName).catch(function ignoreDeleteFailure() {
              return false;
            });
          }),
      );
    });
  }

  self.addEventListener('install', function installPrivacyContract(event) {
    // Only the upgrade from the legacy URL-keyed API cache contract may bypass
    // the normal prompt. Fresh installs have no active worker; subsequent
    // updates find this versioned marker and keep waiting for user consent.
    if (!self.registration.active) return;

    event.waitUntil(
      Promise.resolve()
        .then(function checkPrivacyContract() {
          return self.caches.has(privacyContractCache);
        })
        .then(function forceLegacyPrivacyUpgrade(contractAlreadyActive) {
          if (contractAlreadyActive) return undefined;
          return removeLegacySensitiveCaches()
            .catch(function ignoreInstallCleanupFailure() {
              return undefined;
            })
            .then(function activateNetworkOnlyWorker() {
              return self.skipWaiting();
            });
        })
        // Cache Storage failure must not leave the privacy update waiting
        // indefinitely behind the legacy worker.
        .catch(function forceUpgradeWithoutCacheStorage() {
          return self.skipWaiting();
        }),
    );
  });

  self.addEventListener('activate', function activateCacheHygiene(event) {
    event.waitUntil(
      Promise.resolve()
        .then(removeLegacySensitiveCaches)
        .then(function markPrivacyContractWhenCleanupCompleted() {
          return self.caches.keys().then(function verifySensitiveCachesRemoved(cacheNames) {
            var hasLegacySensitiveCache = cacheNames.some(function isSensitiveLegacyCache(cacheName) {
              return legacySensitiveCaches[cacheName] === true;
            });

            if (hasLegacySensitiveCache) {
              return undefined;
            }

            return self.caches.open(privacyContractCache);
          });
        })
        // Cache Storage may be unavailable in strict browser modes. Hygiene
        // must never hold the worker in `activating`.
        .catch(function ignoreCacheStorageFailure() {
          return undefined;
        }),
    );
  });
})();
