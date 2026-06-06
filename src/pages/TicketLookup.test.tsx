import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getTicketByNumberMock = vi.fn();
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
  getTicketTimeline: vi.fn(),
  getTicketMessages: vi.fn(),
  sendMessage: vi.fn(),
  updateTicketPresence: vi.fn(),
  updateTicketReadState: vi.fn(),
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
});
