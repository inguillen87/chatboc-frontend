import { describe, expect, it } from 'vitest';

import { pickHeatmap, pickTimeseries } from '@/utils/surveyAnalyticsFallback';

describe('surveyAnalyticsFallback pickers', () => {
  it('returns empty arrays when both sources are undefined', () => {
    expect(pickTimeseries(undefined, undefined)).toEqual([]);
    expect(pickHeatmap(undefined, undefined)).toEqual([]);
  });

  it('keeps primary arrays when present', () => {
    const primaryTimeseries = [{ fecha: '2026-01-01', respuestas: 3 }];
    const primaryHeatmap = [{ lat: -34.6, lng: -58.4, respuestas: 2 }];

    expect(pickTimeseries(primaryTimeseries, [{ fecha: '2026-01-02', respuestas: 1 }])).toBe(primaryTimeseries);
    expect(pickHeatmap(primaryHeatmap, [{ lat: -34.7, lng: -58.5, respuestas: 1 }])).toBe(primaryHeatmap);
  });
});
