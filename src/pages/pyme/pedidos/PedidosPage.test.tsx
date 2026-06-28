import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/api/client';
import type { Order } from '@/types/unified';
import PedidosPage from './PedidosPage';

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    adminListOrders: vi.fn(),
    adminUpdateOrder: vi.fn(),
    adminCreateOrder: vi.fn(),
  },
}));

const mockAdminListOrders = vi.mocked(apiClient.adminListOrders);

const assistedOrder: Order = {
  id: 'assistida-1',
  total: 0,
  status: 'nuevo',
  created_at: '2026-06-28T12:00:00.000Z',
  items: [],
  customer_profile: {
    name: 'Marcelo',
    phone: '+5492613168608',
    email: 'marcelo@test.com',
  },
  assisted_request: {
    contract_version: 'marketplace.assisted_request.v1',
    mode: 'order_note_upload',
    crm_state: 'pending_operator_review',
    request_kind_label: 'Nota de pedido manuscrita',
    source: {
      channel: 'marketplace',
      text_preview: 'Foto manuscrita: clavos, chapas y tornillos para cotizar.',
    },
    match_summary: { detected: 3, matched: 1, unmatched: 2 },
    structured_extraction: {
      contract_version: 'marketplace.structured_extraction.v1',
      primary_intent: 'create_order_or_quote',
      fields: {
        resumen: 'clavos, chapas y tornillos',
      },
      missing_fields: ['direccion'],
    },
    unmatched_items: ['chapas', 'tornillos'],
    public_follow_up: {
      tracking: {
        code: 'pc-123',
        path: '/tracking/order/pc-123?tenant_slug=junin',
      },
    },
  },
};

const regularOrder: Order = {
  id: 'regular-2',
  total: 1200,
  status: 'nuevo',
  created_at: '2026-06-28T13:00:00.000Z',
  items: [{ id: 'vino', name: 'Vino malbec', price: 1200, quantity: 1 }],
};

describe('PedidosPage', () => {
  beforeEach(() => {
    mockAdminListOrders.mockReset();
    mockAdminListOrders.mockResolvedValue([assistedOrder, regularOrder]);
  });

  it('searches assisted marketplace requests by extracted text/contact and avoids fake shipping data', async () => {
    render(<PedidosPage />);

    expect(await screen.findByLabelText('Abrir pedido assistida-1')).toBeTruthy();
    expect(screen.getByLabelText('Abrir pedido regular-2')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Buscar por cliente, WhatsApp, item, seguimiento o texto IA...'), {
      target: { value: 'clavos' },
    });

    expect(screen.getByLabelText('Abrir pedido assistida-1')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir pedido regular-2')).toBeNull();
    expect(screen.getByText(/Foto manuscrita: clavos/)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Buscar por cliente, WhatsApp, item, seguimiento o texto IA...'), {
      target: { value: '+5492613168608' },
    });

    expect(screen.getByLabelText('Abrir pedido assistida-1')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Abrir pedido assistida-1'));

    await waitFor(() => expect(screen.getByText('Pedido #assistida-1')).toBeTruthy());
    expect(screen.queryByText('Av. Principal 1234, Local 5')).toBeNull();
    expect(screen.getByText(/No hay direccion ni metodo confirmado/)).toBeTruthy();
  });
});
