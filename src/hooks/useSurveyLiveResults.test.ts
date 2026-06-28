import { describe, expect, it } from 'vitest';

import {
  getSurveyLivePollingInterval,
  hasSurveyLiveActivity,
  resolveSurveyLiveStatus,
} from './useSurveyLiveResults';

describe('useSurveyLiveResults helpers', () => {
  it('uses backend polling cadence safely and falls back to live momentum', () => {
    expect(getSurveyLivePollingInterval({ render_contract: { polling_interval_ms: 1000 } })).toBe(2500);
    expect(getSurveyLivePollingInterval({ render_contract: { polling_interval_ms: 45000 } })).toBe(30000);
    expect(getSurveyLivePollingInterval({ render_contract: { polling_interval_ms: 7000 } })).toBe(7000);
    expect(getSurveyLivePollingInterval({ momentum: { trend: 'subiendo' } })).toBe(3000);
  });

  it('slows down when hidden or reconnecting', () => {
    expect(getSurveyLivePollingInterval(undefined, true, 0)).toBe(15000);
    expect(getSurveyLivePollingInterval(undefined, false, 3)).toBe(5000);
    expect(getSurveyLivePollingInterval(undefined, false, 4)).toBe(10000);
    expect(getSurveyLivePollingInterval(undefined, false, 9)).toBe(20000);
  });

  it('detects empty live payloads across totals, questions, timeline and heatmap', () => {
    expect(
      hasSurveyLiveActivity({
        total_respuestas: 0,
        preguntas: [{ total_votos: 0, opciones: [{ votos: 0 }] }],
        timeline_minute: [{ total: 0 }],
        heatmap: { points: [], cells: [] },
      }),
    ).toBe(false);

    expect(hasSurveyLiveActivity({ preguntas: [{ total_votos: 2 }] })).toBe(true);
    expect(hasSurveyLiveActivity({ timeline_minute: [{ total: 3 }] })).toBe(true);
    expect(hasSurveyLiveActivity({ heatmap: { points: [{}] } })).toBe(true);
  });

  it('maps query flags to a user-facing live state', () => {
    expect(
      resolveSurveyLiveStatus({
        enabled: true,
        isLoading: false,
        isFetching: false,
        hasData: true,
        hasActivity: false,
        hasError: false,
        consecutiveErrors: 0,
        isDocumentHidden: false,
      }).status,
    ).toBe('empty');

    expect(
      resolveSurveyLiveStatus({
        enabled: true,
        isLoading: false,
        isFetching: false,
        hasData: true,
        hasActivity: true,
        hasError: true,
        consecutiveErrors: 3,
        isDocumentHidden: false,
      }).status,
    ).toBe('reconnecting');

    expect(
      resolveSurveyLiveStatus({
        enabled: true,
        isLoading: false,
        isFetching: false,
        hasData: false,
        hasActivity: false,
        hasError: true,
        consecutiveErrors: 1,
        isDocumentHidden: false,
      }).status,
    ).toBe('error');
  });
});
