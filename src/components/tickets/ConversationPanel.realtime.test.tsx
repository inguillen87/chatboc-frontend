import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResponseTemplate } from '@/features/tickets/responseTemplatesApi';
import type { Ticket } from '@/types/tickets';
import {
  buildConversationDraftStorageKey,
  readConversationDraft,
} from './conversationDraftStorage';

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: vi.fn(() => 'blob:ticket-evidence-preview'),
});
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: vi.fn(),
});

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => void>(),
  getTicketMessages: vi.fn(),
  getTicketTimeline: vi.fn(),
  getOmnichannelInboxDetailV2: vi.fn(),
  listResponseTemplates: vi.fn(),
  previewResponseTemplateForTicket: vi.fn(),
  suggestResponseTemplates: vi.fn(),
  sendMessage: vi.fn(),
  postOmnichannelInboxActionV2: vi.fn(),
  requestTicketHistoryEmail: vi.fn(),
  updateTicketReadState: vi.fn(),
  updateTicketStatus: vi.fn(),
  updateTicket: vi.fn(),
  refreshTickets: vi.fn(),
  user: { id: 10, name: 'Admin', rol: 'admin', tenant_slug: 'junin' } as Record<string, unknown>,
  selectedTicket: null as Ticket | null,
  socket: null as null | {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  },
}));

harness.socket = {
  connected: true,
  emit: vi.fn(),
  off: vi.fn((event: string, handler: (payload: unknown) => void) => {
    if (harness.handlers.get(event) === handler) harness.handlers.delete(event);
  }),
  on: vi.fn((event: string, handler: (payload: unknown) => void) => {
    harness.handlers.set(event, handler);
  }),
};

const selectedTicket: Ticket = {
  id: 77,
  tipo: 'municipio',
  nro_ticket: 'CRM-77',
  asunto: 'Caso TenantTicket',
  estado: 'en_proceso',
  fecha: '2026-08-20T12:00:00Z',
  categoria: 'alumbrado',
  channel: 'whatsapp',
  source_model: 'TenantTicket',
  tenant_slug: 'junin',
};
harness.selectedTicket = selectedTicket;

const tenantReplyAction = {
  id: 'reply',
  label: 'Responder',
  endpoint: '/api/v2/inbox/omnichannel/77/actions',
  method: 'POST',
  requires: ['body', 'client_message_id_or_idempotency_key'],
  idempotency: {
    contract_version: 'inbox.reply_idempotency.v1',
    preferred_header: 'Idempotency-Key',
    body_field: 'client_message_id',
    retry_rule: 'reuse_same_value',
  },
  delivery_mode: 'durable_queue_or_provider_acceptance',
  external_dispatch: true,
};

const tenantAuthoritativeItem = {
  id: '77',
  legacy_id: 77,
  source_model: 'TenantTicket',
  allowed_actions: [tenantReplyAction],
  actions: [tenantReplyAction],
};

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: harness.socket }),
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => ({
    selectedTicket: harness.selectedTicket,
    updateTicket: harness.updateTicket,
    refreshTickets: harness.refreshTickets,
  }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: harness.user }),
}));

vi.mock('@/features/tickets/responseTemplatesApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/tickets/responseTemplatesApi')>(
    '@/features/tickets/responseTemplatesApi',
  );
  return {
    ...actual,
    listResponseTemplates: (...args: unknown[]) => harness.listResponseTemplates(...args),
    previewResponseTemplateForTicket: (...args: unknown[]) =>
      harness.previewResponseTemplateForTicket(...args),
    suggestResponseTemplates: (...args: unknown[]) => harness.suggestResponseTemplates(...args),
  };
});

