import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SurveyPublic } from '@/types/encuestas';

vi.mock('@/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config')>()),
  ENABLE_SURVEY_ANALYTICS_FALLBACK: true,
}));

vi.mock('@/api/encuestas', () => ({
  downloadExportCsv: vi.fn(),
  getSurveyDashboardBundle: vi.fn().mockRejectedValue(new Error('dashboard unavailable')),
  getHeatmap: vi.fn().mockRejectedValue(new Error('heatmap unavailable')),
  getSummary: vi.fn().mockRejectedValue(new Error('summary unavailable')),
  getTimeseries: vi.fn().mockRejectedValue(new Error('timeseries unavailable')),
}));

import { useSurveyAnalytics } from './useSurveyAnalytics';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const surveyFixture = (): SurveyPublic => ({
  id: 45,
  slug: 'junin-participa',
  titulo: 'Prioridades barriales',
  descripcion: 'Consulta publica',
  tipo: 'sondeo',
  inicio_at: '2026-07-01T00:00:00.000Z',
  fin_at: '2026-07-31T23:59:00.000Z',
  politica_unicidad: 'libre',
  municipio_nombre: 'Junin',
  preguntas: [
    {
      id: 1,
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Que prioridad queres resolver primero?',
      obligatoria: true,
      opciones: [
        { id: 1, orden: 1, texto: 'Luminaria' },
        { id: 2, orden: 2, texto: 'Arreglo de calle' },
      ],
    },
  ],
});

describe('useSurveyAnalytics fallback heatmap contract', () => {
  it('marks locally generated fallback heatmap points as synthetic demo data', async () => {
    const { result } = renderHook(
      () => useSurveyAnalytics(45, {}, { fallbackSurvey: surveyFixture(), fallbackCount: 8 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.heatmapPayload?.points?.length).toBeGreaterThan(0);
    });

    expect(result.current.heatmapMeta).toMatchObject({
      using_synthetic_points: true,
      render_contract: {
        state: 'demo_fallback',
      },
    });
    expect(result.current.heatmapPayload).toMatchObject({
      using_synthetic_points: true,
      render_contract: {
        state: 'demo_fallback',
        preferred_visualization: 'summary_only',
      },
    });
    expect(result.current.provenance).toEqual({
      source: 'frontend_demo_fallback',
      synthetic: true,
      affected_modules: ['summary', 'timeseries', 'heatmap'],
      disclaimer: 'Datos sinteticos de demostracion; no representan respuestas reales.',
    });
  });
});
