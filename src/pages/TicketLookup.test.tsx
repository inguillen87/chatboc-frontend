import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getTicketByNumberMock = vi.fn();
const getTicketTimelineMock = vi.fn();
const getTicketMessagesMock = vi.fn();
const getLiveChatScheduleStatusMock = vi.fn();
const sendMessageMock = vi.fn();
const trackFrontendEventMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const navigateMock = vi.fn();
const searchParamsMock = new URLSearchParams('pin=9999');

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ ticketId: 'REC-12345' }),
    useNavigate: () => navigateMock,
    useSearchParams: () => [searchParamsMock, vi.fn()],
  };
});

vi.mock('@/services/ticketService', () => ({
  getTicketByNumber: (...args: unknown[]) => getTicketByNumberMock(...args),
  getTicketTimeline: (...args: unknown[]) => getTicketTimelineMock(...args),
  getTicketMessages: (...args: unknown[]) => getTicketMessagesMock(...args),
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  updateTicketPresence: vi.fn().mockResolvedValue(null),
  updateTicketReadState: vi.fn().mockResolvedValue(null),
  getLiveChatScheduleStatus: (...args: unknown[]) => getLiveChatScheduleStatusMock(...args),
}));

vi.mock('@/utils/frontendTelemetry', () => ({
  trackFrontendEvent: (...args: unknown[]) => trackFrontendEventMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('@/components/ui/TrackingMap', () => ({
  default: () => <div>tracking-map</div>,
}));

vi.mock('@/components/ui/Confetti', () => ({
  default: () => null,
}));

let TicketLookup: React.ComponentType;

beforeAll(async () => {
  TicketLookup = (await import('@/pages/TicketLookup')).default;
}, 30000);

describe('TicketLookup request_id support surface', () => {
  beforeEach(() => {
    getTicketByNumberMock.mockReset();
    getTicketTimelineMock.mockReset();
    getTicketMessagesMock.mockReset();
    getLiveChatScheduleStatusMock.mockReset();
    sendMessageMock.mockReset();
    trackFrontendEventMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    navigateMock.mockReset();

    getLiveChatScheduleStatusMock.mockResolvedValue({
      enabled: true,
      available: true,
      description: 'Atencion disponible',
      socket_enabled: false,
    });
    sendMessageMock.mockResolvedValue({ ok: true });

    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('shows and copies request_id when public lookup fails', async () => {
    getTicketByNumberMock.mockRejectedValue({
      status: 404,
      requestId: 'req-public-404',
    });

    render(<TicketLookup />);

    expect(await screen.findByText(/request_id: req-public-404/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copiar request_id/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('req-public-404');
    });

    expect(trackFrontendEventMock).toHaveBeenCalledWith(
      'support_request_id_copied',
      expect.objectContaining({
        request_id: 'req-public-404',
        source: 'ticket_lookup_error',
      }),
    );
    expect(toastSuccessMock).toHaveBeenCalledWith('request_id copiado');
  });

  it('keeps initial public ticket messages when secondary conversation endpoints are empty', async () => {
    getTicketByNumberMock.mockResolvedValue({
      id: 400,
      tipo: 'municipio',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo de calle',
      estado: 'en_proceso',
      fecha: '2026-06-06T03:03:47.626Z',
      email: 'demo@example.com',
      history: [],
      messages: [
        {
          id: 334,
          author: 'user',
          content: 'hola que tal como va mi reclamo? puedo hablar con alguien en vivo ?',
          timestamp: '2026-06-06T03:04:47.245Z',
        },
      ],
    });
    getTicketTimelineMock.mockResolvedValue({
      estado_chat: '',
      history: [],
      messages: [],
      unified_conversation_stream: [],
    });
    getTicketMessagesMock.mockResolvedValue({
      messages: [],
      realtimeState: null,
    });

    render(<TicketLookup />);

    expect(
      await screen.findByText(/hola que tal como va mi reclamo/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/todav[aí]a no hay mensajes públicos/i)).not.toBeInTheDocument();
  });

  it('renders ticket operational state with public copy instead of internal CRM labels', async () => {
    getTicketByNumberMock.mockResolvedValue({
      id: 400,
      tipo: 'municipio',
      tenant_slug: 'junin',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo de calle',
      estado: 'pendiente',
      fecha: '2026-06-06T03:03:47.626Z',
      email: 'demo@example.com',
      history: [],
      messages: [
        {
          id: 334,
          author: 'user',
          content: 'hola que tal como va mi reclamo?',
          timestamp: '2026-06-06T03:04:47.245Z',
        },
      ],
      sla_status: 'nearing_sla',
      operational_badges: ['sla_sin_asignar', 'sin_asignar', 'active_viewers_count'],
      operational_metrics: [
        { label: 'AGE HOURS', value: '5.57' },
        { label: 'INACTIVITY HOURS', value: '2.25' },
        { label: 'active_viewers_count', value: '2' },
      ],
      priority_score: 0.82,
      priority_breakdown: { urgency: 'high' },
      recommended_next_action: 'Asignar inspector interno',
      collaboration_state: {
        unread_count: 1,
        unread_viewer_count: 1,
        active_viewers_count: 1,
      },
      realtime_state: {
        viewers: [],
        active_viewers: [
          {
            viewer_id: 'agent-1',
            viewer_label: 'Mesa de ayuda',
            presence_status: 'active',
            read_at: '2026-06-06T03:06:47.245Z',
          },
        ],
        read_states: [
          {
            viewer_id: 'agent-1',
            viewer_label: 'Mesa de ayuda',
            read_at: '2026-06-06T03:06:47.245Z',
          },
        ],
        summary: {
          active_count: 1,
          idle_count: 0,
          read_count: 1,
        },
      },
    });
    getTicketTimelineMock.mockResolvedValue({
      estado_chat: '',
      history: [],
      messages: [],
      unified_conversation_stream: [
        {
          id: 'event-1',
          timestamp: '2026-06-06T03:04:47.245Z',
          actor_type: 'citizen',
          preview_text: 'hola que tal como va mi reclamo?',
          stream_type: 'message',
          badge: 'unread',
          is_unread: true,
        },
      ],
    });
    getTicketMessagesMock.mockResolvedValue({
      messages: [],
      realtimeState: null,
    });

    render(<TicketLookup />);

    expect(await screen.findByText('Antigüedad')).toBeInTheDocument();
    expect(screen.getByText('5.6 h')).toBeInTheDocument();
    expect(screen.getByText('Sin novedades')).toBeInTheDocument();
    expect(screen.getByText('2.3 h')).toBeInTheDocument();
    expect(screen.getByText('Actividad')).toBeInTheDocument();
    expect(screen.getByText(/Plazo de respuesta: Por vencer/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pendiente de asignaci[oó]n/i).length).toBeGreaterThan(0);
    expect(await screen.findByText(/El equipo est[aá] revisando este reclamo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pendiente de revisi[oó]n/i).length).toBeGreaterThan(0);

    expect(screen.queryByText(/^Timeline$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SLA/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AGE HOURS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/INACTIVITY HOURS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/active_viewers_count/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Presence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Read state/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Unread$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Asignar inspector interno/i)).not.toBeInTheDocument();
  });

  it('uses the route ticket number when the public ticket payload omits nro_ticket', async () => {
    getTicketByNumberMock.mockResolvedValue({
      id: 400,
      tipo: 'municipio',
      tenant_slug: 'junin',
      asunto: 'Arreglo de calle',
      estado: 'pendiente',
      fecha: '2026-06-06T03:03:47.626Z',
      history: [],
      messages: [],
    });
    getTicketTimelineMock.mockResolvedValue({
      estado_chat: '',
      history: [],
      messages: [],
      unified_conversation_stream: [],
    });
    getTicketMessagesMock.mockResolvedValue({
      messages: [],
      realtimeState: null,
    });

    render(<TicketLookup />);

    expect(await screen.findAllByText('REC-12345')).not.toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);

    expect(await screen.findByRole('dialog')).toHaveTextContent('Gestión #REC-12345');
  });

  it('opens the ticket live channel and sends the public message with the secure PIN', async () => {
    getTicketByNumberMock.mockResolvedValue({
      id: 400,
      tipo: 'municipio',
      tenant_slug: 'junin',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo de calle',
      estado: 'en_proceso',
      fecha: '2026-06-06T03:03:47.626Z',
      email: 'demo@example.com',
      history: [],
      messages: [],
    });
    getTicketTimelineMock.mockResolvedValue({
      estado_chat: '',
      history: [],
      messages: [],
      unified_conversation_stream: [],
    });
    getTicketMessagesMock.mockResolvedValue({
      messages: [],
      realtimeState: null,
    });

    render(<TicketLookup />);

    const openButton = await screen.findByRole('button', {
      name: /abrir chat del reclamo/i,
    });
    fireEvent.click(openButton);

    expect(await screen.findByText(/atención en vivo disponible/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/mesa de atención de este reclamo/i), {
      target: { value: 'Necesito hablar con alguien en vivo por este reclamo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar al chat/i }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        400,
        'municipio',
        'Necesito hablar con alguien en vivo por este reclamo',
        undefined,
        undefined,
        { public: true, pin: '9999' },
      );
    });

    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('/demo'));
    expect(toastSuccessMock).toHaveBeenCalledWith('Mensaje enviado al canal del reclamo.');
    expect(trackFrontendEventMock).toHaveBeenCalledWith(
      'tracking_live_chat_status_checked',
      expect.objectContaining({
        ticket_id: 400,
        tenant_slug: 'junin',
        live_chat_available: true,
      }),
    );
  });

  it('keeps the citizen inside the ticket when live support is offline', async () => {
    getLiveChatScheduleStatusMock.mockResolvedValue({
      enabled: true,
      available: false,
      description: 'Lunes a viernes de 09:00 a 13:00',
      socket_enabled: false,
    });
    sendMessageMock.mockResolvedValue({
      contract_version: 'tickets.public_chat_reply.v1',
      success: true,
      message: 'Mensaje guardado en el reclamo.',
      mode: 'offline',
    });
    getTicketByNumberMock.mockResolvedValue({
      id: 401,
      tipo: 'municipio',
      tenant_slug: 'junin',
      nro_ticket: 'M-378431',
      asunto: 'Luminaria',
      estado: 'nuevo',
      fecha: '2026-06-06T03:03:47.626Z',
      history: [],
      messages: [],
    });
    getTicketTimelineMock.mockResolvedValue({
      estado_chat: '',
      history: [],
      messages: [],
      unified_conversation_stream: [],
    });
    getTicketMessagesMock.mockResolvedValue({
      messages: [],
      realtimeState: null,
    });

    render(<TicketLookup />);

    const offlineButton = await screen.findByRole('button', {
      name: /dejar mensaje en el reclamo/i,
    });
    fireEvent.click(offlineButton);

    expect(await screen.findByText(/atención fuera de horario/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/mensaje offline para este reclamo/i), {
      target: { value: 'Necesito dejar una aclaración para mañana' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar offline/i }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        401,
        'municipio',
        'Necesito dejar una aclaración para mañana',
        undefined,
        undefined,
        { public: true, pin: '9999' },
      );
    });
    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('/demo'));
    expect(toastSuccessMock).toHaveBeenCalledWith('Mensaje guardado en el reclamo.');
  });
});
