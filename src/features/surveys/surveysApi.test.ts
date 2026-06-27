import { beforeEach, describe, expect, it, vi } from 'vitest';

const panelGetMock = vi.fn();
const panelPostMock = vi.fn();
const panelPatchMock = vi.fn();
const publicGetMock = vi.fn();
const publicPostMock = vi.fn();

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: (...args: unknown[]) => panelGetMock(...args),
    post: (...args: unknown[]) => panelPostMock(...args),
    patch: (...args: unknown[]) => panelPatchMock(...args),
  },
  publicApi: {
    get: (...args: unknown[]) => publicGetMock(...args),
    post: (...args: unknown[]) => publicPostMock(...args),
  },
}));

import { getPublicSurveyLiveResultsV2, respondPublicSurveyV2 } from './surveysApi';

describe('surveysApi v2 public live results', () => {
  beforeEach(() => {
    panelGetMock.mockReset();
    panelPostMock.mockReset();
    panelPatchMock.mockReset();
    publicGetMock.mockReset();
    publicPostMock.mockReset();
    publicGetMock.mockResolvedValue({});
    publicPostMock.mockResolvedValue({});
  });

  it('posts public responses and accepts the enriched live-results ack contract', async () => {
    publicPostMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'surveys.public_response.v2',
      response_id: 12,
      live_results_url: '/api/v2/public/surveys/token-1/live-results',
    });

    const response = await respondPublicSurveyV2(
      'token-1',
      { anon_id: 'anon-1', respuestas: [{ pregunta_id: 1, opcion_id: 2 }] },
      'junin',
    );

    expect(publicPostMock).toHaveBeenCalledWith(
      '/api/v2/public/surveys/token-1/respond',
      { anon_id: 'anon-1', respuestas: [{ pregunta_id: 1, opcion_id: 2 }] },
      { tenantSlug: 'junin' },
    );
    expect(response.live_results_url).toBe('/api/v2/public/surveys/token-1/live-results');
  });

  it('requests v2 live results with heatmap and momentum params', async () => {
    await getPublicSurveyLiveResultsV2(
      'token-1',
      'junin',
      { include_heatmap: false, max_points: 500, max_cells: 80, window_minutes: 15 },
    );

    expect(publicGetMock).toHaveBeenCalledWith(
      '/api/v2/public/surveys/token-1/live-results?include_heatmap=0&max_points=500&max_cells=80&window_minutes=15',
      { tenantSlug: 'junin' },
    );
  });
});
