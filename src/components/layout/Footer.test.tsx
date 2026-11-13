import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Footer from './Footer';

const scrollToSectionMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useScrollToSection', () => ({
  useScrollToSection: () => scrollToSectionMock,
}));

const tenantState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => tenantState.value }));

describe('Footer landing navigation', () => {
  it('targets the canonical Spanish landing anchors', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Qué hace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Planes' }));

    expect(scrollToSectionMock).toHaveBeenNthCalledWith(1, 'solucion');
    expect(scrollToSectionMock).toHaveBeenNthCalledWith(2, 'precios');
  });
});

describe('Footer en un espacio publicado', () => {
  it('muestra el pie del organismo y no el pie comercial de Chatboc', () => {
    tenantState.value = { hostBinding: null, tenant: { slug: 'Tierra-Del-Fuego', nombre: 'Tierra del Fuego', tipo: 'gobierno' } };
    render(<MemoryRouter initialEntries={['/t/tierra-del-fuego/noticias']}><Footer /></MemoryRouter>);

    expect(screen.getByRole('contentinfo', { name: 'Información del espacio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tierra del Fuego' })).toHaveAttribute('href', '/t/Tierra-Del-Fuego');
    expect(screen.getByRole('link', { name: 'Privacidad de la plataforma' })).toHaveAttribute('href', '/privacidad');
    expect(screen.queryByRole('button', { name: 'Planes' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Probar demo/)).not.toBeInTheDocument();
  });

  it('conserva el pie comercial si el espacio cargado no coincide con la ruta', () => {
    tenantState.value = { hostBinding: null, tenant: { slug: 'otro-espacio', nombre: 'Otro espacio' } };
    render(<MemoryRouter initialEntries={['/t/tierra-del-fuego']}><Footer /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Planes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toBeInTheDocument();
  });
});
