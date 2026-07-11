(function migrateStaleShells() {
  var migrationCache = 'chatboc-shell-migration-20260710-v1';

  self.addEventListener('activate', function activateRecovery(event) {
    event.waitUntil(
      (async function recoverOpenClients() {
        if (await self.caches.has(migrationCache)) {
          return;
        }

        var openClients = await self.clients.matchAll({
          includeUncontrolled: true,
          type: 'window',
        });

        await Promise.all(
          openClients.map(function refreshClient(client) {
            try {
              var nextUrl = new URL(client.url);
              if (nextUrl.origin !== self.location.origin) {
                return Promise.resolve();
              }
              nextUrl.searchParams.set('__chatboc_sw_refresh', '20260710-v1');
              return client.navigate(nextUrl.toString());
            } catch (_error) {
              return Promise.resolve();
            }
          }),
        );

        await self.caches.open(migrationCache);
      })(),
    );
  });
})();
