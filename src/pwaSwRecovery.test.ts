import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const recoverySource = readFileSync(path.resolve(process.cwd(), 'public/sw-recovery.js'), 'utf8');

describe('service worker shell migration', () => {
  it('refreshes open clients once and records the migration', async () => {
    let activateHandler: ((event: { waitUntil: (promise: Promise<void>) => void }) => void) | undefined;
    let activationPromise: Promise<void> | undefined;
    const navigate = vi.fn(async () => undefined);
    const open = vi.fn(async () => ({}));
    const cacheState = { migrated: false };

    const serviceWorker: any = {
      caches: {
        has: vi.fn(async () => cacheState.migrated),
        open: vi.fn(async (name: string) => {
          cacheState.migrated = true;
          return open(name);
        }),
      },
      clients: {
        matchAll: vi.fn(async () => [
          { navigate, url: 'https://www.chatboc.ar/login?from=old-shell' },
        ]),
      },
      location: { origin: 'https://www.chatboc.ar' },
      addEventListener: (name: string, handler: typeof activateHandler) => {
        if (name === 'activate') activateHandler = handler;
      },
    };

    vm.runInNewContext(recoverySource, {
      Promise,
      URL,
      self: serviceWorker,
    });

    expect(activateHandler).toBeTypeOf('function');
    activateHandler?.({ waitUntil: (promise) => { activationPromise = promise; } });
    await activationPromise;

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate.mock.calls[0][0]).toContain('__chatboc_sw_refresh=20260710-v1');
    expect(serviceWorker.caches.open).toHaveBeenCalledWith('chatboc-shell-migration-20260710-v1');
  });
});
