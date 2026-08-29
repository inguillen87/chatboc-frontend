import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CatalogManagementPage from './CatalogManagementPage';

const apiClientMock = vi.hoisted(() => ({
  adminGetCatalog: vi.fn(),
  adminListProducts: vi.fn(),
}));
const tenantContextMock = vi.hoisted(() => ({
  currentSlug: 'junin' as string | null,
  tenant: { slug: 'junin', rubro_slug: 'municipio' } as { slug: string; rubro_slug: string } | null,
}));

vi.mock('@/api/client', () => ({ apiClient: apiClientMock }));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => tenantContextMock,
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
    tenantContextMock.currentSlug = 'junin';
    tenantContextMock.tenant = { slug: 'junin', rubro_slug: 'municipio' };
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
    apiClientMock.adminListProducts.mockRejectedValue(new Error('item detail unavailable'));

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

    expect(await screen.findByTestId('catalog-summary-without-item-detail')).toHaveTextContent(
      'El resumen informa 5 registros de catálogo',
    );
    expect(metricValue('Ítems registrados').getByText('5')).toBeInTheDocument();
    expect(metricValue('Disponibilidad informada').getByText('5')).toBeInTheDocument();
    expect(metricValue('Stock sin validar').getByText('--')).toBeInTheDocument();
    expect(metricValue('Sin imagen').getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('No hay ítems disponibles con estos filtros.')).not.toBeInTheDocument();
    expect(screen.getByText(/Las fichas no están disponibles en esta lectura/)).toBeInTheDocument();
    expect(screen.getByText('Sin bloqueos técnicos reportados')).toBeInTheDocument();
    expect(screen.queryByText(/puede publicarse con el contrato actual/i)).not.toBeInTheDocument();
    expect(screen.getByText('Canal de promociones vinculado')).toBeInTheDocument();
    expect(screen.queryByText('/api/pymes/4/promociones')).not.toBeInTheDocument();
    expect(apiClientMock.adminListProducts).toHaveBeenCalledWith('junin');
  });

  it('loads item detail from the tenant-scoped endpoint after the summary contract', async () => {
    apiClientMock.adminGetCatalog.mockResolvedValue({
      contract_version: 'tenant.catalog_admin.v1',
      tenant_slug: 'junin',
      promotions: {
        create_endpoint: '/api/pymes/4/promociones',
        endpoint: '/api/pymes/4/promociones',
        items: [],
      },
    });
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
    expect(metricValue('Disponibilidad informada').getByText('1')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-summary-without-item-detail')).not.toBeInTheDocument();
  });

  it('uses the first finite price and never renders NaN from degraded legacy fields', async () => {
    apiClientMock.adminGetCatalog.mockResolvedValue({
      contract_version: 'tenant.catalog_admin.v1',
      tenant_slug: 'junin',
      promotions: { items: [] },
    });
    apiClientMock.adminListProducts.mockResolvedValue([
      {
        catalogo_item_id: 95,
        nombre: 'Precio recuperable',
        price_numeric: 'NaN',
        precio: '1250',
        currency: 'ARS',
        stock_status: 'in_stock',
      },
      {
        catalogo_item_id: 96,
        nombre: 'Precio no informado',
        price_numeric: 'NaN',
        precio: 'Consultar',
        currency: 'not-a-currency',
        stock_status: 'stock_unknown',
      },
    ]);

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

    expect(await screen.findByText('Precio recuperable')).toBeInTheDocument();
    expect(screen.getByText(/1\.250/)).toBeInTheDocument();
    expect(screen.getByText('Sin precio informado')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Min $'), { target: { value: '1' } });
    expect(screen.getByText('Precio recuperable')).toBeInTheDocument();
    expect(screen.queryByText('Precio no informado')).not.toBeInTheDocument();
  });

  it('fails closed when neither the summary nor a prior confirmed snapshot is available', async () => {
    apiClientMock.adminGetCatalog.mockRejectedValue(new Error('contract unavailable'));

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

    expect(await screen.findByTestId('catalog-load-error')).toHaveTextContent('Catálogo sin confirmar');
    expect(metricValue('Ítems registrados').getByText('--')).toBeInTheDocument();
    expect(metricValue('Disponibilidad informada').getByText('--')).toBeInTheDocument();
    expect(screen.queryByText('No hay ítems disponibles con estos filtros.')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('catalog-load-error')).getByText(/No se pudo confirmar el catálogo/)).toBeInTheDocument();
    expect(apiClientMock.adminListProducts).not.toHaveBeenCalled();
  });

  it('keeps a same-tenant confirmed snapshot visible and labels it stale after a refresh failure', async () => {
    apiClientMock.adminGetCatalog.mockResolvedValueOnce({
      contract_version: 'tenant.catalog_admin.v1',
      tenant_slug: 'junin',
      promotions: { items: [] },
    });
    apiClientMock.adminListProducts.mockResolvedValueOnce([
      {
        catalogo_item_id: 92,
        nombre: 'Luminaria LED',
        stock_quantity: 3,
        stock_status: 'in_stock',
        available_to_sell: true,
      },
    ]);

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);
    expect(await screen.findByText('Luminaria LED')).toBeInTheDocument();

    apiClientMock.adminGetCatalog.mockRejectedValueOnce(new Error('refresh unavailable'));
    fireEvent.click(screen.getByRole('button', { name: /recargar/i }));

    expect(await screen.findByTestId('catalog-load-error')).toHaveTextContent('Lectura desactualizada');
    expect(screen.getByText('Luminaria LED')).toBeInTheDocument();
    expect(metricValue('Ítems registrados').getByText('1')).toBeInTheDocument();
  });

  it('does not count an explicitly disabled item as available even when it has positive stock', async () => {
    apiClientMock.adminGetCatalog.mockResolvedValue({
      contract_version: 'tenant.catalog_admin.v1',
      tenant_slug: 'junin',
      promotions: { items: [] },
    });
    apiClientMock.adminListProducts.mockResolvedValue([
      {
        catalogo_item_id: 94,
        nombre: 'Servicio deshabilitado',
        stock_quantity: 20,
        stock_status: 'in_stock',
        available_to_sell: false,
      },
    ]);

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

    expect(await screen.findByText('Servicio deshabilitado')).toBeInTheDocument();
    expect(metricValue('Disponibilidad informada').getByText('0')).toBeInTheDocument();
  });

  it('keeps readiness neutral when the backend did not confirm ready or blockers', async () => {
    apiClientMock.adminGetCatalog.mockResolvedValue({
      contract_version: 'tenant.catalog_admin.v1',
      tenant_slug: 'junin',
      promotions: { items: [] },
      marketplace_readiness: {
        contract_version: 'tenant.marketplace_readiness.v1',
        metrics: {},
      },
    });
    apiClientMock.adminListProducts.mockResolvedValue([]);

    render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

    expect(await screen.findByText('Validación técnica incompleta')).toBeInTheDocument();
    expect(screen.queryByText('Sin bloqueos técnicos reportados')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sin verificar').length).toBeGreaterThan(0);
  });

  it('renders a descriptive readiness heading hierarchy without invalid paragraph nesting', async () => {
    apiClientMock.adminGetCatalog.mockResolvedValue({
      contract_version: 'tenant.catalog_admin.v1',
      tenant_slug: 'junin',
      promotions: { items: [] },
      marketplace_readiness: {
        contract_version: 'tenant.marketplace_readiness.v1',
        ready: true,
        score: 100,
        blockers: [],
        warnings: [],
        metrics: {},
      },
    });
    apiClientMock.adminListProducts.mockResolvedValue([]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);

      const panelHeading = await screen.findByRole('heading', { name: 'Preparación del marketplace' });
      const statusHeading = screen.getByRole('heading', { name: 'Sin bloqueos técnicos reportados' });
      expect(panelHeading.tagName).toBe('H2');
      expect(statusHeading.tagName).toBe('H3');
      expect(consoleError.mock.calls.flat().join(' ')).not.toContain('validateDOMNesting');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('clears the prior tenant and invalidates its pending request when the active tenant disappears', async () => {
    let resolveJuninSummary: (value: Record<string, unknown>) => void = () => undefined;
    const juninSummary = new Promise<Record<string, unknown>>((resolve) => {
      resolveJuninSummary = resolve;
    });
    apiClientMock.adminGetCatalog.mockImplementationOnce(() => juninSummary);

    const { rerender } = render(<CatalogManagementPage embedded />);
    tenantContextMock.currentSlug = null;
    tenantContextMock.tenant = null;
    rerender(<CatalogManagementPage embedded />);

    expect(await screen.findByTestId('catalog-load-error')).toHaveTextContent('No hay una organización seleccionada');

    await act(async () => {
      resolveJuninSummary({ contract_version: 'tenant.catalog_admin.v1', tenant_slug: 'junin' });
      await juninSummary;
    });

    expect(metricValue('Ítems registrados').getByText('--')).toBeInTheDocument();
    expect(apiClientMock.adminListProducts).not.toHaveBeenCalled();
  });

  it('ignores a late response from the previous tenant instead of leaking its catalog into the new scope', async () => {
    let resolveJuninSummary: (value: Record<string, unknown>) => void = () => undefined;
    const juninSummary = new Promise<Record<string, unknown>>((resolve) => {
      resolveJuninSummary = resolve;
    });
    apiClientMock.adminGetCatalog
      .mockImplementationOnce(() => juninSummary)
      .mockResolvedValueOnce({ contract_version: 'tenant.catalog_admin.v1', tenant_slug: 'rio-grande' });
    apiClientMock.adminListProducts.mockResolvedValueOnce([
      { catalogo_item_id: 93, nombre: 'Servicio Río Grande', stock_status: 'stock_unknown' },
    ]);

    const { rerender } = render(<CatalogManagementPage embedded tenantSlugOverride="junin" />);
    rerender(<CatalogManagementPage embedded tenantSlugOverride="rio-grande" />);

    expect(await screen.findByText('Servicio Río Grande')).toBeInTheDocument();

    await act(async () => {
      resolveJuninSummary({ contract_version: 'tenant.catalog_admin.v1', tenant_slug: 'junin' });
      await juninSummary;
    });

    expect(screen.queryByText(/Servicio Junín/)).not.toBeInTheDocument();
    expect(apiClientMock.adminListProducts).toHaveBeenCalledTimes(1);
    expect(apiClientMock.adminListProducts).toHaveBeenCalledWith('rio-grande');
  });
});
