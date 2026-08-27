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

  it('auto-applies a waiting release on the profile shell without losing its deep link', () => {
    setPath('/perfil?tab=perfil&section=channels&setup=channels');
    expect(shouldAutoApplyPublicRefresh()).toBe(true);
    expect(window.location.search).toContain('section=channels');
  });

  it('still protects admin workspaces from an automatic refresh', () => {
    setPath('/admin/encuestas/632/editar');
    expect(shouldAutoApplyPublicRefresh()).toBe(false);
  });
});
