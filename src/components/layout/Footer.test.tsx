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
  const tdf = { slug: 'Tierra-Del-Fuego', nombre: 'Tierra del Fuego', tipo: 'gobierno' };
  const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><Footer /></MemoryRouter>);
  const expectNeutral = () => {
    expect(screen.getByRole('contentinfo', { name: 'Información del espacio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacidad de la plataforma' })).toHaveAttribute('href', '/privacidad');
    expect(screen.queryByRole('link', { name: 'Tierra del Fuego' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Otro espacio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Planes' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Probar demo/)).not.toBeInTheDocument();
  };

  it('muestra el pie del organismo con identidad vigente y no el pie comercial', () => {
    tenantState.value = { hostBinding: null, currentSlug: 'tierra-del-fuego', isLoadingTenant: false, tenantError: null, tenant: tdf };
    renderAt('/t/tierra-del-fuego/noticias');

    expect(screen.getByRole('link', { name: 'Tierra del Fuego' })).toHaveAttribute('href', '/t/Tierra-Del-Fuego');
    expect(screen.getByRole('link', { name: 'Términos de la plataforma' })).toHaveAttribute('href', '/terminos');
    expect(screen.queryByRole('button', { name: 'Planes' })).not.toBeInTheDocument();
  });

  it.each([
    ['carga con el organismo anterior retenido', { currentSlug: 'tierra-del-fuego', isLoadingTenant: true, tenantError: null, tenant: { slug: 'otro-espacio', nombre: 'Otro espacio' } }],
    ['carga con el mismo organismo retenido', { currentSlug: 'tierra-del-fuego', isLoadingTenant: true, tenantError: null, tenant: tdf }],
    ['error con el organismo retenido', { currentSlug: 'tierra-del-fuego', isLoadingTenant: false, tenantError: 'Perfil no disponible', tenant: tdf }],
    ['organismo cargado distinto de la ruta', { currentSlug: 'tierra-del-fuego', isLoadingTenant: false, tenantError: null, tenant: { slug: 'otro-espacio', nombre: 'Otro espacio' } }],
    ['selección vigente distinta de la ruta', { currentSlug: 'otro-espacio', isLoadingTenant: false, tenantError: null, tenant: tdf }],
    ['sin organismo', { currentSlug: null, isLoadingTenant: false, tenantError: null, tenant: null }],
  ])('queda neutral en /t durante %s', (_case, state) => {
    tenantState.value = { hostBinding: null, ...state };
    renderAt('/t/tierra-del-fuego');
    expectNeutral();
  });

  it('conserva el pie de dominio propio y el pie comercial fuera de /t', () => {
    tenantState.value = { hostBinding: { tenant: { nombre: 'Municipio propio' }, paths: { home: '/' } }, currentSlug: 'tierra-del-fuego', isLoadingTenant: true, tenantError: null, tenant: null };
    const own = renderAt('/t/tierra-del-fuego');
    expect(screen.getByRole('link', { name: 'Municipio propio' })).toHaveAttribute('href', '/');
    own.unmount();

    tenantState.value = { hostBinding: null, currentSlug: 'tierra-del-fuego', isLoadingTenant: false, tenantError: null, tenant: tdf };
    renderAt('/precios');
    expect(screen.getByRole('button', { name: 'Planes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toBeInTheDocument();
  });
});
