import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ code: 'A', fetch: vi.fn(), success: vi.fn(), error: vi.fn(), map: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ nro_pedido: mocks.code }) }));
vi.mock('@/api/market', () => ({ fetchPublicOrder: mocks.fetch }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/components/ui/TrackingMap', () => ({ default: (props: unknown) => { mocks.map(props); return <div>Mapa recibido</div>; } }));
import OrderTrackingPage from './OrderTrackingPage';
const response = (code = 'A', estado = 'confirmado') => ({ nro_pedido: code, estado, detalles: [], monto_total: 0, pyme_nombre: `Comercio ${code}`, tenant_slug: `org-${code.toLowerCase()}`, privacy: { pii_redacted: true } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; };
beforeEach(() => { mocks.code = 'A'; mocks.fetch.mockReset().mockResolvedValue(response()); mocks.success.mockReset(); mocks.error.mockReset(); mocks.map.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('public order lifecycle page', () => {
  it('shows payment as unavailable after delivery and avoids unsupported WhatsApp and real-time claims', async () => {
    mocks.fetch.mockResolvedValue(response('A', 'entregado')); render(<OrderTrackingPage />);
    await screen.findByRole('heading', { name: 'Pedido #A' });
    expect(screen.getByText('Pago no informado')).toBeVisible();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
    expect(screen.queryByText(/representante.*línea/i)).not.toBeInTheDocument();
    expect(mocks.map).not.toHaveBeenCalled();
  });
  it('never renders accidental PII or maps when the response says redacted', async () => {
    mocks.fetch.mockResolvedValue({ ...response(), nombre_cliente: 'Persona privada', direccion: 'Calle privada 999', telefono_cliente: '+54123456789', latitud: -32, longitud: -68, driver_location: { lat: -32, lng: -68 } });
    render(<OrderTrackingPage />); await screen.findByText('Comercio A');
    expect(screen.queryByText('Persona privada')).not.toBeInTheDocument(); expect(screen.queryByText('Calle privada 999')).not.toBeInTheDocument();
    expect(screen.queryByText('+54123456789')).not.toBeInTheDocument(); expect(mocks.map).not.toHaveBeenCalled();
  });
  it('clears old data on route changes and ignores late responses', async () => {
    const old = deferred<ReturnType<typeof response>>(); mocks.fetch.mockReturnValueOnce(old.promise);
    const view = render(<OrderTrackingPage />); mocks.code = 'B'; mocks.fetch.mockResolvedValueOnce(response('B')); view.rerender(<OrderTrackingPage />);
    await screen.findByText('Comercio B'); await act(async () => old.resolve(response('A')));
    expect(screen.queryByText('Comercio A')).not.toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Pedido #B' })).toBeVisible();
  });
  it('rejects a mismatched reference instead of displaying or supporting another order', async () => {
    mocks.fetch.mockResolvedValue(response('B')); render(<OrderTrackingPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos verificar');
    expect(screen.queryByText('Comercio B')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Abrir chat de soporte' })).not.toBeInTheDocument();
  });
  it('refreshes explicitly, clears a revoked response and never falls back to prior order data', async () => {
    render(<OrderTrackingPage />); await screen.findByText('Comercio A'); mocks.fetch.mockRejectedValueOnce({ status: 403 });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await screen.findByRole('alert'); expect(screen.queryByText('Comercio A')).not.toBeInTheDocument(); expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('opens support only with this organization and reference at the current origin', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {}); render(<OrderTrackingPage />); await screen.findByText('Comercio A');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir chat de soporte' }));
    expect(post).toHaveBeenCalledExactlyOnceWith({ type: 'OPEN_CHAT_WITH_CONTEXT', tenantSlug: 'org-a', tipoChat: 'pyme', context: { orderId: 'A', orderNumber: 'A', action: 'consultar_pedido' } }, window.location.origin);
    expect(mocks.fetch).toHaveBeenCalledOnce(); expect(mocks.success).not.toHaveBeenCalled();
  });
  it('announces clipboard failure instead of a false copy success', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    try {
      render(<OrderTrackingPage />); await screen.findByText('Comercio A'); fireEvent.click(screen.getByRole('button', { name: 'Copiar referencia' }));
      await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce()); expect(mocks.success).not.toHaveBeenCalled();
    } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else delete (navigator as unknown as { clipboard?: unknown }).clipboard; }
  });
});