vi.mock('@/hooks/useSpeechRecognition', () => ({
  default: () => ({
    supported: false,
    listening: false,
    transcript: '',
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('@/api/v2/saas', async () => {
  const actual = await vi.importActual<typeof import('@/api/v2/saas')>('@/api/v2/saas');
  return {
    ...actual,
    getOmnichannelInboxDetailV2: (...args: unknown[]) =>
      harness.getOmnichannelInboxDetailV2(...args),
    postOmnichannelInboxActionV2: (...args: unknown[]) =>
      harness.postOmnichannelInboxActionV2(...args),
  };
});

vi.mock('@/services/ticketService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/ticketService');
  return {
    ...actual,
    getTicketMessages: (...args: unknown[]) => harness.getTicketMessages(...args),
    getTicketTimeline: (...args: unknown[]) => harness.getTicketTimeline(...args),
    sendMessage: (...args: unknown[]) => harness.sendMessage(...args),
    requestTicketHistoryEmail: (...args: unknown[]) => harness.requestTicketHistoryEmail(...args),
    updateTicketStatus: (...args: unknown[]) => harness.updateTicketStatus(...args),
    updateTicketReadState: (...args: unknown[]) => harness.updateTicketReadState(...args),
  };
});

vi.mock('./CaseStrip', () => ({ default: () => null }));
vi.mock('./TicketClaimButton', () => ({ default: () => null }));
vi.mock('./ChatMessage', () => ({
  default: ({ message }: { message: { text?: string } }) => <div>{message.text}</div>,
}));
vi.mock('./DetailsPanel', () => ({ default: () => null }));
vi.mock('../ui/ScrollToBottomButton', () => ({ default: () => null }));
vi.mock('../ui/AdjuntarArchivo', () => ({
  default: ({
    onFileSelected,
    disabled,
  }: {
    onFileSelected: (file: File) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      aria-label="Adjuntar archivo"
      disabled={disabled}
      onClick={() => onFileSelected(new File(['evidencia'], 'evidencia.jpg', { type: 'image/jpeg' }))}
    >
      Adjuntar
    </button>
  ),
}));

import ConversationPanel, {
  createComposerActionAttemptKey,
  shouldShowTicketClaimAction,
  TENANT_TICKET_INVALIDATION_DEBOUNCE_MS,
} from './ConversationPanel';

let queryClient: QueryClient;

const renderConversation = (operationalWorkspace = false, isDetailsVisible = false) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <ConversationPanel
        isMobile={false}
        isSidebarVisible
        isDetailsVisible={isDetailsVisible}
        onToggleSidebar={vi.fn()}
        onToggleDetails={vi.fn()}
        desktopView="chat"
        operationalWorkspace={operationalWorkspace}
      />
    </MemoryRouter>
  </QueryClientProvider>
);

const openComposerTools = async () => {
  const trigger = screen.getByRole('button', { name: 'Herramientas de respuesta' });
  act(() => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  });
  const menu = await screen.findByRole('menu', { name: 'Herramientas de respuesta' });
  return { trigger, menu };
};

describe('ConversationPanel tenant invalidation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    vi.mocked(URL.createObjectURL).mockClear();
    vi.mocked(URL.revokeObjectURL).mockClear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    harness.handlers.clear();
    harness.selectedTicket = selectedTicket;
    harness.user = { id: 10, name: 'Admin', rol: 'admin', tenant_slug: 'junin' };
    harness.getTicketMessages.mockReset().mockResolvedValue([]);
    harness.getTicketTimeline.mockReset().mockResolvedValue({
      messages: [],
      realtime_state: null,
      unified_conversation_stream: [],
    });
    harness.getOmnichannelInboxDetailV2.mockReset().mockResolvedValue({
      item: tenantAuthoritativeItem,
      raw: {},
    });
    harness.postOmnichannelInboxActionV2.mockReset().mockResolvedValue({
      action: 'reply',
      delivery: {
        contract_version: 'inbox.action_delivery.v2',
        mode: 'durable_queue',
        delivery_mode: 'durable_queue',
        status: 'durably_staged',
        evidence_stage: 'durably_staged',
        outbox: { durably_staged: true },
        operator_message: 'Respuesta en cola; entrega final pendiente de callback.',
      },
      ticket: tenantAuthoritativeItem,
      raw: { action: 'reply' },
    });
    harness.updateTicketReadState.mockReset().mockResolvedValue(null);
    const responseTemplate: ResponseTemplate = {
      id: 'template-1',
      tenantId: 4,
      tenantSlug: 'junin',
      scope: 'tenant',
      name: 'Seguimiento operativo',
      text: 'El caso fue asignado al equipo operativo.',
      keywords: [],
      isActive: true,
    };
    harness.listResponseTemplates.mockReset().mockResolvedValue([responseTemplate]);
    harness.suggestResponseTemplates.mockReset().mockResolvedValue([
      { ...responseTemplate, score: 0.9 },
    ]);
    harness.previewResponseTemplateForTicket.mockReset().mockResolvedValue({
      renderedText: 'Respuesta renderizada para CRM-77.',
      templateId: responseTemplate.id,
      ticketId: 77,
      sourceModel: 'TenantTicket',
    });
    harness.sendMessage.mockReset();
    harness.requestTicketHistoryEmail.mockReset().mockResolvedValue({ status: 'sent' });
    harness.updateTicketStatus.mockReset().mockResolvedValue({
      estado: 'en_vivo',
      next_states: ['en_proceso', 'resuelto'],
      workflow: {
        contract_version: 'ticket.workflow.instance.v2',
        current_state: 'en_vivo',
        canonical_state: 'en_vivo',
        next_states: ['en_proceso', 'resuelto'],
        can_transition: true,
        final_state: false,
      },
    });
    harness.updateTicket.mockReset();
    harness.refreshTickets.mockReset().mockResolvedValue(undefined);
    harness.socket?.emit.mockClear();
    harness.socket?.off.mockClear();
    harness.socket?.on.mockClear();
    if (harness.socket) harness.socket.connected = true;
  });

  it('shows the authoritative SLA summary in the visible conversation header', async () => {
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({
      item: {
        ...tenantAuthoritativeItem,
        sla: {
          contract_version: 'ticket.sla.v1',
          clocks: {
            first_response: {
              state: 'breached',
              status: 'overdue',
              due_at: '2026-08-30T10:00:00Z',
              known: true,
            },
          },
        },
      },
      raw: {},
    });

    render(renderConversation(true));

    const slaSummary = await screen.findByTestId('ticket-sla-clocks-compact');
    expect(slaSummary).toHaveTextContent('Respuesta vencida');
    expect(slaSummary).toHaveAttribute('data-sla-state', 'overdue');
  });

  it('changes the idempotent attempt identity when the authoritative action semantics change', () => {
    const baseAction = {
      id: 'share_location',
      label: 'Ubicación',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      idempotency: { contract_version: 'inbox.reply_idempotency.v1' },
    };
    const first = createComposerActionAttemptKey('junin:MunicipioTicket:419', baseAction, {
      source_model: 'MunicipioTicket',
      legacy_id: 419,
      location: { address: 'Plaza departamental' },
    });

    expect(createComposerActionAttemptKey('junin:MunicipioTicket:419', baseAction, {
      location: { address: 'Plaza departamental' },
      legacy_id: 419,
      source_model: 'MunicipioTicket',
    })).toBe(first);
    expect(createComposerActionAttemptKey('junin:MunicipioTicket:419', {
      ...baseAction,
      endpoint: '/api/v2/inbox/omnichannel/419/actions',
    }, {
      source_model: 'MunicipioTicket',
      legacy_id: 419,
      location: { address: 'Plaza departamental' },
    })).not.toBe(first);
    expect(createComposerActionAttemptKey('junin:MunicipioTicket:419', {
      ...baseAction,
      idempotency: { contract_version: 'inbox.reply_idempotency.v2' },
    }, {
      source_model: 'MunicipioTicket',
      legacy_id: 419,
      location: { address: 'Plaza departamental' },
    })).not.toBe(first);
    expect(createComposerActionAttemptKey('junin:MunicipioTicket:419', baseAction, {
      source_model: 'MunicipioTicket',
      legacy_id: 420,
      location: { address: 'Plaza departamental' },
    })).not.toBe(first);
  });

  it('mantiene la toma en el header solamente cuando el inspector no está visible', () => {
    expect(shouldShowTicketClaimAction(false)).toBe(true);
    expect(shouldShowTicketClaimAction(true)).toBe(false);
  });

  it('offers only API-published state transitions and applies the confirmed workflow', async () => {
    harness.selectedTicket = {
      ...selectedTicket,
      next_states: ['en_vivo', 'resuelto'],
      workflow: {
        contract_version: 'ticket.workflow.instance.v2',
        current_state: 'en_proceso',
        canonical_state: 'en_proceso',
        next_states: ['en_vivo', 'resuelto'],
        can_transition: true,
        final_state: false,
      },
    };
    render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cambiar estado' }), {
      key: 'Enter',
      code: 'Enter',
    });

    expect(await screen.findByRole('menuitem', { name: 'En vivo' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Resuelto' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Nuevo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'En proceso' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'En vivo' }));

    await waitFor(() => expect(harness.updateTicketStatus).toHaveBeenCalledWith(
      77,
      'municipio',
      'en_vivo',
      expect.objectContaining({
        ticket: expect.objectContaining({ id: 77, estado: 'en_proceso' }),
        expectedStatus: 'en_proceso',
      }),
    ));
    expect(harness.updateTicket).toHaveBeenCalledWith(77, expect.objectContaining({
      estado: 'en_vivo',
      next_states: ['en_proceso', 'resuelto'],
    }));
    expect(harness.requestTicketHistoryEmail).not.toHaveBeenCalled();
  });

  it('refreshes the ticket instead of keeping an optimistic state after a 409 conflict', async () => {
    harness.selectedTicket = {
      ...selectedTicket,
      next_states: ['en_vivo'],
      workflow: {
        contract_version: 'ticket.workflow.instance.v2',
        current_state: 'en_proceso',
        canonical_state: 'en_proceso',
        next_states: ['en_vivo'],
        can_transition: true,
        final_state: false,
      },
    };
    harness.updateTicketStatus.mockRejectedValueOnce(
      Object.assign(new Error('conflict'), { status: 409 }),
    );
    render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cambiar estado' }), {
      key: 'Enter',
      code: 'Enter',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'En vivo' }));

    await waitFor(() => expect(harness.refreshTickets).toHaveBeenCalledTimes(1));
    expect(harness.updateTicket).not.toHaveBeenCalled();
  });

  it('preserves a final state and renders no selector for impossible transitions', async () => {
    harness.selectedTicket = {
      ...selectedTicket,
      estado: 'resuelto',
      next_states: [],
      workflow: {
        contract_version: 'ticket.workflow.instance.v2',
        current_state: 'resuelto',
        canonical_state: 'cerrado',
        next_states: [],
        can_transition: false,
        final_state: true,
        blocked_reason: 'ticket_final_state',
      },
    };
    render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: 'Sin transiciones de estado disponibles' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cambiar estado' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Resuelto').length).toBeGreaterThan(0);
  });

  it('keeps technical transport labels and ticket identifiers out of the operational workspace header', async () => {
    render(renderConversation(true));

    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Conversación ciudadana')).toBeInTheDocument();
    expect(screen.queryByText('Realtime activo')).not.toBeInTheDocument();
    expect(screen.queryByText('Fallback polling')).not.toBeInTheDocument();
    expect(screen.queryByText('CRM-77')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Más acciones del caso' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('keeps the enterprise ticket composer visible and labels real versus blocked actions', async () => {
    render(renderConversation(true));

    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId('ticket-reply-footer')).toHaveClass('sticky', 'bottom-0');
    expect(screen.getByTestId('ticket-composer')).toHaveAccessibleName('Respuesta desde el ticket');
    expect(screen.getByTestId('ticket-composer-channel-status')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-composer-sync-status')).toHaveTextContent('Socket conectado');
    expect(screen.getByTestId('ticket-composer-sync-status')).not.toHaveTextContent('En vivo');
    expect(screen.queryByRole('button', { name: 'Adjuntar archivo' })).not.toBeInTheDocument();

    const { trigger, menu } = await openComposerTools();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(within(menu).getByTestId('tenant-attachment-block-reason')).toHaveTextContent(
      'no publicó un contrato seguro de adjuntos para este ticket',
    );
    expect(within(menu).getByRole('menuitem', { name: /Adjuntar archivo.*No disponible/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const locationItem = within(menu).getByRole('menuitem', { name: /Ubicación.*No disponible/i });
    expect(locationItem).toHaveAttribute('aria-disabled', 'true');
    expect(locationItem).toHaveAccessibleName(
      'Ubicación. No disponible: Este ticket no publicó una acción backend compatible para compartir ubicación.',
    );
    expect(within(menu).getByRole('menuitem', { name: /Formulario.*No disponible/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(menu).getByRole('menuitem', { name: /Derivar a humano.*No disponible/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    act(() => {
      locationItem.focus();
      fireEvent.keyDown(locationItem, { key: 'Enter' });
    });
    expect(screen.getByRole('menu', { name: 'Herramientas de respuesta' })).toBeVisible();
    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();

    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Herramientas de respuesta' })).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('consumes reply_contract.v1 while keeping CRM save distinct from provider delivery', async () => {
    const replyContract = {
      contract_version: 'inbox.reply_contract.v1',
      source_model: 'TenantTicket',
      ticket_id: '77',
      channel: 'whatsapp',
      endpoint: '/api/v2/inbox/omnichannel/77/actions',
      method: 'POST',
      enabled: true,
      supported_message_types: {
        text: { enabled: true },
        attachment: { enabled: false, reason_code: 'attachment_reply_not_supported' },
        location: { enabled: false, reason_code: 'location_reply_not_supported' },
        form: { enabled: false, reason_code: 'form_reply_not_supported' },
      },
      delivery_channels: [
        { id: 'crm', enabled: true },
        { id: 'whatsapp', enabled: false, reason_code: 'contact_phone_missing' },
      ],
      handoff: { enabled: false, reason_code: 'handoff_not_supported' },
    };
    const item = {
      ...tenantAuthoritativeItem,
      reply_contract: replyContract,
      allowed_actions: [
        tenantReplyAction,
        { id: 'attach_file', label: 'Adjuntar archivo', enabled: false, disabled: true, reason_code: 'attachment_reply_not_supported' },
        { id: 'share_location', label: 'Compartir ubicación', enabled: false, disabled: true, reason_code: 'location_reply_not_supported' },
        { id: 'send_form', label: 'Enviar formulario', enabled: false, disabled: true, reason_code: 'form_reply_not_supported' },
      ],
    };
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({ item, raw: { item } });
    harness.postOmnichannelInboxActionV2.mockResolvedValue({
      action: 'reply',
      delivery: {
        contract_version: 'inbox.action_delivery.v2',
        evidence: {
          contract_version: 'inbox.reply_delivery_evidence.v1',
          saved_in_crm: true,
          dispatch_attempted: true,
          provider_accepted: true,
          delivered: false,
          failed: false,
          delivered_requires: 'provider_status_callback',
        },
      },
      ticket: item,
      raw: {},
    });

    render(renderConversation(true));
    expect(await screen.findByTestId('ticket-composer-channel-status')).toHaveTextContent('Sólo registro en CRM');
    expect(screen.getByTestId('ticket-composer-channel-status')).toHaveTextContent('teléfono verificable');

    const { menu } = await openComposerTools();
    expect(within(menu).getByTestId('tenant-attachment-block-reason')).toHaveTextContent(
      'marcó el adjunto como no disponible',
    );
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Herramientas de respuesta' })).not.toBeInTheDocument());

    fireEvent.change(screen.getByRole('textbox', { name: 'Responder ticket' }), {
      target: { value: 'Respuesta auditada.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByTestId('ticket-composer-action-result')).toHaveTextContent('Aceptado por el proveedor');
    expect(screen.getByTestId('ticket-composer-action-result')).toHaveTextContent('no prueba la entrega');
    expect(screen.queryByText('Entrega confirmada')).not.toBeInTheDocument();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('loads the authoritative M-419 contract and records one internal handoff without replying or dispatching WhatsApp', async () => {
    const m419Ticket: Ticket = {
      id: 419,
      tipo: 'municipio',
      nro_ticket: 'M-419',
      asunto: 'Demo reclamo - Alumbrado público',
      estado: 'nuevo',
      fecha: '2026-08-29T17:53:00Z',
      categoria: 'Luminarias',
      channel: 'whatsapp',
      source_model: 'MunicipioTicket',
      tenant_slug: 'junin',
    };
    harness.selectedTicket = m419Ticket;
    const allowedAction = {
      id: 'accept_handoff',
      label: 'Tomar ticket',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      requires: ['source_model', 'legacy_id'],
      payload_defaults: {
        source_model: 'MunicipioTicket',
        legacy_id: 419,
        ticket_id: 419,
      },
      delivery_mode: 'internal_event',
      external_dispatch: false,
    };
    const authoritativeItem = {
      id: 'municipio:419',
      legacy_id: 419,
      source_model: 'MunicipioTicket',
      allowed_actions: [allowedAction],
      actions: [allowedAction],
    };
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({
      item: authoritativeItem,
      raw: { item: authoritativeItem },
    });
    harness.postOmnichannelInboxActionV2.mockResolvedValue({
      action: 'accept_handoff',
      delivery: {
        mode: 'internal_event',
        delivery_mode: 'internal_event',
        status: 'recorded_in_crm',
        external_dispatch: false,
        operator_message: 'Ticket tomado por el equipo de Luminarias.',
        final_delivery: {
          status: 'not_dispatched',
          authoritative_source: 'not_applicable',
        },
      },
      ticket: authoritativeItem,
      raw: { action: 'accept_handoff' },
    });

    render(renderConversation(true));

    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledTimes(1));
    const { menu: actionBar } = await openComposerTools();
    expect(within(actionBar).getByRole('menuitem', { name: 'Tomar ticket' })).toHaveAttribute('aria-disabled', 'false');
    expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledWith(
      '419',
      'junin',
      '/api/v2/inbox/omnichannel/419?source_model=MunicipioTicket',
    );
    expect(screen.getByTestId('ticket-handoff-internal-copy')).toHaveTextContent(
      'Derivación interna del CRM · no envía un mensaje por WhatsApp.',
    );

    const handoffButton = within(actionBar).getByRole('menuitem', { name: 'Tomar ticket' });
    fireEvent.click(handoffButton);

    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(1));
    expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledWith(
      'municipio:419',
      {
        action: 'accept_handoff',
        endpoint: '/api/v2/inbox/omnichannel/actions',
        payload: {
          source_model: 'MunicipioTicket',
          legacy_id: 419,
          ticket_id: 419,
        },
      },
      'junin',
    );
    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(await screen.findByTestId('ticket-composer-action-result')).toHaveTextContent(
      'Ticket tomado por el equipo de Luminarias.',
    );
  });

  it('reuses the same M-419 location identity after an ambiguous failure', async () => {
    harness.selectedTicket = {
      id: 419,
      tipo: 'municipio',
      nro_ticket: 'M-419',
      asunto: 'Demo reclamo - Alumbrado público',
      estado: 'nuevo',
      fecha: '2026-08-29T17:53:00Z',
      categoria: 'Luminarias',
      channel: 'whatsapp',
      source_model: 'MunicipioTicket',
      tenant_slug: 'junin',
    };
    const locationAction = {
      id: 'share_location',
      label: 'Ubicación',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      enabled: true,
      disabled: false,
      requires: ['lat', 'lng', 'Idempotency-Key'],
      payload_defaults: {
        source_model: 'MunicipioTicket',
        legacy_id: 419,
        ticket_id: 419,
      },
      delivery_mode: 'crm_only',
      external_dispatch: false,
      delivery_contract_version: 'inbox.action_delivery.v2',
      idempotency: {
        contract_version: 'inbox.reply_idempotency.v1',
        preferred_header: 'Idempotency-Key',
        body_field: 'client_message_id',
        retry_rule: 'reuse_same_value',
      },
      input_schema: {
        type: 'object',
        required: ['location'],
        properties: {
          location: {
            type: 'object',
            additionalProperties: false,
            properties: {
              address: { type: 'string', maxLength: 300 },
              label: { type: 'string', maxLength: 100 },
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lng: { type: 'number', minimum: -180, maximum: 180 },
            },
            anyOf: [{ required: ['address'] }, { required: ['lat', 'lng'] }],
          },
        },
      },
    };
    const authoritativeItem = {
      id: 'municipio:419',
      legacy_id: 419,
      source_model: 'MunicipioTicket',
      allowed_actions: [locationAction],
      actions: [locationAction],
    };
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({
      item: authoritativeItem,
      raw: { item: authoritativeItem },
    });
    harness.postOmnichannelInboxActionV2
      .mockRejectedValueOnce(new Error('network outcome unknown'))
      .mockResolvedValueOnce({
        action: 'share_location',
        delivery: {
          mode: 'internal_event',
          delivery_mode: 'internal_event',
          status: 'already_recorded',
          external_dispatch: false,
          operator_message: 'Ubicación ya registrada en el CRM.',
        },
        ticket: authoritativeItem,
        raw: { action: 'share_location' },
      });

    render(renderConversation(true));

    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledTimes(1));
    const { menu } = await openComposerTools();
    const locationButton = within(menu).getByRole('menuitem', { name: 'Ubicación' });
    expect(locationButton).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(locationButton);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Latitud WGS84'), { target: { value: '-34.593' } });
    fireEvent.change(within(dialog).getByLabelText('Longitud WGS84'), { target: { value: '-60.946' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar en CRM' }));

    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(1));
    await within(dialog).findByText('network outcome unknown');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar en CRM' }));

    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(2));
    const firstIdentity = harness.postOmnichannelInboxActionV2.mock.calls[0][1].payload.client_message_id;
    const secondIdentity = harness.postOmnichannelInboxActionV2.mock.calls[1][1].payload.client_message_id;
    expect(harness.postOmnichannelInboxActionV2.mock.calls[0][1].payload).toMatchObject({
      source_model: 'MunicipioTicket', ticket_id: 419, lat: -34.593, lng: -60.946,
    });
    expect(firstIdentity).toMatch(/^crm-share_location:/);
    expect(secondIdentity).toBe(firstIdentity);
    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(await screen.findByTestId('ticket-composer-action-result')).toHaveTextContent(
      'Ubicación ya registrada en el CRM.',
    );
  });

  it('closes and clears a share dialog when the operator changes tickets', async () => {
    const actionFor = (legacyId: number) => ({
      id: 'share_location',
      label: 'Ubicación',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      enabled: true,
      disabled: false,
      requires: ['lat', 'lng', 'Idempotency-Key'],
      payload_defaults: {
        source_model: 'MunicipioTicket',
        legacy_id: legacyId,
        ticket_id: legacyId,
      },
      delivery_mode: 'crm_only',
      external_dispatch: false,
      delivery_contract_version: 'inbox.action_delivery.v2',
      idempotency: {
        contract_version: 'inbox.reply_idempotency.v1',
        preferred_header: 'Idempotency-Key',
        body_field: 'client_message_id',
        retry_rule: 'reuse_same_value',
      },
      input_schema: {
        type: 'object',
        required: ['location'],
        properties: {
          location: {
            type: 'object',
            additionalProperties: false,
            properties: {
              address: { type: 'string', maxLength: 300 },
              label: { type: 'string', maxLength: 100 },
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lng: { type: 'number', minimum: -180, maximum: 180 },
            },
            anyOf: [{ required: ['address'] }, { required: ['lat', 'lng'] }],
          },
        },
      },
    });
    const ticketFor = (id: number): Ticket => ({
      ...selectedTicket,
      id,
      nro_ticket: `M-${id}`,
      source_model: 'MunicipioTicket',
    });
    harness.selectedTicket = ticketFor(419);
    harness.getOmnichannelInboxDetailV2.mockImplementation(async (ticketId: string) => {
      const id = Number(ticketId);
      const action = actionFor(id);
      const item = {
        id: `municipio:${id}`,
        legacy_id: id,
        source_model: 'MunicipioTicket',
        allowed_actions: [action],
        actions: [action],
      };
      return { item, raw: { item } };
    });

    const view = render(renderConversation(true));
    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledTimes(1));
    const { menu } = await openComposerTools();
    const locationButton = within(menu).getByRole('menuitem', { name: 'Ubicación' });
    fireEvent.click(locationButton);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Latitud WGS84'), { target: { value: '-34.593' } });
    fireEvent.change(within(dialog).getByLabelText('Longitud WGS84'), { target: { value: '-60.946' } });

    harness.selectedTicket = ticketFor(420);
    view.rerender(renderConversation(true));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledWith(
      '420',
      'junin',
      '/api/v2/inbox/omnichannel/420?source_model=MunicipioTicket',
    ));
    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps the M-419 timeline visible and every backend action fail-closed when contract detail fails', async () => {
    harness.selectedTicket = {
      id: 419,
      tipo: 'municipio',
      nro_ticket: 'M-419',
      asunto: 'Demo reclamo - Alumbrado público',
      estado: 'nuevo',
      fecha: '2026-08-29T17:53:00Z',
      categoria: 'Luminarias',
      channel: 'whatsapp',
      source_model: 'MunicipioTicket',
      tenant_slug: 'junin',
    };
    harness.getTicketTimeline.mockResolvedValue({
      messages: [{
        id: 'm419-message-1',
        author: 'user',
        content: 'La luminaria sigue apagada',
        timestamp: '2026-08-29T17:53:00Z',
      }],
      realtime_state: null,
      unified_conversation_stream: [],
    });
    harness.getOmnichannelInboxDetailV2.mockRejectedValue(new Error('502 backend unavailable'));

    render(renderConversation(true));

    expect(await screen.findByText('La luminaria sigue apagada')).toBeInTheDocument();
    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledTimes(1));
    const { menu } = await openComposerTools();
    expect(within(menu).getByRole('menuitem', { name: /Ubicación.*No disponible/i })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByRole('menuitem', { name: /Formulario.*No disponible/i })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByRole('menuitem', { name: /Derivar a humano.*No disponible/i })).toHaveAttribute('aria-disabled', 'true');
    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('sends TenantTicket text through the published omnichannel reply endpoint', async () => {
    render(renderConversation());

    const composer = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.change(composer, { target: { value: 'La cuadrilla ya tomó el caso.' } });
    const send = screen.getByRole('button', { name: 'Enviar mensaje' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(1));
    expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledWith(
      '77',
      {
        action: 'reply',
        endpoint: '/api/v2/inbox/omnichannel/77/actions',
        payload: {
          body: 'La cuadrilla ya tomó el caso.',
          message: 'La cuadrilla ya tomó el caso.',
          visibility: 'public',
          client_message_id: expect.stringMatching(/^crm-reply:/),
          source_model: 'TenantTicket',
        },
      },
      'junin',
    );
    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(await screen.findByTestId('ticket-composer-action-result')).toHaveTextContent(
      'En cola para WhatsApp',
    );
    expect(screen.getByTestId('ticket-composer-action-result')).toHaveTextContent(
      'entrega final pendiente de callback',
    );
  });

  it('reuses the reply identity after an ambiguous outcome and treats replay as non-delivered', async () => {
    harness.postOmnichannelInboxActionV2
      .mockRejectedValueOnce(new Error('network outcome unknown'))
      .mockResolvedValueOnce({
        action: 'reply',
        delivery: {
          contract_version: 'inbox.action_delivery.v2',
          mode: 'idempotent_replay',
          status: 'already_recorded',
          idempotency: { replayed: true },
          operator_message: 'La respuesta ya estaba registrada; no se duplicó.',
        },
        ticket: tenantAuthoritativeItem,
        raw: { action: 'reply' },
      });
    render(renderConversation());

    const composer = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.change(composer, { target: { value: 'Seguimos trabajando en la luminaria.' } });
    const send = screen.getByRole('button', { name: 'Enviar mensaje' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);
    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(composer).toHaveValue('Seguimos trabajando en la luminaria.'));
    fireEvent.click(send);

    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(2));
    const firstIdentity = harness.postOmnichannelInboxActionV2.mock.calls[0][1].payload.client_message_id;
    const secondIdentity = harness.postOmnichannelInboxActionV2.mock.calls[1][1].payload.client_message_id;
    expect(secondIdentity).toBe(firstIdentity);
    expect(await screen.findByTestId('ticket-composer-action-result')).toHaveTextContent(
      'Reintento reconocido',
    );
    expect(screen.queryByText('Entrega confirmada')).not.toBeInTheDocument();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('creates a new reply identity when the operator changes the text after an ambiguous outcome', async () => {
    harness.postOmnichannelInboxActionV2
      .mockRejectedValueOnce(new Error('network outcome unknown'))
      .mockResolvedValueOnce({
        action: 'reply',
        delivery: {
          contract_version: 'inbox.action_delivery.v2',
          mode: 'durable_queue',
          status: 'durably_staged',
          outbox: { durably_staged: true },
        },
        ticket: tenantAuthoritativeItem,
        raw: { action: 'reply' },
      });
    render(renderConversation());

    const composer = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.change(composer, { target: { value: 'Primer texto.' } });
    const send = screen.getByRole('button', { name: 'Enviar mensaje' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);
    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(composer).toHaveValue('Primer texto.'));
    fireEvent.change(composer, { target: { value: 'Texto corregido por el operador.' } });
    fireEvent.click(send);

    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(2));
    const firstIdentity = harness.postOmnichannelInboxActionV2.mock.calls[0][1].payload.client_message_id;
    const secondIdentity = harness.postOmnichannelInboxActionV2.mock.calls[1][1].payload.client_message_id;
    expect(secondIdentity).not.toBe(firstIdentity);
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps MunicipioTicket id 77 on its source-qualified action endpoint instead of colliding with TenantTicket 77', async () => {
    harness.selectedTicket = {
      ...selectedTicket,
      nro_ticket: 'M-77',
      asunto: 'Caso MunicipioTicket con el mismo id',
      source_model: 'MunicipioTicket',
    };
    const municipioReplyAction = {
      ...tenantReplyAction,
      endpoint: '/api/v2/inbox/omnichannel/actions',
      payload_defaults: {
        source_model: 'MunicipioTicket',
        legacy_id: 77,
        ticket_id: 77,
      },
    };
    const municipioItem = {
      ...tenantAuthoritativeItem,
      id: 'municipio:77',
      source_model: 'MunicipioTicket',
      allowed_actions: [municipioReplyAction],
      actions: [municipioReplyAction],
    };
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({ item: municipioItem, raw: { item: municipioItem } });
    harness.postOmnichannelInboxActionV2.mockResolvedValue({
      action: 'reply',
      delivery: { mode: 'durable_queue', status: 'durably_staged', outbox: { durably_staged: true } },
      ticket: municipioItem,
      raw: { action: 'reply' },
    });
    render(renderConversation());

    expect(await screen.findByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Responder ticket' }), {
      target: { value: 'Respuesta al reclamo municipal.' },
    });
    const send = screen.getByRole('button', { name: 'Enviar mensaje' });
    await waitFor(() => expect(send).toBeEnabled());
    fireEvent.click(send);

    await waitFor(() => expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledTimes(1));
    expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledWith(
      '77',
      'junin',
      '/api/v2/inbox/omnichannel/77?source_model=MunicipioTicket',
    );
    expect(harness.postOmnichannelInboxActionV2).toHaveBeenCalledWith(
      'municipio:77',
      expect.objectContaining({
        action: 'reply',
        endpoint: '/api/v2/inbox/omnichannel/actions',
        payload: expect.objectContaining({
          source_model: 'MunicipioTicket',
          legacy_id: 77,
          ticket_id: 77,
          client_message_id: expect.stringMatching(/^crm-reply:/),
        }),
      }),
      'junin',
    );
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('blocks TenantTicket attachments without a published secure contract and never calls the legacy sender', async () => {
    render(renderConversation());

    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Adjuntar archivo' })).not.toBeInTheDocument();
    const { menu } = await openComposerTools();
    expect(within(menu).getByRole('menuitem', { name: /Adjuntar archivo.*No disponible/i })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByTestId('tenant-attachment-block-reason')).toHaveTextContent(
      'no publicó un contrato seguro de adjuntos para este ticket',
    );
    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps reply fail-closed and uses the backend ownership reason when it is published', async () => {
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({
      item: {
        ...tenantAuthoritativeItem,
        reply_contract: {
          contract_version: 'inbox.reply_contract.v1',
          source_model: 'TenantTicket',
          enabled: false,
          reason_code: 'ticket_assignment_required',
        },
        allowed_actions: [],
        actions: [],
      },
      raw: {},
    });
    render(renderConversation(true));

    const reason = await screen.findByTestId('ticket-reply-block-reason');
    await waitFor(() => expect(reason).toBeVisible());
    expect(reason).toHaveTextContent('Tomá o asigná el ticket');

    const composer = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.change(composer, { target: { value: 'Intento sin ownership.' } });
    const send = screen.getByRole('button', { name: 'Enviar mensaje' });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute('aria-describedby', 'ticket-reply-block-reason');
    fireEvent.click(send);

    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();
    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByText('Intento sin ownership.', { selector: 'div' })).not.toBeInTheDocument();
  });

  it('does not invent ownership when the backend omits reply without a reason', async () => {
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({
      item: {
        ...tenantAuthoritativeItem,
        allowed_actions: [],
        actions: [],
      },
      raw: {},
    });
    render(renderConversation(true));

    const reason = await screen.findByTestId('ticket-reply-block-reason');
    expect(reason).toHaveTextContent('no publicó una acción segura de respuesta');
    expect(reason).toHaveTextContent('asignación, estado y canal');
    expect(reason).not.toHaveTextContent('Tomá o asigná');
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();
  });

  it('blocks MunicipioTicket attachments when the authoritative contract is body-only', async () => {
    harness.selectedTicket = {
      ...selectedTicket,
      nro_ticket: 'M-77',
      source_model: 'MunicipioTicket',
    };
    const municipioReplyAction = {
      ...tenantReplyAction,
      endpoint: '/api/v2/inbox/omnichannel/actions',
      payload_defaults: {
        source_model: 'MunicipioTicket',
        legacy_id: 77,
        ticket_id: 77,
      },
    };
    const municipioItem = {
      ...tenantAuthoritativeItem,
      id: 'municipio:77',
      source_model: 'MunicipioTicket',
      reply_contract: { contract_version: 'inbox.reply_contract.v1' },
      allowed_actions: [municipioReplyAction],
      actions: [municipioReplyAction],
    };
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({ item: municipioItem, raw: {} });
    render(renderConversation());

    await waitFor(() => expect(harness.getOmnichannelInboxDetailV2).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Adjuntar archivo' })).not.toBeInTheDocument();
    const { menu } = await openComposerTools();
    expect(within(menu).getByRole('menuitem', { name: /Adjuntar archivo.*No disponible/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(menu).getByTestId('tenant-attachment-block-reason')).toHaveTextContent(
      'no publicó un contrato seguro de adjuntos',
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('blocks every composer write when detail cache belongs to another ticket identity', async () => {
    const crossedItem = {
      ...tenantAuthoritativeItem,
      id: '78',
      legacy_id: 78,
      allowed_actions: [{
        id: 'share_location', label: 'Compartir ubicación', enabled: true, disabled: false,
        method: 'POST', endpoint: '/api/v2/inbox/omnichannel/actions',
        requires: ['lat', 'lng', 'Idempotency-Key'], delivery_mode: 'crm_only',
        external_dispatch: false, delivery_contract_version: 'inbox.action_delivery.v2',
      }],
    };
    harness.getOmnichannelInboxDetailV2.mockResolvedValue({ item: crossedItem, raw: {} });
    render(renderConversation());

    const send = await screen.findByRole('button', { name: 'Enviar mensaje' });
    expect(send).toBeDisabled();
    const { menu } = await openComposerTools();
    expect(within(menu).getByRole('menuitem', { name: /Compartir ubicación.*No disponible/i })).toHaveAttribute('aria-disabled', 'true');
    expect(harness.postOmnichannelInboxActionV2).not.toHaveBeenCalled();
  });

  it('coalesces opaque tenant invalidations without losing them when the ticket list refreshes', async () => {
    const view = render(renderConversation());

    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));
    const handleInvalidation = harness.handlers.get('ticket_update');
    expect(handleInvalidation).toBeTypeOf('function');

    act(() => {
      const payload = {
        contract_version: 'tickets.collection.invalidated.v1',
        resource: 'tickets',
        reason: 'collection_changed',
        refetch: true,
      };
      handleInvalidation?.(payload);
      handleInvalidation?.(payload);
      handleInvalidation?.(payload);
    });

    harness.selectedTicket = { ...selectedTicket, asunto: 'Caso actualizado desde el listado' };
    view.rerender(renderConversation());

    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(2));
    expect(harness.getTicketTimeline).toHaveBeenLastCalledWith(
      selectedTicket.id,
      selectedTicket.tipo,
      expect.objectContaining({
        ticket: expect.objectContaining({
          id: selectedTicket.id,
          asunto: 'Caso actualizado desde el listado',
        }),
        tenantSlug: 'junin',
      }),
    );
    expect(harness.getTicketMessages).toHaveBeenCalledTimes(2);

    await new Promise((resolve) => window.setTimeout(resolve, TENANT_TICKET_INVALIDATION_DEBOUNCE_MS + 40));
    expect(harness.getTicketTimeline).toHaveBeenCalledTimes(2);
  });

  it('keeps the visible timeline while a background reconciliation is pending or temporarily empty', async () => {
    let resolveBackgroundTimeline: ((value: {
      messages: never[];
      realtime_state: null;
      unified_conversation_stream: never[];
    }) => void) | null = null;

    harness.getTicketTimeline
      .mockResolvedValueOnce({
        messages: [{
          id: 'message-1',
          author: 'user',
          content: 'La luminaria sigue apagada',
          timestamp: '2026-08-20T12:05:00Z',
        }],
        realtime_state: null,
        unified_conversation_stream: [],
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveBackgroundTimeline = resolve;
      }));

    render(renderConversation());

    expect(await screen.findByText('La luminaria sigue apagada')).toBeInTheDocument();
    const handleInvalidation = harness.handlers.get('ticket_update');
    expect(handleInvalidation).toBeTypeOf('function');

    act(() => {
      handleInvalidation?.({
        contract_version: 'tickets.collection.invalidated.v1',
        resource: 'tickets',
        reason: 'collection_changed',
        refetch: true,
      });
    });

    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(2));
    expect(screen.getByText('La luminaria sigue apagada')).toBeInTheDocument();

    await act(async () => {
      resolveBackgroundTimeline?.({
        messages: [],
        realtime_state: null,
        unified_conversation_stream: [],
      });
    });

    await waitFor(() => expect(harness.getTicketMessages).toHaveBeenCalledTimes(1));
    expect(screen.getByText('La luminaria sigue apagada')).toBeInTheDocument();
  });

  it('loads 65 historical messages without duplicates and preserves the reader scroll anchor', async () => {
    const messageFor = (id: number) => ({
      id: `history-${id}`,
      author: id % 2 === 0 ? 'agent' : 'user',
      content: `Mensaje histórico ${id}`,
      timestamp: new Date(Date.UTC(2026, 7, 20, 10, id)).toISOString(),
    });
    let resolveOlderPage: ((value: Record<string, unknown>) => void) | null = null;

    harness.getTicketTimeline
      .mockResolvedValueOnce({
        messages: Array.from({ length: 40 }, (_, index) => messageFor(index + 26)),
        realtime_state: null,
        unified_conversation_stream: [],
        pagination: {
          contract_version: 'conversation.history.cursor.v1',
          limit: 50,
          has_more: true,
          next_cursor: 'cursor-older-25',
        },
        has_more: true,
        next_cursor: 'cursor-older-25',
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOlderPage = resolve;
      }));

    render(renderConversation());

    const loadOlderButton = await screen.findByRole('button', { name: 'Cargar mensajes anteriores' });
    expect(loadOlderButton).toHaveAttribute('aria-busy', 'false');
    expect(screen.getAllByText(/^Mensaje histórico \d+$/)).toHaveLength(40);

    const scrollNode = screen.getByTestId('ticket-message-scroll');
    let scrollHeight = 900;
    Object.defineProperty(scrollNode, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    scrollNode.scrollTop = 120;

    fireEvent.click(loadOlderButton);
    expect(loadOlderButton).toBeDisabled();
    expect(loadOlderButton).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(2));
    expect(harness.getTicketTimeline).toHaveBeenLastCalledWith(
      selectedTicket.id,
      selectedTicket.tipo,
      expect.objectContaining({
        cursor: 'cursor-older-25',
        limit: 50,
        tenantSlug: 'junin',
      }),
    );

    scrollHeight = 1_500;
    await act(async () => {
      resolveOlderPage?.({
        messages: [
          ...Array.from({ length: 25 }, (_, index) => messageFor(index + 1)),
          messageFor(26),
        ],
        realtime_state: null,
        unified_conversation_stream: [],
        pagination: {
          contract_version: 'conversation.history.cursor.v1',
          limit: 50,
          has_more: false,
          next_cursor: null,
        },
        has_more: false,
        next_cursor: null,
      });
    });

    await waitFor(() => expect(screen.getAllByText(/^Mensaje histórico \d+$/)).toHaveLength(65));
    expect(screen.getAllByText('Mensaje histórico 26')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Cargar mensajes anteriores' })).not.toBeInTheDocument();
    expect(scrollNode.scrollTop).toBe(720);
  });

  it('keeps the timeline and composer stable on an identical fallback poll without repeating read-state', async () => {
    if (harness.socket) harness.socket.connected = false;
    let pollingCallback: (() => void) | null = null;
    vi.spyOn(window, 'setInterval').mockImplementation((handler: TimerHandler, timeout?: number) => {
      if (timeout === 15_000 && typeof handler === 'function') {
        pollingCallback = () => handler();
      }
      return 321;
    });
    const durableMessage = {
      id: 'message-stable-1',
      author: 'user',
      content: 'Bache informado con ubicación',
      timestamp: '2026-08-20T12:05:00Z',
    };
    harness.getTicketTimeline.mockResolvedValueOnce({
      messages: [durableMessage],
      realtime_state: null,
      unified_conversation_stream: [],
    });
    harness.getTicketMessages.mockResolvedValue([durableMessage]);

    const view = render(renderConversation());
    expect(await screen.findByText('Bache informado con ubicación')).toBeInTheDocument();
    await waitFor(() => expect(harness.updateTicketReadState).toHaveBeenCalledTimes(1));

    const panelBefore = screen.getByTestId('ticket-conversation-panel');
    const composerBefore = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.change(composerBefore, { target: { value: 'Borrador que no debe perderse' } });

    harness.selectedTicket = { ...selectedTicket, asunto: 'Payload refrescado sin cambiar identidad' };
    view.rerender(renderConversation());
    expect(screen.getByTestId('ticket-conversation-panel')).toBe(panelBefore);
    expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toBe(composerBefore);

    await act(async () => {
      pollingCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(harness.getTicketMessages).toHaveBeenCalledTimes(1);
    expect(harness.updateTicketReadState).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Bache informado con ubicación')).toBeInTheDocument();
    expect(screen.queryByText('Sincronizando conversacion')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue('Borrador que no debe perderse');
  });

  it('clears and reloads the conversation when another tenant has the same source, type and ticket id', async () => {
    const otherTenantTicket: Ticket = {
      ...selectedTicket,
      nro_ticket: 'USH-77',
      asunto: 'Caso del segundo tenant',
      tenant_slug: 'ushuaia',
    };
    let resolveOtherTenantTimeline: ((value: {
      messages: Array<{
        id: string;
        author: string;
        content: string;
        timestamp: string;
      }>;
      realtime_state: null;
      unified_conversation_stream: never[];
    }) => void) | null = null;

    harness.getTicketTimeline
      .mockResolvedValueOnce({
        messages: [{
          id: 'tenant-junin-message-1',
          author: 'user',
          content: 'Historial exclusivo de Junin',
          timestamp: '2026-08-20T12:05:00Z',
        }],
        realtime_state: null,
        unified_conversation_stream: [],
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOtherTenantTimeline = resolve;
      }));

    const view = render(renderConversation());
    expect(await screen.findByText('Historial exclusivo de Junin')).toBeInTheDocument();
    await waitFor(() => expect(harness.updateTicketReadState).toHaveBeenCalledTimes(1));
    expect(harness.updateTicketReadState).toHaveBeenLastCalledWith(
      selectedTicket.id,
      selectedTicket.tipo,
      'tenant-junin-message-1',
    );

    act(() => {
      harness.selectedTicket = otherTenantTicket;
      view.rerender(renderConversation());
    });

    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Historial exclusivo de Junin')).not.toBeInTheDocument();
    expect(harness.updateTicketReadState).toHaveBeenCalledTimes(1);
    expect(harness.getTicketTimeline).toHaveBeenLastCalledWith(
      otherTenantTicket.id,
      otherTenantTicket.tipo,
      expect.objectContaining({
        ticket: expect.objectContaining({
          id: selectedTicket.id,
          tenant_slug: 'ushuaia',
        }),
        tenantSlug: 'ushuaia',
      }),
    );

    await act(async () => {
      resolveOtherTenantTimeline?.({
        messages: [{
          id: 'tenant-ushuaia-message-1',
          author: 'user',
          content: 'Historial exclusivo de Ushuaia',
          timestamp: '2026-08-20T12:10:00Z',
        }],
        realtime_state: null,
        unified_conversation_stream: [],
      });
    });

    expect(await screen.findByText('Historial exclusivo de Ushuaia')).toBeInTheDocument();
    expect(screen.queryByText('Historial exclusivo de Junin')).not.toBeInTheDocument();
    await waitFor(() => expect(harness.updateTicketReadState).toHaveBeenCalledTimes(2));
    expect(harness.updateTicketReadState).toHaveBeenLastCalledWith(
      otherTenantTicket.id,
      otherTenantTicket.tipo,
      'tenant-ushuaia-message-1',
    );
  });

  it('scopes template list and suggestions from the authenticated user when a legacy ticket only has tenant_id', async () => {
    harness.selectedTicket = {
      ...selectedTicket,
      tenant_id: 4,
      tenant_slug: undefined,
    };
    render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    const composer = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.keyDown(composer, { key: '/' });

    await waitFor(() => expect(harness.listResponseTemplates).toHaveBeenCalledWith('junin'));
    expect(harness.suggestResponseTemplates).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      metadata: {
        category: 'alumbrado',
        status: 'en_proceso',
        channel: 'whatsapp',
      },
    });
    expect(screen.getByRole('link', { name: 'Administrar respuestas' })).toHaveAttribute(
      'href',
      '/t/junin/perfil/plantillas-respuesta',
    );

    fireEvent.click(await screen.findByRole('option', { name: /Seguimiento operativo/ }));

    await waitFor(() => expect(composer).toHaveValue('Respuesta renderizada para CRM-77.'));
    expect(harness.previewResponseTemplateForTicket).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      templateId: 'template-1',
      ticketId: 77,
      sourceModel: 'TenantTicket',
    });
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('preserves the composer selection across the async preview without auto-sending', async () => {
    let resolvePreview:
      | ((value: {
          renderedText: string;
          templateId: string;
          ticketId: number;
          sourceModel: 'TenantTicket';
        }) => void)
      | null = null;
    harness.previewResponseTemplateForTicket.mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    const composer = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.change(composer, { target: { value: 'Inicio final' } });
    (composer as HTMLTextAreaElement).setSelectionRange(7, 12);
    fireEvent.click(screen.getByRole('button', { name: /Insertar respuesta guardada/i }));
    fireEvent.click(await screen.findByRole('option', { name: /Seguimiento operativo/ }));

    expect(await screen.findByText(/Preparando una versión segura/i)).toBeInTheDocument();
    expect(harness.sendMessage).not.toHaveBeenCalled();

    resolvePreview?.({
      renderedText: 'Respuesta validada',
      templateId: 'template-1',
      ticketId: 77,
      sourceModel: 'TenantTicket',
    });

    await waitFor(() => expect(composer).toHaveValue('Inicio Respuesta validada'));
    expect((composer as HTMLTextAreaElement).selectionStart).toBe(25);
    expect((composer as HTMLTextAreaElement).selectionEnd).toBe(25);
    expect(harness.sendMessage).not.toHaveBeenCalled();
  });

  it('isolates versioned drafts by tenant, source model, ticket and authenticated operator', async () => {
    const originTicket: Ticket = { ...selectedTicket, source_model: 'CustomTicket' };
    const otherSourceTicket: Ticket = { ...originTicket, source_model: 'OtherTicket' };
    const otherTenantTicket: Ticket = { ...otherSourceTicket, tenant_slug: 'ushuaia' };
    harness.selectedTicket = originTicket;
    const view = render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    const composer = screen.getByRole('textbox', { name: 'Responder ticket' });
    fireEvent.change(composer, { target: { value: 'Borrador Junín del operador 10' } });
    const originKey = buildConversationDraftStorageKey({
      tenant: 'junin',
      sourceModel: 'CustomTicket',
      ticketId: 77,
      operator: 'id-10',
    });
    expect(readConversationDraft(originKey)).toBe('Borrador Junín del operador 10');

    act(() => {
      harness.selectedTicket = otherSourceTicket;
      view.rerender(renderConversation());
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue(''));
    fireEvent.change(screen.getByRole('textbox', { name: 'Responder ticket' }), {
      target: { value: 'Borrador del otro source model' },
    });

    act(() => {
      harness.selectedTicket = otherTenantTicket;
      view.rerender(renderConversation());
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue(''));

    act(() => {
      harness.user = { id: 20, name: 'Otra operadora', rol: 'admin', tenant_slug: 'ushuaia' };
      view.rerender(renderConversation());
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue(''));

    act(() => {
      harness.user = { id: 10, name: 'Admin', rol: 'admin', tenant_slug: 'junin' };
      harness.selectedTicket = originTicket;
      view.rerender(renderConversation());
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Responder ticket' }))
      .toHaveValue('Borrador Junín del operador 10'));
  });

  it('clears a non-persistable attachment and revokes its object URL when the expediente changes', async () => {
    harness.selectedTicket = { ...selectedTicket, source_model: 'CustomTicket' };
    const view = render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo' }));
    expect(await screen.findByAltText('Preview')).toBeInTheDocument();

    act(() => {
      harness.selectedTicket = { ...selectedTicket, id: 78, nro_ticket: 'CRM-78', source_model: 'CustomTicket' };
      view.rerender(renderConversation());
    });

    await waitFor(() => expect(screen.queryByAltText('Preview')).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ticket-evidence-preview');
  });

  it('revokes the local attachment URL immediately after a successful send', async () => {
    harness.selectedTicket = { ...selectedTicket, source_model: 'CustomTicket' };
    harness.sendMessage.mockResolvedValue({ messages: [] });
    render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo' }));
    expect(await screen.findByAltText('Preview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(harness.sendMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(URL.revokeObjectURL)
      .toHaveBeenCalledWith('blob:ticket-evidence-preview'));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does not apply a late send success to another expediente and clears only the origin draft', async () => {
    let resolveSend: ((value: Record<string, unknown>) => void) | null = null;
    harness.sendMessage.mockReturnValue(new Promise((resolve) => {
      resolveSend = resolve;
    }));
    const originTicket: Ticket = { ...selectedTicket, source_model: 'CustomTicket' };
    const nextTicket: Ticket = { ...originTicket, id: 78, nro_ticket: 'CRM-78' };
    harness.selectedTicket = originTicket;
    const view = render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole('textbox', { name: 'Responder ticket' }), {
      target: { value: 'Respuesta exclusiva del expediente 77' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => expect(harness.sendMessage).toHaveBeenCalledTimes(1));

    act(() => {
      harness.selectedTicket = nextTicket;
      view.rerender(renderConversation());
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue(''));
    fireEvent.change(screen.getByRole('textbox', { name: 'Responder ticket' }), {
      target: { value: 'Borrador nuevo del expediente 78' },
    });

    await act(async () => {
      resolveSend?.({
        messages: [{
          id: 'late-origin-success',
          author: 'agent',
          content: 'Resultado tardío del expediente 77',
          timestamp: '2026-08-30T12:00:00Z',
        }],
      });
      await Promise.resolve();
    });

    expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue('Borrador nuevo del expediente 78');
    expect(screen.queryByText('Resultado tardío del expediente 77')).not.toBeInTheDocument();
    expect(readConversationDraft(buildConversationDraftStorageKey({
      tenant: 'junin', sourceModel: 'CustomTicket', ticketId: 77, operator: 'id-10',
    }))).toBe('');
    expect(readConversationDraft(buildConversationDraftStorageKey({
      tenant: 'junin', sourceModel: 'CustomTicket', ticketId: 78, operator: 'id-10',
    }))).toBe('Borrador nuevo del expediente 78');
  });

  it('restores a late failed send only in the origin draft without changing the open expediente', async () => {
    let rejectSend: ((reason?: unknown) => void) | null = null;
    harness.sendMessage.mockReturnValue(new Promise((_resolve, reject) => {
      rejectSend = reject;
    }));
    const originTicket: Ticket = { ...selectedTicket, source_model: 'CustomTicket' };
    const nextTicket: Ticket = { ...originTicket, id: 78, nro_ticket: 'CRM-78' };
    harness.selectedTicket = originTicket;
    const view = render(renderConversation());
    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole('textbox', { name: 'Responder ticket' }), {
      target: { value: 'Borrador que debe volver al expediente 77' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => expect(harness.sendMessage).toHaveBeenCalledTimes(1));

    act(() => {
      harness.selectedTicket = nextTicket;
      view.rerender(renderConversation());
    });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue(''));
    fireEvent.change(screen.getByRole('textbox', { name: 'Responder ticket' }), {
      target: { value: 'Trabajo actual del expediente 78' },
    });

    await act(async () => {
      rejectSend?.(new Error('fallo tardío'));
      await Promise.resolve();
    });

    expect(screen.getByRole('textbox', { name: 'Responder ticket' })).toHaveValue('Trabajo actual del expediente 78');
    expect(readConversationDraft(buildConversationDraftStorageKey({
      tenant: 'junin', sourceModel: 'CustomTicket', ticketId: 77, operator: 'id-10',
    }))).toBe('Borrador que debe volver al expediente 77');
    expect(readConversationDraft(buildConversationDraftStorageKey({
      tenant: 'junin', sourceModel: 'CustomTicket', ticketId: 78, operator: 'id-10',
    }))).toBe('Trabajo actual del expediente 78');
  });
});
