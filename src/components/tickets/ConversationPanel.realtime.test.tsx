import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Ticket } from '@/types/tickets';

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => void>(),
  getTicketMessages: vi.fn(),
  getTicketTimeline: vi.fn(),
  updateTicketReadState: vi.fn(),
  updateTicket: vi.fn(),
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
  useUser: () => ({ user: { id: 10, name: 'Admin', rol: 'admin' } }),
}));

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
    updateTicketReadState: (...args: unknown[]) => harness.updateTicketReadState(...args),
  };
});

vi.mock('./CaseStrip', () => ({ default: () => null }));
vi.mock('./ChatMessage', () => ({
  default: ({ message }: { message: { text?: string } }) => <div>{message.text}</div>,
}));
vi.mock('./DetailsPanel', () => ({ default: () => null }));
vi.mock('./PredefinedMessagesModal', () => ({ default: () => null }));
vi.mock('../ui/ScrollToBottomButton', () => ({ default: () => null }));
vi.mock('../ui/AdjuntarArchivo', () => ({ default: () => null }));

import ConversationPanel, { TENANT_TICKET_INVALIDATION_DEBOUNCE_MS } from './ConversationPanel';

const renderConversation = () => (
  <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
    <ConversationPanel
      isMobile={false}
      isSidebarVisible
      isDetailsVisible={false}
      onToggleSidebar={vi.fn()}
      onToggleDetails={vi.fn()}
      desktopView="chat"
    />
  </MemoryRouter>
);

describe('ConversationPanel tenant invalidation', () => {
  beforeEach(() => {
    harness.handlers.clear();
    harness.selectedTicket = selectedTicket;
    harness.getTicketMessages.mockReset().mockResolvedValue([]);
    harness.getTicketTimeline.mockReset().mockResolvedValue({
      messages: [],
      realtime_state: null,
      unified_conversation_stream: [],
    });
    harness.updateTicketReadState.mockReset().mockResolvedValue(null);
    harness.updateTicket.mockReset();
    harness.socket?.emit.mockClear();
    harness.socket?.off.mockClear();
    harness.socket?.on.mockClear();
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
});
