import { describe, expect, it } from 'vitest';

import {
  SURVEY_ANALYTICS_RANGE_OPTIONS,
  createDefaultSurveyLiveRequestParams,
  normalizeStoredSurveyLiveRequestParams,
  selectSurveyAnalyticsRange,
} from './surveyAnalyticsRange';

describe('public survey analytics range', () => {
  it('uses unique preset ids and unambiguous labels', () => {
    expect(SURVEY_ANALYTICS_RANGE_OPTIONS).toEqual([
      { value: 'last_60m', label: 'Últimos 60 minutos' },
      { value: 'today', label: 'Hoy (desde las 00:00)' },
      { value: 'last_24h', label: 'Últimas 24 horas' },
    ]);
    expect(new Set(SURVEY_ANALYTICS_RANGE_OPTIONS.map((option) => option.value)).size).toBe(3);
  });

  it('keeps the analytics preset separate from the momentum window', () => {
    const params = createDefaultSurveyLiveRequestParams('America/Argentina/Buenos_Aires');

    expect(params).toMatchObject({
      range_preset: 'last_60m',
      range_timezone: 'America/Argentina/Buenos_Aires',
      momentum_window_minutes: 10,
    });
    expect(params).not.toHaveProperty('window_minutes');

    const today = selectSurveyAnalyticsRange(params, 'today');
    const last24h = selectSurveyAnalyticsRange(params, 'last_24h');
    expect(today.range_preset).toBe('today');
    expect(last24h.range_preset).toBe('last_24h');
    expect(today.momentum_window_minutes).toBe(10);
    expect(last24h.momentum_window_minutes).toBe(10);
  });

  it('builds explicit desde/hasta values for a custom range', () => {
    const fixedNow = new Date('2026-07-12T15:00:00.000Z');
    const custom = selectSurveyAnalyticsRange(
      createDefaultSurveyLiveRequestParams('America/Argentina/Buenos_Aires'),
      'custom',
      fixedNow,
    );

    expect(custom.range_preset).toBeUndefined();
    expect(custom.desde).toBe('2026-07-12T14:00:00.000Z');
    expect(custom.hasta).toBe('2026-07-12T15:00:00.000Z');
    expect(custom.range_timezone).toBe('America/Argentina/Buenos_Aires');
  });

  it('does not reinterpret the old ambiguous 1440-minute value', () => {
    const normalized = normalizeStoredSurveyLiveRequestParams(
      { include_heatmap: 1, window_minutes: 1440 },
      'America/Argentina/Buenos_Aires',
    );

    expect(normalized.range_preset).toBe('last_60m');
    expect(normalized.momentum_window_minutes).toBe(10);
    expect(normalized).not.toHaveProperty('window_minutes');
  });
});
