import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch: api.fetch }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: 'alpha' }) }));
vi.unmock('lucide-react');
vi.mock('@/utils/currency', () => ({ formatCurrency: (value: number) => `ARS ${value}` }));
import OrderConfirmationPage from './OrderConfirmation';
const open = (url = '/resultado?pedido_id=42&status=approved') => render(<MemoryRouter initialEntries={[url]}><OrderConfirmationPage /></MemoryRouter>);

describe('checkout confirmation uses only the authorized server response', () => {
  beforeEach(() => { api.fetch.mockReset(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('does not trust approved in the URL when the server returns pending', async () => {
    api.fetch.mockResolvedValue({ id: 42, estado: 'pendiente_pago', total: 100, items: [] });
    open();
    await screen.findAllByText('Pago pendiente de acreditación');
    expect(screen.queryByText('Pago acreditado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a consultar' })).toBeEnabled();
    expect(screen.queryByText('Total en puntos')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin handoff informado')).not.toBeInTheDocument();
  });
  it('does not invent approval when verification fails', async () => {
    api.fetch.mockRejectedValue(new Error('provider failed'));
    open();
    await screen.findByText('La verificación no se completó');
    expect(screen.queryByText('Pago acreditado')).not.toBeInTheDocument();
  });
  it('rejects a response for another order', async () => {
    api.fetch.mockResolvedValue({ id: 99, estado: 'paid', total: 100, items: [] });
    open();
    await screen.findByText('La verificación no se completó');
    expect(screen.queryByText('Pago acreditado')).not.toBeInTheDocument();
  });
  it('provides a working retry and verifies the new response', async () => {
    api.fetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 42, estado: 'paid', total: 100, items: [] });
    open();
    await screen.findByText('La verificación no se completó');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar' }));
    await screen.findAllByText('Pago acreditado');
    expect(api.fetch).toHaveBeenCalledTimes(2);
  });
  it('does not multiply an existing line subtotal by quantity again', async () => {
    api.fetch.mockResolvedValue({ id: 42, estado: 'paid', items: [{ nombre: 'Producto', cantidad: 2, precio_unitario: 10, subtotal_monetario: 20 }] });
    open();
    await waitFor(() => expect(screen.getByText('Total en dinero').parentElement).toHaveTextContent('ARS 20'));
  });
  it('does not request anything without the order identifier', async () => {
    open('/resultado?status=approved');
    await screen.findByText('Identificador faltante');
    expect(api.fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Pago acreditado')).not.toBeInTheDocument();
  });
});
