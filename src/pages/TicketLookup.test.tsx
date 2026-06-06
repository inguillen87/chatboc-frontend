import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getTicketByNumberMock = vi.fn();
const getTicketTimelineMock = vi.fn();
const getTicketMessagesMock = vi.fn();
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
  sendMessage: vi.fn(),
  updateTicketPresence: vi.fn().mockResolvedValue(null),
  updateTicketReadState: vi.fn().mockResolvedValue(null),
  getLiveChatScheduleStatus: vi.fn().mockResolvedValue({
    enabled: true,
    available: true,
    description: 'Atencion disponible',
    socket_enabled: false,
  }),
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
    trackFrontendEventMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    navigateMock.mockReset();

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
});
