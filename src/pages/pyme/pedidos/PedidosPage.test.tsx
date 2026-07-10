import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { apiClient } from '@/api/client';
import type { AdminOrdersResponse, Order } from '@/types/unified';
import PedidosPage from './PedidosPage';

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    adminListOrders: vi.fn(),
    adminListOrdersWithSummary: vi.fn(),
    adminUpdateOrder: vi.fn(),
    adminCreateOrder: vi.fn(),
  },
}));

const mockAdminListOrders = vi.mocked(apiClient.adminListOrders);
const mockAdminListOrdersWithSummary = vi.mocked(apiClient.adminListOrdersWithSummary);
const mockAdminUpdateOrder = vi.mocked(apiClient.adminUpdateOrder);

const renderPedidosPage = (initialEntry = '/pedidos') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PedidosPage />
    </MemoryRouter>,
  );

const ordersEnvelope = (
  orders: Order[],
  overrides: Partial<AdminOrdersResponse> = {},
): AdminOrdersResponse => ({
  orders,
  count: orders.length,
  total: orders.length,
  sources: ['PedidoConversacional'],
  summary: null,
  ...overrides,
});

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
    operational_state: 'needs_catalog_resolution',
    primary_action_id: 'confirm_order_draft',
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
    catalog_candidates: [
      {
        item: 'Chapas',
        candidates: [
          {
            catalogo_item_id: 77,
            nombre: 'Chapa galvanizada',
            sku: 'CH-77',
            precio: 12000,
            confidence: 'medium',
            score: 0.82,
          },
        ],
      },
    ],
    suggested_reply: 'Hola Marcelo, recibimos tu nota y revisamos stock y precio.',
    operator_actions: [
      {
        id: 'confirm_order_draft',
        label: 'Revisar y confirmar',
        type: 'status_transition',
        target_status: 'confirmed',
        enabled: true,
        requires_review: true,
        creates: ['pyme_pedido', 'market_order'],
        description: 'Materializa la nota en pedido operativo cuando los datos estan validados.',
      },
      {
        id: 'resolve_catalog_candidates',
        label: 'Resolver catalogo',
        type: 'catalog_resolution',
        enabled: true,
        requires_review: true,
        description: 'Vincula los renglones dudosos con productos reales.',
      },
    ],
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
    catalog_candidates: [
      {
        item: 'Chapas',
        candidates: [
          {
            catalogo_item_id: 77,
            nombre: 'Chapa galvanizada',
            sku: 'CH-77',
            precio: 12000,
            confidence: 'medium',
            score: 0.82,
          },
        ],
      },
    ],
    crm_order_draft: {
      lines: [
        { line_id: 'l1', status: 'catalog_matched', source_name: 'Clavos', quantity: 2, catalog_match: { name: 'Clavos punta paris' } },
        { line_id: 'l2', status: 'needs_catalog_resolution', source_name: 'Chapas', quantity: 4 },
      ],
    },
    public_follow_up: {
      tracking: {
        code: 'pc-123',
        path: '/tracking/order/pc-123?tenant_slug=junin&token=signed-token-123',
        token: 'signed-token-123',
        token_required: true,
        access: 'signed_link',
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

const readyAssistedOrder: Order = {
  id: 'ready-3',
  total: 34000,
  status: 'nuevo',
  created_at: '2026-06-28T14:00:00.000Z',
  items: [{ id: 'malbec', name: 'Caja Malbec', price: 17000, quantity: 2 }],
  crm_review_card: {
    contract_version: 'marketplace.crm_review_card.v1',
    reference: 'pedido:ready-3',
    request_kind_label: 'Pedido asistido',
    status: 'ready_to_reply',
    priority: 'normal',
    needs_operator_review: false,
    operational_state: 'ready_for_order_creation',
    primary_action_id: 'confirm_order_draft',
    recommended_next_step: 'Confirmar pedido con el cliente',
    summary: { detected: 1, matched: 1, unmatched: 0 },
    source: {
      channel: 'whatsapp',
      text_preview: 'Cliente pide 2 cajas de malbec.',
    },
    lines: [
      { line_id: 'l1', status: 'catalog_matched', source_name: 'Caja Malbec', quantity: 2 },
    ],
    operator_actions: [
      {
        id: 'confirm_order_draft',
        label: 'Crear pedido',
        type: 'status_transition',
        target_status: 'confirmed',
        enabled: true,
        requires_review: false,
        creates: ['pyme_pedido', 'market_order'],
        description: 'Materializa la solicitud como pedido operativo.',
      },
    ],
  },
  assisted_request: {
    contract_version: 'marketplace.assisted_request.v1',
    mode: 'order_note_upload',
    crm_state: 'ready_for_confirmation',
    request_kind_label: 'Pedido asistido',
    source: {
      channel: 'whatsapp',
      text_preview: 'Cliente pide 2 cajas de malbec.',
    },
    match_summary: { detected: 1, matched: 1, unmatched: 0 },
    crm_order_draft: {
      lines: [
        { line_id: 'l1', status: 'catalog_matched', source_name: 'Caja Malbec', quantity: 2 },
      ],
    },
  },
};

const failedAssistedOrder: Order = {
  id: 'manual-4',
  total: 0,
  status: 'nuevo',
  created_at: '2026-06-28T15:00:00.000Z',
  items: [],
  crm_review_card: {
    contract_version: 'marketplace.crm_review_card.v1',
    reference: 'pedido:manual-4',
    request_kind_label: 'Nota manuscrita',
    status: 'ai_unavailable',
    priority: 'normal',
    needs_operator_review: false,
    recommended_next_step: 'Revisar manualmente el archivo y pedir datos faltantes',
    summary: { detected: 0, matched: 0, unmatched: 0 },
    source: {
      channel: 'marketplace',
      input_type: 'jpg',
      text_preview: 'Imagen manuscrita con baja legibilidad.',
      extraction_error: 'provider_unavailable',
      provider_status: 'failed',
    },
    row_errors: ['No se pudo leer la nota de pedido'],
    lines: [],
  },
  assisted_request: {
    contract_version: 'marketplace.assisted_request.v1',
    mode: 'order_note_upload',
    crm_state: 'manual_review',
    request_kind_label: 'Nota manuscrita',
    source: {
      channel: 'marketplace',
      text_preview: 'Imagen manuscrita con baja legibilidad.',
      extraction_error: 'provider_unavailable',
      provider_status: 'failed',
    },
    match_summary: { detected: 0, matched: 0, unmatched: 0 },
    row_errors: ['No se pudo leer la nota de pedido'],
    crm_order_draft: {
      lines: [],
    },
  },
};

describe('PedidosPage', () => {
  beforeEach(() => {
    mockAdminListOrders.mockReset();
    mockAdminListOrdersWithSummary.mockReset();
    mockAdminUpdateOrder.mockReset();
    mockAdminListOrders.mockResolvedValue([assistedOrder, regularOrder]);
    mockAdminListOrdersWithSummary.mockResolvedValue(ordersEnvelope([assistedOrder, regularOrder]));
    mockAdminUpdateOrder.mockResolvedValue(assistedOrder);
  });

  it('opens assisted commerce deep links with the operational filter and detail ready', async () => {
    renderPedidosPage('/perfil?tab=orders&focus=assisted&channel=marketplace&q=clavos');

    expect(await screen.findByTestId('orders-operational-focus')).toBeTruthy();
    expect(screen.getByText('Vista operativa aplicada')).toBeTruthy();
    expect(screen.getByText('Canal: Marketplace')).toBeTruthy();
    expect(screen.getByText('Busqueda: clavos')).toBeTruthy();
    expect(screen.getByText('1 visibles')).toBeTruthy();

    expect(screen.getByLabelText('Abrir pedido assistida-1')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir pedido regular-2')).toBeNull();

    await waitFor(() => expect(screen.getByText('Pedido #assistida-1')).toBeTruthy());
    expect(screen.getAllByText('Revisar en CRM').length).toBeGreaterThan(0);
  });

  it('searches assisted marketplace requests by extracted text/contact and avoids fake shipping data', async () => {
    renderPedidosPage();

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
    const reviewConfirmButton = screen.getByRole('button', { name: /Revisar y confirmar/i }) as HTMLButtonElement;
    expect(reviewConfirmButton).toBeTruthy();
    expect(reviewConfirmButton.disabled).toBe(true);
    expect(screen.queryByText('Av. Principal 1234, Local 5')).toBeNull();
    expect(screen.getByText(/No hay direccion ni metodo confirmado/)).toBeTruthy();
    expect(screen.getByText('Ficha CRM operativa')).toBeTruthy();
    expect(screen.getAllByText('pedido:assistida-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hola Marcelo, recibimos tu nota/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('crm-operator-actions')).toBeTruthy();
    expect(screen.getByText('Acciones operativas')).toBeTruthy();
    expect(screen.getAllByText('Resolver catalogo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resolver catalogo').length).toBeGreaterThan(1);
    expect(screen.getByText('Crea pyme pedido')).toBeTruthy();
    expect(screen.getByText('Crea market order')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Ejecutar accion' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Vincular Chapas con Chapa galvanizada' }));
    await waitFor(() =>
      expect(mockAdminUpdateOrder).toHaveBeenCalledWith('junin', 'assistida-1', {
        catalog_resolutions: [{ line_id: 'l2', source_name: 'Chapas', catalog_item_id: '77' }],
      }),
    );
  });

  it('renders crm_review_card summaries without requiring assisted_request data', async () => {
    renderPedidosPage();

    expect(await screen.findByLabelText('Abrir pedido regular-2')).toBeTruthy();
    expect(screen.getAllByText('Resumen CRM').length).toBeGreaterThan(0);
    expect(screen.getByText(/Cliente mayorista pide validar stock/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Abrir pedido regular-2'));

    await waitFor(() => expect(screen.getByText('Pedido #regular-2')).toBeTruthy());
    expect(screen.getAllByText('Revision requerida').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Validar stock y responder/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stock sensible').length).toBeGreaterThan(0);
  });

  it('does not count partial or failed assisted requests as ready for confirmation', async () => {
    mockAdminListOrdersWithSummary.mockResolvedValueOnce(ordersEnvelope([readyAssistedOrder, failedAssistedOrder]));

    renderPedidosPage();

    expect(await screen.findByLabelText('Abrir pedido ready-3')).toBeTruthy();
    expect(screen.getByLabelText('Abrir pedido manual-4')).toBeTruthy();

    const readyCard = screen.getByRole('button', { name: 'Filtrar solicitudes IA listas para confirmar' });
    expect(within(readyCard).getByText('1')).toBeTruthy();

    const reviewCard = screen.getByRole('button', { name: 'Filtrar solicitudes IA para revisar' });
    expect(within(reviewCard).getByText('1')).toBeTruthy();

    expect(screen.getByText('IA lista')).toBeTruthy();
    expect(screen.getByText('Revisar')).toBeTruthy();
    expect(screen.getByText('Revisión manual')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Abrir pedido ready-3'));
    await waitFor(() => expect(screen.getByText('Pedido #ready-3')).toBeTruthy());
    const createButton = screen.getByRole('button', { name: 'Crear pedido' }) as HTMLButtonElement;
    expect(createButton).toBeTruthy();
    expect(createButton.disabled).toBe(false);
    expect(screen.getByTestId('crm-operator-actions')).toBeTruthy();
    expect(screen.getByText('Listo para crear pedido')).toBeTruthy();

    fireEvent.click(readyCard);

    expect(screen.getByLabelText('Abrir pedido ready-3')).toBeTruthy();
    expect(screen.queryByLabelText('Abrir pedido manual-4')).toBeNull();
  });

  it('renders backend operational summary metrics for assisted orders', async () => {
    mockAdminListOrdersWithSummary.mockResolvedValueOnce(
      ordersEnvelope([assistedOrder, readyAssistedOrder], {
        total: 25,
        sources: ['PedidoConversacional', 'MarketOrder'],
        summary: {
          contract_version: 'orders.unified_summary.v1',
          total: 25,
          assisted_requests: 6,
          needs_operator_review: 3,
          ready_for_order_creation: 2,
          ready_to_reply: 1,
          by_channel: { whatsapp: 4, marketplace: 2 },
          by_source_model: { PedidoConversacional: 6, MarketOrder: 19 },
          latest_activity_at: '2026-06-28T14:15:00.000Z',
          crm_focus: {
            has_assisted_intake: true,
            has_operator_review_queue: true,
            has_ready_order_creation: true,
            primary_next_action: 'create_orders_from_assisted_requests',
          },
        },
      }),
    );

    renderPedidosPage();

    const summary = await screen.findByTestId('orders-operational-summary');
    expect(within(summary).getByText('Operacion IA')).toBeTruthy();
    expect(within(summary).getByText('orders.unified_summary.v1')).toBeTruthy();
    expect(within(summary).getByText('Crear pedidos desde IA')).toBeTruthy();
    expect(within(summary).getByText('25')).toBeTruthy();
    expect(within(summary).getByText('3')).toBeTruthy();
    expect(within(summary).getByText('2')).toBeTruthy();
    expect(within(summary).getByText('1')).toBeTruthy();
    expect(within(summary).getByText(/Canales: WhatsApp, Marketplace/)).toBeTruthy();
    expect(within(summary).getByText(/Fuentes: PedidoConversacional, MarketOrder/)).toBeTruthy();

    expect(within(screen.getByRole('button', { name: 'Filtrar solicitudes IA' })).getByText('6')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: 'Filtrar solicitudes IA para revisar' })).getByText('3')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: 'Filtrar solicitudes IA listas para confirmar' })).getByText('2')).toBeTruthy();
  });

  it('opens an authenticated assisted upload workspace for operator intake', async () => {
    renderPedidosPage();

    expect(await screen.findByLabelText('Abrir pedido assistida-1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Cargar nota con IA/i }));

    expect(screen.getByText('Cargar solicitud asistida')).toBeTruthy();
    expect(screen.getByText(/la transforme en caso CRM/i)).toBeTruthy();
    expect(screen.getByText('Operador autenticado')).toBeTruthy();
    expect(screen.getByTestId('assisted-upload-dropzone')).toBeTruthy();
  });
});
