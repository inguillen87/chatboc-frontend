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
    avatar_url: 'https://cdn.example.com/profile/marcelo.webp',
    avatar_source: 'profile_upload',
    avatar_consent: true,
    profile_picture_consent: true,
    avatar_policy: 'consented_upload_or_social_only',
    identity: {
      display_name: 'Marcelo',
      avatar_url: 'https://cdn.example.com/profile/marcelo.webp',
      avatar_source: 'profile_upload',
      avatar_consent: true,
      fallback: 'deterministic_identity_avatar',
    },
  },
  crm_review_card: {
    contract_version: 'marketplace.crm_review_card.v1',
    reference: 'pedido:assistida-1',
    request_kind_label: 'Nota de pedido manuscrita',
    status: 'needs_review',
    priority: 'high',
    needs_operator_review: true,
    recommended_next_step: 'resolver_faltantes_y_responder',
    summary: { detected: 3, matched: 1, unmatched: 2 },
    source: {
      channel: 'marketplace',
      input_type: 'jpg',
      text_preview: 'Foto manuscrita: clavos, chapas y tornillos para cotizar.',
    },
    contact: {
      name: 'Marcelo',
      phone: '+5492613168608',
      email: 'marcelo@test.com',
    },
    lines: [
      { line_id: 'l1', status: 'catalog_matched', source_name: 'Clavos', quantity: 2, catalog_match: { name: 'Clavos punta paris' } },
      { line_id: 'l2', status: 'needs_catalog_resolution', source_name: 'Chapas', quantity: 4 },
    ],
    unmatched_items: ['chapas', 'tornillos'],
    suggested_reply: 'Hola Marcelo, recibimos tu nota y revisamos stock y precio.',
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
  crm_review_card: {
    contract_version: 'marketplace.crm_review_card.v1',
    reference: 'pedido:regular-2',
    request_kind_label: 'Resumen CRM',
    status: 'needs_review',
    priority: 'high',
    needs_operator_review: true,
    recommended_next_step: 'Validar stock y responder por WhatsApp',
    summary: { detected: 1, matched: 1, unmatched: 0 },
    source: {
      channel: 'whatsapp',
      text_preview: 'Cliente mayorista pide validar stock antes de confirmar.',
    },
    contact: {
      name: 'Cliente mayorista',
      phone: '+5492613000000',
    },
    lines: [
      { line_id: 'l1', status: 'catalog_matched', source_name: 'Vino malbec', quantity: 1 },
    ],
    suggested_reply: 'Cliente mayorista pide validar stock antes de confirmar.',
    suggested_tasks: [
      { id: 'stock', label: 'Stock sensible', description: 'Confirmar disponibilidad antes de responder.', tone: 'warning' },
    ],
  },
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
    expect(screen.getAllByTitle(/Marcelo - Avatar con imagen consentida/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Abrir pedido assistida-1'));

    await waitFor(() => expect(screen.getByText('Pedido #assistida-1')).toBeTruthy());
    expect(screen.getAllByTitle(/Marcelo - Avatar con imagen consentida/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText('Revisar en CRM').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Revisar y confirmar/i })).toBeTruthy();
    expect(screen.queryByText('Av. Principal 1234, Local 5')).toBeNull();
    expect(screen.getByText(/No hay direccion ni metodo confirmado/)).toBeTruthy();
    expect(screen.getByText('Ficha CRM operativa')).toBeTruthy();
    expect(screen.getAllByText('pedido:assistida-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hola Marcelo, recibimos tu nota/).length).toBeGreaterThan(0);
  });

  it('renders crm_review_card summaries without requiring assisted_request data', async () => {
    render(<PedidosPage />);

    expect(await screen.findByLabelText('Abrir pedido regular-2')).toBeTruthy();
    expect(screen.getAllByText('Resumen CRM').length).toBeGreaterThan(0);
    expect(screen.getByText(/Cliente mayorista pide validar stock/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Abrir pedido regular-2'));

    await waitFor(() => expect(screen.getByText('Pedido #regular-2')).toBeTruthy());
    expect(screen.getAllByText('Revision requerida').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Validar stock y responder/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stock sensible').length).toBeGreaterThan(0);
  });
});
