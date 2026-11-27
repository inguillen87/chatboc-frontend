import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppAccessibility } from '@/components/app-shell/AppAccessibility';

const tenantState = vi.hoisted((): { hostBinding: null | { tenant: { slug: string } } } => ({ hostBinding: null }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => tenantState }));

vi.mock('@/components/chat/AccessibilityToggle', () => ({
  default: ({ className }: { className?: string }) => (
    <button type="button" className={className}>Accesibilidad</button>
  ),
  ACCESSIBILITY_INTENT_EVENT: 'chatboc:a11y-user-intent',
  DEFAULT_ACCESSIBILITY_PREFS: { dyslexia: false, simplified: true, highContrast: false, largeControls: false, captions: false, reducedMotion: false },
  applyAccessibilityPrefs: vi.fn(),
  persistAccessibilityPrefs: vi.fn(),
  readAccessibilityPrefs: vi.fn(() => ({})),
}));

const renderAt = (pathname: string) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppAccessibility />
    </MemoryRouter>,
  );

describe('AppAccessibility focused public routes', () => {
  beforeEach(() => { tenantState.hostBinding = null; });

  it.each([
    '/demo?sector=gobierno',
    '/demo/institucional/tdf-discapacidad',
    '/e/demo-gobierno-junin-participa-prioridades-barriales',
  ])('keeps the accessibility control out of the mobile header on %s', (pathname) => {
    renderAt(pathname);

    expect(screen.getByRole('region', { name: 'Accesibilidad de la plataforma' })).toHaveClass(
      'chatboc-a11y-dock--focused-public',
    );
  });

  it.each([
    '/t/tierra-del-fuego',
    '/t/Tierra-del-Fuego/',
    '/t/tierra-del-fuego/noticias',
    '/t/tierra-del-fuego/eventos',
    '/t/tierra-del-fuego/reclamos/nuevo',
    '/t/tierra-del-fuego/encuestas',
    '/t/tierra-del-fuego/encuestas/consulta-publica',
  ])('leaves the platform dock out when the public portal owns a visible bar on %s', (pathname) => {
    renderAt(pathname);

    expect(screen.queryByRole('region', { name: 'Accesibilidad de la plataforma' })).not.toBeInTheDocument();
  });

  it.each(['/t/tierra-del-fuego/admin/knowledge', '/admin/encuestas', '/'])(
    'keeps the usual placement outside the public portal on %s', (pathname) => {
      renderAt(pathname);

      expect(screen.getByRole('region', { name: 'Accesibilidad de la plataforma' })).toBeInTheDocument();
    },
  );

  it('leaves the dock out on the verified organization host root', () => {
    tenantState.hostBinding = { tenant: { slug: 'tierra-del-fuego' } };
    renderAt('/');

    expect(screen.queryByRole('region', { name: 'Accesibilidad de la plataforma' })).not.toBeInTheDocument();
  });

  it('does not apply the focused layout to regular application routes', () => {
    renderAt('/admin/encuestas');

    expect(screen.getByRole('region', { name: 'Accesibilidad de la plataforma' })).not.toHaveClass(
      'chatboc-a11y-dock--focused-public',
    );
  });

  it.each(['/portal/dashboard', '/t/junin/portal/reclamos', '/junin/portal/catalogo'])(
    'applies the portal header layout class on %s',
    (pathname) => {
      renderAt(pathname);

      const dock = screen.getByRole('region', { name: 'Accesibilidad de la plataforma' });
      expect(dock).toHaveClass('chatboc-a11y-dock--portal');
      expect(dock).not.toHaveClass('chatboc-a11y-dock--focused-public');
    },
  );
});
