import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Exercise actual MemoryRouter navigation instead of the repository-wide useNavigate mock.
vi.unmock('react-router-dom');
import HeroSection from './HeroSection';

const LocationReadback = () => {
  const location = useLocation();
  return <output data-testid="cta-destination">{location.pathname}{location.search}</output>;
};
const mount = (primary: Record<string, string>, secondary: Record<string, string>) => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HeroSection experience={{ hero: { primary_cta: primary, secondary_cta: secondary } }} />
    <LocationReadback />
  </MemoryRouter>,
);

describe('Hero legacy CTA compatibility', () => {
  it('maps the exact legacy builder CTA pair to contact and demo separately', () => {
    // Exact CTA subset of builder fixture c24b9dbc5446ee883d2f3f17f0326e94e1047ba3cdbc9ebe0116d4e096c52a74.
    mount(
      { label: 'Probar una conversacion real', href: '/demo', intent: 'start_demo' },
      { label: 'Hablar con ventas', href: '/contacto', intent: 'sales_contact' },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar demostración' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/contacto$/);
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/demo$/);
  });

  it('recognizes only the known legacy wording across accent and casing variants', () => {
    mount(
      { label: 'Probar una conversación real', href: '/demo' },
      { label: 'HABLAR CON VENTAS', href: '/contacto' },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar demostración' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/contacto$/);
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/demo$/);
  });

  it('preserves modern custom labels and their explicitly declared targets', () => {
    mount(
      { label: 'Solicitar demostración', href: '/contacto?source=enterprise' },
      { label: 'Ver recorrido', href: '/demo?sector=educacion' },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar demostración' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/contacto\?source=enterprise$/);
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/demo\?sector=educacion$/);
  });

  it('does not classify a custom label merely containing a legacy phrase as legacy', () => {
    mount(
      { label: 'Probar una conversación real personalizada', href: '/demo?source=custom' },
      { label: 'Hablar con ventas del equipo', href: '/contacto?team=custom' },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Probar una conversación real personalizada' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/demo\?source=custom$/);
    fireEvent.click(screen.getByRole('button', { name: 'Hablar con ventas del equipo' }));
    expect(screen.getByTestId('cta-destination')).toHaveTextContent(/^\/contacto\?team=custom$/);
  });
});
