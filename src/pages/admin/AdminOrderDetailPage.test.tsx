import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/api/client';
import { ApiError } from '@/utils/api';
import type { Order } from '@/types/unified';
import AdminOrderDetailPage from './AdminOrderDetailPage';

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'conversational:42' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/api/client', () => ({
  apiClient: {
    adminGetOrder: vi.fn(),
    adminListOrders: vi.fn(),
    adminUpdateOrder: vi.fn(),
    getFulfillmentConfig: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockAdminGetOrder = vi.mocked(apiClient.adminGetOrder);
const mockAdminUpdateOrder = vi.mocked(apiClient.adminUpdateOrder);
const mockGetFulfillmentConfig = vi.mocked(apiClient.getFulfillmentConfig);
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

const renderDetail = () =>
  render(
    <MemoryRouter>
      <AdminOrderDetailPage />
    </MemoryRouter>,
  );

const assistedOrder: Order = {
  id: 'conversational:42',
  status: 'nuevo',
  total: 0,
  created_at: '2026-07-01T12:00:00.000Z',
  items: [],
  customer_profile: {
    name: 'Marcelo',
    phone: '+5492613168608',
    email: 'marcelo@test.com',
  },
  crm_review_card: {
    contract_version: 'marketplace.crm_review_card.v1',
    status: 'needs_review',
    operational_state: 'needs_catalog_resolution',
    needs_operator_review: true,
    summary: { detected: 2, matched: 1, unmatched: 1 },
    contact: { name: 'Marcelo', phone: '+5492613168608' },
    catalog_candidates: [
      {
        item: 'Chapas',
        candidates: [
          {
            catalogo_item_id: 77,
            nombre: 'Chapa galvanizada',
            sku: 'CH-77',
            precio: 12000,
            score: 0.88,
          },
        ],
      },
    ],
  },
  assisted_request: {
    contract_version: 'marketplace.assisted_request.v1',
    source_contract_version: 'whatsapp.assisted_intake.v1',
    mode: 'order_note_upload',
    crm_state: 'pending_operator_review',
    request_kind_label: 'nota de pedido',
    contact: { name: 'Marcelo', phone: '+5492613168608' },
    source: { channel: 'whatsapp', text_preview: '2 clavos y 4 chapas' },
    match_summary: { detected: 2, matched: 1, unmatched: 1 },
    unmatched_items: ['Chapas'],
    catalog_candidates: [
      {
        item: 'Chapas',
        candidates: [
          {
            catalogo_item_id: 77,
            nombre: 'Chapa galvanizada',
            sku: 'CH-77',
            precio: 12000,
            score: 0.88,
          },
        ],
      },
    ],
    crm_order_draft: {
      contract_version: 'marketplace.crm_order_draft.v1',
      reference: 'pedido:42',
      needs_operator_review: true,
      recommended_next_step: 'resolver_items_y_confirmar',
      summary: { detected: 2, matched: 1, unmatched: 1 },
      customer_confirmation: {
        blocking_reasons: [
          {
            id: 'items_need_review',
            label: 'Hay articulos para revisar',
            description: 'Algunos renglones siguen sin asociarse al catalogo.',
          },
        ],
      },
      lines: [
        { line_id: 'line-1', status: 'catalog_matched', source_name: 'Clavos', quantity: 2, catalog_match: { name: 'Clavos 2 pulgadas' } },
        { line_id: 'line-2', status: 'needs_catalog_resolution', source_name: 'Chapas', quantity: 4, candidate_count: 1 },
      ],
    },
  },
};

describe('AdminOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetFulfillmentConfig.mockResolvedValue({ tenant: {} } as any);
    mockAdminGetOrder.mockResolvedValue(assistedOrder);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('resolves assisted catalog candidates from the full admin detail', async () => {
    mockAdminUpdateOrder.mockResolvedValue({
      ...assistedOrder,
      assisted_request: {
        ...assistedOrder.assisted_request,
        crm_state: 'ready_for_confirmation',
        match_summary: { detected: 2, matched: 2, unmatched: 0 },
      },
    } as Order);

    renderDetail();

    expect(await screen.findByText('Borrador de pedido armado')).toBeInTheDocument();
    expect(screen.getAllByText('Hay articulos para revisar').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /vincular/i }));

    await waitFor(() => {
      expect(mockAdminUpdateOrder).toHaveBeenCalledWith('junin', 'conversational:42', {
        catalog_resolutions: [
          {
            line_id: 'line-2',
            source_name: 'Chapas',
            catalog_item_id: '77',
          },
        ],
      });
    });
  });

  it('renders backend blockers when confirm returns assisted_order_needs_review', async () => {
    const readyOrder: Order = {
      ...assistedOrder,
      assisted_request: {
        ...assistedOrder.assisted_request,
        crm_state: 'ready_for_confirmation',
        match_summary: { detected: 2, matched: 2, unmatched: 0 },
        crm_order_draft: {
          ...assistedOrder.assisted_request!.crm_order_draft!,
          needs_operator_review: false,
          summary: { detected: 2, matched: 2, unmatched: 0 },
          customer_confirmation: { blocking_reasons: [] },
        },
      },
      crm_review_card: {
        ...assistedOrder.crm_review_card,
        status: 'ready_to_reply',
        operational_state: 'ready_for_order_creation',
        needs_operator_review: false,
        summary: { detected: 2, matched: 2, unmatched: 0 },
      },
    };
    mockAdminGetOrder.mockResolvedValue(readyOrder);
    mockAdminUpdateOrder.mockRejectedValue(
      new ApiError('needs review', 409, {
        error: 'assisted_order_needs_review',
        blocking_reasons: [{ code: 'line_needs_review', message: 'Hay renglones del pedido que todavia no estan resueltos.' }],
      }),
    );

    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: /crear pedido operativo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cambio de estado' }));

    expect(await screen.findByText('Antes de confirmar')).toBeInTheDocument();
    expect(screen.getByText('Hay renglones del pedido que todavia no estan resueltos.')).toBeInTheDocument();
  });
  it('does not cancel or confirm an order when the operator closes the review', async () => {
    mockAdminGetOrder.mockResolvedValue({ ...assistedOrder, status: 'confirmed', assisted_request: undefined, crm_review_card: undefined });
    mockAdminUpdateOrder.mockReset(); renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: /marcar enviado/i }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('conversational:42');
    fireEvent.click(screen.getByRole('button', { name: 'Volver sin cambiar' }));
    expect(mockAdminUpdateOrder).not.toHaveBeenCalled();
  });

});
