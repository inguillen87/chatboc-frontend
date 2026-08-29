import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CatalogManagementPage from './CatalogManagementPage';

const apiClientMock = vi.hoisted(() => ({
  adminGetCatalog: vi.fn(),
  adminListProducts: vi.fn(),
  adminListPromotions: vi.fn(),
}));

vi.mock('@/api/client', () => ({ apiClient: apiClientMock }));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    currentSlug: 'junin',
    tenant: { slug: 'junin', rubro_slug: 'municipio' },
  }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: { id: 4, rubro: 'municipio' } }),
}));

vi.mock('@/components/admin/CatalogQualityCommandCenter', () => ({
  default: () => <div data-testid="catalog-quality-command-center" />,
}));

vi.mock('@/components/admin/catalog/CatalogUploadWizard', () => ({
  default: () => <div />,
}));

vi.mock('@/components/admin/catalog/ProductImageManager', () => ({
  default: () => null,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const metricValue = (label: string) => {
  const labelNode = screen.getAllByText(label)[0];
  const card = labelNode.closest('[data-slot="card"]') || labelNode.parentElement?.parentElement;
  if (!card) throw new Error(`No se encontro la tarjeta ${label}`);
  return within(card as HTMLElement);
};

describe('CatalogManagementPage catalog truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClientMock.adminListPromotions.mockResolvedValue([]);
  });

  it('uses tenant-scoped readiness metrics instead of inventing an empty catalog', async () => {
    apiClientMock.adminGetCatalog.mockResolvedValue({
      contract_version: 'tenant.catalog_admin.v1',
      tenant_slug: 'junin',
      request_id: 'req-catalog-truth',
      promotions: { endpoint: '/api/pymes/4/promociones', items: [] },
      marketplace_readiness: {
        contract_version: 'tenant.marketplace_readiness.v1',
        ready: true,
        score: 92,
        blockers: [],
        warnings: [],
        metrics: {
          products_total: 5,
          products_available: 5,
          products_with_images: 5,
          products_with_prices: 5,
          products_with_promotions: 5,
          low_stock: 0,
          checkout_configured: false,
        },
      },
    });

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

    expect(await screen.findByTestId('catalog-summary-without-item-detail')).toHaveTextContent(
      'La organización tiene 5 registros de catálogo',
    );
    expect(metricValue('Ítems registrados').getByText('5')).toBeInTheDocument();
    expect(metricValue('Disponibles').getByText('5')).toBeInTheDocument();
    expect(metricValue('Stock sin validar').getByText('--')).toBeInTheDocument();
    expect(metricValue('Sin imagen').getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('No hay ítems disponibles con estos filtros.')).not.toBeInTheDocument();
    expect(screen.getByText(/Las fichas aún no están disponibles en esta vista/)).toBeInTheDocument();
    expect(screen.getByText('Sin bloqueos técnicos reportados')).toBeInTheDocument();
    expect(screen.queryByText(/puede publicarse con el contrato actual/i)).not.toBeInTheDocument();
    expect(screen.getByText('Canal de promociones vinculado')).toBeInTheDocument();
    expect(screen.queryByText('/api/pymes/4/promociones')).not.toBeInTheDocument();
    expect(apiClientMock.adminListProducts).not.toHaveBeenCalled();
    await waitFor(() => expect(apiClientMock.adminListPromotions).toHaveBeenCalledWith(4, 'junin'));
  });

  it('keeps the legacy item list as detail only when the admin contract is unavailable', async () => {
    apiClientMock.adminGetCatalog.mockRejectedValue(new Error('contract unavailable'));
    apiClientMock.adminListProducts.mockResolvedValue([
      {
        catalogo_item_id: 91,
        nombre: 'Servicio municipal',
        precio: 0,
        stock_status: 'in_stock',
        available_to_sell: true,
        imagen_url: 'https://example.com/item.png',
      },
    ]);

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

    expect(await screen.findByText('Servicio municipal')).toBeInTheDocument();
    expect(metricValue('Ítems registrados').getByText('1')).toBeInTheDocument();
    expect(metricValue('Disponibles').getByText('1')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-summary-without-item-detail')).not.toBeInTheDocument();
  });
});
