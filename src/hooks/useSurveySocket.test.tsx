import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketHandlers: Record<string, (...args: any[]) => void> = {};
const socketEmitMock = vi.fn();
const socketOffMock = vi.fn();
const socketDisconnectMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (event: string, handler: (...args: any[]) => void) => {
      socketHandlers[event] = handler;
    },
    off: socketOffMock,
    emit: socketEmitMock,
    disconnect: socketDisconnectMock,
  })),
}));

vi.mock('@/config', () => ({
  getSocketUrl: () => 'https://socket.chatboc.test',
  SOCKET_PATH: '/api/socket.io',
}));

vi.mock('@/services/enterpriseService', () => ({
  enterpriseService: {
    trackEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/utils/safeLocalStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
}));

import { useSurveySocket } from './useSurveySocket';

const SurveySocketHarness = ({ onUpdate }: { onUpdate?: (payload: any) => void }) => {
  useSurveySocket({
    slug: 'consulta-barrial',
    tenantSlug: 'junin',
    rooms: ['encuesta:junin:consulta-barrial', 'encuesta_consulta-barrial'],
    enabled: true,
    onUpdate,
  });
  return null;
};

describe('useSurveySocket', () => {
  beforeEach(() => {
    Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
    socketEmitMock.mockClear();
    socketOffMock.mockClear();
    socketDisconnectMock.mockClear();
  });

  it('joins tenant-scoped and legacy survey rooms on connect', () => {
    render(<SurveySocketHarness />);

    act(() => {
      socketHandlers.connect?.();
    });

    expect(socketEmitMock).toHaveBeenCalledWith('join', {
      room: 'encuesta:junin:consulta-barrial',
    });
    expect(socketEmitMock).toHaveBeenCalledWith('join', {
      room: 'encuesta_consulta-barrial',
    });
  });

  it('consumes the modern vote-created event emitted by the backend', () => {
    const onUpdate = vi.fn();
    const livePayload = {
      contract_version: 'surveys.live_results.v2',
      encuesta_id: 42,
      total_votos: 12,
      realtime: { room: 'encuesta:junin:consulta-barrial' },
    };

    render(<SurveySocketHarness onUpdate={onUpdate} />);

    act(() => {
      socketHandlers['survey.vote.created']?.(livePayload);
    });

    expect(onUpdate).toHaveBeenCalledWith(livePayload);
  });

  it('removes vote-created listeners on unmount', () => {
    const { unmount } = render(<SurveySocketHarness />);

    unmount();

    expect(socketOffMock).toHaveBeenCalledWith('survey.vote.created', expect.any(Function));
    expect(socketDisconnectMock).toHaveBeenCalled();
  });
});
