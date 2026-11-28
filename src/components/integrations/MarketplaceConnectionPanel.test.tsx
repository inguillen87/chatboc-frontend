import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MarketplaceConnectionPanel, { type MarketplaceProviderStatus } from './MarketplaceConnectionPanel';

const row = (over: Partial<MarketplaceProviderStatus> = {}): MarketplaceProviderStatus => ({
  key: 'tiendanube', label: 'Tiendanube', configured: true, connected: false, needs_reconnect: false,
  needs_shop: false, account: null, last_sync_at: null, last_import: null,
  capabilities: ['catalogo', 'precios', 'stock', 'fotos'], ...over,
});
const status = (r: MarketplaceProviderStatus) => ({ providers: [r], upcoming: [{ key: 'amazon', label: 'Amazon' }] });

beforeEach(() => apiFetch.mockReset());

describe('MarketplaceConnectionPanel', () => {
  it('explains that an unconfigured provider is enabled by Chatboc and offers no connect button', () => {
    render(<MarketplaceConnectionPanel tenantSlug="mi" provider="tiendanube" status={status(row({ configured: false }))} onChanged={vi.fn()} />);
    expect(screen.getByText(/se habilita desde Chatboc/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Conectar/ })).toBeNull();
  });

  it('starts the connection and sends the merchant to the store', async () => {
    apiFetch.mockResolvedValue({ authorize_url: 'https://www.tiendanube.com/apps/1/authorize?state=x' });
    const navigate = vi.fn();
    render(<MarketplaceConnectionPanel tenantSlug="mi" provider="tiendanube" status={status(row())} onChanged={vi.fn()} navigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar con Tiendanube' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://www.tiendanube.com/apps/1/authorize?state=x'));
    expect(apiFetch.mock.calls[0][0]).toBe('/api/admin/tenants/mi/integrations/marketplaces/tiendanube/connect');
  });

  it('asks Shopify merchants for their store address first', () => {
    render(<MarketplaceConnectionPanel tenantSlug="mi" provider="shopify" status={status(row({ key: 'shopify', label: 'Shopify', needs_shop: true }))} onChanged={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Conectar con Shopify' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Dirección de tu tienda'), { target: { value: 'mitienda' } });
    expect(button.disabled).toBe(false);
  });

  it('previews the import with new and updated products before importing', async () => {
    apiFetch.mockResolvedValue({ found: 2, created: 1, updated: 1, skipped: 0, limited: false, preview: [
      { sku: 'A', nombre: 'Yerba mate 1 kg', precio: '5200', stock: 48, imagen_url: null, accion: 'actualizar' },
      { sku: 'B', nombre: 'Taza', precio: '3500', stock: null, imagen_url: null, accion: 'crear' },
    ] });
    render(<MarketplaceConnectionPanel tenantSlug="mi" provider="tiendanube" status={status(row({ connected: true, account: 'Tienda 55' }))} onChanged={vi.fn()} />);
    expect(screen.getByText('Conectado a Tienda 55')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver qué se importa' }));
    expect(await screen.findByText('Encontramos 2 productos: 1 nuevos y 1 para actualizar.')).toBeTruthy();
    expect(screen.getByText('Nuevo')).toBeTruthy();
    expect(apiFetch.mock.calls[0][1].body).toEqual({ dry_run: true });
  });

  it('asks for confirmation before disconnecting', async () => {
    apiFetch.mockResolvedValue({ disconnected: true });
    const onChanged = vi.fn();
    render(<MarketplaceConnectionPanel tenantSlug="mi" provider="tiendanube" status={status(row({ connected: true }))} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Tiendanube' }));
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
