import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppAccessibility } from '@/components/app-shell/AppAccessibility';

vi.mock('@/components/chat/AccessibilityToggle', () => ({
  default: ({ className }: { className?: string }) => (
    <button type="button" className={className}>Accesibilidad</button>
  ),
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

  it('does not apply the focused layout to regular application routes', () => {
    renderAt('/admin/encuestas');

    expect(screen.getByRole('region', { name: 'Accesibilidad de la plataforma' })).not.toHaveClass(
      'chatboc-a11y-dock--focused-public',
    );
  });
});
