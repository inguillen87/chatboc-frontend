import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResponseTemplate } from '@/features/tickets/responseTemplatesApi';
import type { Ticket } from '@/types/tickets';

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
  listResponseTemplates: vi.fn(),
  previewResponseTemplateForTicket: vi.fn(),
  suggestResponseTemplates: vi.fn(),
  sendMessage: vi.fn(),
  updateTicketReadState: vi.fn(),
  updateTicket: vi.fn(),
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

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: harness.socket }),
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => ({ selectedTicket: harness.selectedTicket, updateTicket: harness.updateTicket }),
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

vi.mock('@/services/ticketService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/ticketService');
  return {
    ...actual,
    getTicketMessages: (...args: unknown[]) => harness.getTicketMessages(...args),
    getTicketTimeline: (...args: unknown[]) => harness.getTicketTimeline(...args),
    sendMessage: (...args: unknown[]) => harness.sendMessage(...args),
    updateTicketReadState: (...args: unknown[]) => harness.updateTicketReadState(...args),
  };
});

vi.mock('./CaseStrip', () => ({ default: () => null }));
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

import ConversationPanel, { TENANT_TICKET_INVALIDATION_DEBOUNCE_MS } from './ConversationPanel';

let queryClient: QueryClient;

const renderConversation = (operationalWorkspace = false) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <ConversationPanel
        isMobile={false}
        isSidebarVisible
        isDetailsVisible={false}
        onToggleSidebar={vi.fn()}
        onToggleDetails={vi.fn()}
        desktopView="chat"
        operationalWorkspace={operationalWorkspace}
      />
    </MemoryRouter>
  </QueryClientProvider>
);

describe('ConversationPanel tenant invalidation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useRealTimers();
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
    harness.updateTicket.mockReset();
    harness.socket?.emit.mockClear();
    harness.socket?.off.mockClear();
    harness.socket?.on.mockClear();
    if (harness.socket) harness.socket.connected = true;
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

    expect(screen.getByTestId('ticket-reply-footer')).toHaveClass('sticky', 'bottom-0');
    expect(screen.getByText('Respuesta desde el ticket')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-composer-sync-status')).toHaveTextContent('Tiempo real conectado');
    expect(screen.getByRole('button', { name: 'Adjuntar archivo' })).toBeEnabled();

    expect(screen.getByRole('button', { name: 'Ubicación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ubicación' })).toHaveAccessibleDescription(
      'Ubicación bloqueada hasta que el backend publique el contrato de envío.',
    );
    expect(screen.getByRole('button', { name: 'Formulario' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Derivar a humano' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Derivar a humano' })).toHaveAccessibleDescription(
      'Derivación bloqueada porque el ticket no publicó una transición backend.',
    );
  });

  it('sends a selected attachment through the existing ticket reply contract', async () => {
    harness.sendMessage.mockResolvedValue({
      delivery: {
        contract_version: 'tickets.agent_reply_delivery.v1',
        channel: 'whatsapp',
        status: 'accepted',
        reason: 'provider_accepted',
        external_dispatch: true,
        socket_emitted: true,
        delivery_results: { whatsapp: true, socket: true },
      },
    });
    render(renderConversation());

    await waitFor(() => expect(harness.getTicketTimeline).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo' }));
    expect(screen.getByText('evidencia.jpg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(harness.sendMessage).toHaveBeenCalledTimes(1));
    expect(harness.sendMessage).toHaveBeenCalledWith(
      selectedTicket.id,
      selectedTicket.tipo,
      '',
      [expect.objectContaining({ name: 'evidencia.jpg', type: 'image/jpeg' })],
      undefined,
      expect.objectContaining({
        ticket: expect.objectContaining({ id: selectedTicket.id, tenant_slug: 'junin' }),
        tenantSlug: 'junin',
      }),
    );
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

    expect(await screen.findByRole('status')).toHaveTextContent(/versión segura/i);
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
});
