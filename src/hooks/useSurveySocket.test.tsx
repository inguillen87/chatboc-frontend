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

const SurveySocketHarness = ({
  onUpdate,
  slug = 'consulta-barrial',
  tenantSlug = 'junin',
}: {
  onUpdate?: (payload: any) => void;
  slug?: string;
  tenantSlug?: string;
}) => {
  useSurveySocket({
    slug,
    tenantSlug,
    rooms: [`encuesta:${tenantSlug}:${slug}`, `encuesta_${slug}`],
    enabled: true,
    onUpdate,
  });
  return null;
};

const SurveySocketContractHarness = ({ onUpdate }: { onUpdate?: (payload: any) => void }) => {
  useSurveySocket({
    slug: 'consulta-barrial',
    tenantSlug: 'junin',
    rooms: ['contract-primary', 'contract-legacy'],
    joinEvent: 'join_survey',
    joinPayloads: [{ room: 'contract-primary', tenant_slug: 'junin' }],
    events: ['survey.live_results.updated'],
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

  it('delivers one committed response across event aliases, room duplicates, and retries', () => {
    const onUpdate = vi.fn();
    const eventId = 'a6ef8606-8826-5b80-a83f-b4f91a3ec44d';
    const livePayload = {
      contract_version: 'surveys.live_results.v2',
      encuesta_id: 42,
      total_votos: 12,
      event: {
        contract_version: 'surveys.realtime_effect.v2',
        event_id: eventId,
        event_name: 'survey.response.committed',
        response_id: 501,
      },
    };

    render(<SurveySocketHarness onUpdate={onUpdate} />);

    act(() => {
      socketHandlers.survey_update_v2?.(livePayload);
      socketHandlers['survey.vote.created']?.({ ...livePayload });
      socketHandlers.survey_update?.({
        ...livePayload,
        event: { ...livePayload.event, event_id: `  ${eventId}  ` },
      });
      socketHandlers.survey_update_v2?.(livePayload);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(livePayload);
  });

  it('keeps delivering legacy payloads and payloads without a valid nested event id', () => {
    const onUpdate = vi.fn();
    const legacyPayload = {
      contract_version: 'surveys.live_results.v2',
      total_respuestas: 3,
    };
    const malformedPayload = {
      ...legacyPayload,
      event: { event_id: 'not a safe event id' },
    };
    const topLevelOnlyPayload = {
      ...legacyPayload,
      event_id: 'a6ef8606-8826-5b80-a83f-b4f91a3ec44d',
    };

    render(<SurveySocketHarness onUpdate={onUpdate} />);

    act(() => {
      socketHandlers.survey_update_v2?.(legacyPayload);
      socketHandlers.survey_update_v2?.(legacyPayload);
      socketHandlers['survey.vote.created']?.(malformedPayload);
      socketHandlers['survey.vote.created']?.(malformedPayload);
      socketHandlers.survey_update?.(topLevelOnlyPayload);
      socketHandlers.survey_update?.(topLevelOnlyPayload);
    });

    expect(onUpdate).toHaveBeenCalledTimes(6);
  });

  it('bounds the recent committed-event window and evicts its least-recent entry', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const onUpdate = vi.fn();
    const payloadFor = (index: number) => ({
      contract_version: 'surveys.live_results.v2',
      event: { event_id: `committed-response-${index}` },
    });

    render(<SurveySocketHarness onUpdate={onUpdate} />);

    act(() => {
      for (let index = 0; index <= 512; index += 1) {
        socketHandlers.survey_update_v2?.(payloadFor(index));
      }
      socketHandlers['survey.vote.created']?.(payloadFor(0));
    });

    expect(onUpdate).toHaveBeenCalledTimes(514);
    consoleLogSpy.mockRestore();
  });

  it('retains deduplication through same-survey resubscriptions and resets it for a new scope', () => {
    const eventPayload = {
      contract_version: 'surveys.live_results.v2',
      event: { event_id: 'a6ef8606-8826-5b80-a83f-b4f91a3ec44d' },
    };
    const firstScopeUpdate = vi.fn();
    const sameScopeUpdate = vi.fn();
    const nextScopeUpdate = vi.fn();
    const view = render(<SurveySocketHarness onUpdate={firstScopeUpdate} />);

    act(() => {
      socketHandlers.survey_update_v2?.(eventPayload);
    });
    view.rerender(<SurveySocketHarness onUpdate={sameScopeUpdate} />);
    act(() => {
      socketHandlers['survey.vote.created']?.(eventPayload);
    });

    expect(firstScopeUpdate).toHaveBeenCalledTimes(1);
    expect(sameScopeUpdate).not.toHaveBeenCalled();

    view.rerender(
      <SurveySocketHarness
        slug="presupuesto-participativo"
        onUpdate={nextScopeUpdate}
      />,
    );
    act(() => {
      socketHandlers['survey.vote.created']?.(eventPayload);
    });

    expect(nextScopeUpdate).toHaveBeenCalledTimes(1);
  });

  it('resets committed-event memory after the hook unmounts', () => {
    const eventPayload = {
      contract_version: 'surveys.live_results.v2',
      event: { event_id: 'a6ef8606-8826-5b80-a83f-b4f91a3ec44d' },
    };
    const firstUpdate = vi.fn();
    const nextUpdate = vi.fn();
    const firstView = render(<SurveySocketHarness onUpdate={firstUpdate} />);

    act(() => {
      socketHandlers.survey_update_v2?.(eventPayload);
    });
    firstView.unmount();
    render(<SurveySocketHarness onUpdate={nextUpdate} />);
    act(() => {
      socketHandlers.survey_update_v2?.(eventPayload);
    });

    expect(firstUpdate).toHaveBeenCalledTimes(1);
    expect(nextUpdate).toHaveBeenCalledTimes(1);
  });

  it('joins and listens with backend-provided realtime contract options', () => {
    const onUpdate = vi.fn();
    const livePayload = {
      contract_version: 'surveys.live_results.v2',
      total_respuestas: 18,
    };

    const { unmount } = render(<SurveySocketContractHarness onUpdate={onUpdate} />);

    act(() => {
      socketHandlers.connect?.();
    });

    expect(socketEmitMock).toHaveBeenCalledWith('join_survey', {
      room: 'contract-primary',
      tenant_slug: 'junin',
    });

    act(() => {
      socketHandlers['survey.live_results.updated']?.(livePayload);
    });

    expect(onUpdate).toHaveBeenCalledWith(livePayload);

    unmount();

    expect(socketOffMock).toHaveBeenCalledWith('survey.live_results.updated', expect.any(Function));
  });

  it('removes vote-created listeners on unmount', () => {
    const { unmount } = render(<SurveySocketHarness />);

    unmount();

    expect(socketOffMock).toHaveBeenCalledWith('survey.vote.created', expect.any(Function));
    expect(socketDisconnectMock).toHaveBeenCalled();
  });
});
