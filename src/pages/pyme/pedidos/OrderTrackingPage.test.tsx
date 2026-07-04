import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrderTrackingPage from './OrderTrackingPage';

const fetchPublicOrderMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ nro_pedido: 'PED-PUBLIC-1' }),
  };
});

vi.mock('@/api/market', () => ({
  fetchPublicOrder: (...args: unknown[]) => fetchPublicOrderMock(...args),
}));

vi.mock('@/components/ui/Confetti', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/TrackingMap', () => ({
  default: () => <div data-testid="tracking-map" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/pyme/pedidos/PED-PUBLIC-1']}>
      <Routes>
        <Route path="/pyme/pedidos/:nro_pedido" element={<OrderTrackingPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('OrderTrackingPage public privacy contract', () => {
  beforeEach(() => {
    fetchPublicOrderMock.mockReset();
  });

  it('renders redacted public tracking data without private contact fields', async () => {
    fetchPublicOrderMock.mockResolvedValue({
      contract_version: 'public.order_tracking.v1',
      privacy: {
        public_payload: true,
        pii_redacted: true,
        redacted_fields: ['telefono_cliente', 'direccion', 'latitud', 'longitud'],
      },
      tracking_id: 'PED-PUBLIC-1',
      nro_pedido: 'PED-PUBLIC-1',
      estado: 'confirmado',
      asunto: 'Pedido sensible',
      monto_total: 12000,
      fecha_creacion: '2026-07-03T12:00:00.000Z',
      nombre_cliente: 'Ma***',
      email_cliente: null,
      telefono_cliente: null,
      direccion: 'Direccion registrada',
      delivery_summary: 'Direccion registrada',
      latitud: null,
      longitud: null,
      detalles: [
        {
          nombre_producto: 'Caja Malbec',
          cantidad: 1,
          precio_unitario_original: 12000,
          subtotal_con_descuento: 12000,
          moneda: 'ARS',
        },
      ],
      pyme_nombre: 'Bodega Publica',
      tenant_slug: 'bodega-publica',
    });

    renderPage();

    expect(fetchPublicOrderMock).toHaveBeenCalledWith('PED-PUBLIC-1');
    expect(await screen.findByText('Bodega Publica')).toBeInTheDocument();
    expect(screen.getByText('Direccion registrada')).toBeInTheDocument();
    expect(screen.getByText('Contacto protegido')).toBeInTheDocument();
    expect(
      screen.getByText(/detalle exacto queda disponible solo en el portal/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Don Bosco/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+5492611111111/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/marcelo@example\.com/i)).not.toBeInTheDocument();
  });
});
