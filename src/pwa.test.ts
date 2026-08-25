import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
}));

import { shouldAutoApplyPublicRefresh } from './pwa';

const setPath = (path: string) => {
  window.history.replaceState({}, '', path);
};

describe('public PWA refresh policy', () => {
  afterEach(() => setPath('/'));

  it.each([
    '/e/demo-gobierno-junin-prioridades-barriales?tenant_slug=junin',
    '/encuestas',
    '/encuestas/demo/qr',
  ])('auto-applies updates on public survey route %s', (path) => {
    setPath(path);
    expect(shouldAutoApplyPublicRefresh()).toBe(true);
  });

  it.each(['/admin/encuestas', '/t/junin/encuestas', '/portal/encuestas'])(
    'keeps the explicit update prompt on authenticated route %s',
    (path) => {
      setPath(path);
      expect(shouldAutoApplyPublicRefresh()).toBe(false);
    },
  );
});
