import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SurveyAnalytics } from './SurveyAnalytics';
import type { SurveyAnalyticsHeatmap, SurveySummary } from '@/types/encuestas';

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    LineChart: Container,
    PieChart: Container,
    Bar: Container,
    Line: Container,
    Pie: Container,
    Cell: Empty,
    CartesianGrid: Empty,
    Legend: Empty,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: ({ heatmapData, provider }: { heatmapData?: unknown[]; provider?: string }) => (
    <div data-testid="mock-survey-map" data-points={String(heatmapData?.length ?? 0)} data-provider={provider ?? ''} />
  ),
}));

vi.mock('@/components/analytics/MeasuredContainer', () => ({
  MeasuredContainer: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/hooks/useMapProvider', () => ({
  useMapProvider: () => ({
    provider: 'maplibre',
    setProvider: vi.fn(),
  }),
}));

vi.mock('@/components/MapProviderToggle', () => ({
  MapProviderToggle: ({ value }: { value: string }) => <button type="button">Proveedor {value}</button>,
}));

vi.mock('@/services/enterpriseService', () => ({
  enterpriseService: {
    trackEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

const summaryFixture = (): SurveySummary =>
  ({
    total_respuestas: 50,
    participantes_unicos: 42,
    tasa_completitud: 0.88,
    canales: [
      { canal: 'whatsapp', respuestas: 31 },
      { canal: 'web', respuestas: 19 },
    ],
    preguntas: [
      {
        texto: 'Prioridad barrial',
        opciones: [
          { texto: 'Luminaria', respuestas: 26, porcentaje: 52 },
          { texto: 'Arbolado', respuestas: 24, porcentaje: 48 },
        ],
      },
    ],
  }) as unknown as SurveySummary;

const heatmapFixture = () => [
  { lat: -33.086, lng: -68.471, respuestas: 12, categoria: 'Centro', canal: 'whatsapp' },
  { lat: -33.081, lng: -68.462, respuestas: 7, categoria: 'Barrio Norte', canal: 'web' },
];

const metadataFixture = (): NonNullable<SurveyAnalyticsHeatmap['metadata']> => ({
  map: {
    render_ready: true,
    provider_hint: 'maplibre',
    fallback_provider: 'maplibre',
    available_providers: ['maplibre'],
  },
  category_layers: {
    categories: [
      { categoria: 'Centro', color: '#22d3ee', event_count: 12 },
      { categoria: 'Barrio Norte', color: '#fbbf24', event_count: 7 },
    ],
  },
});

describe('SurveyAnalytics territory command center', () => {
  it('renders a premium territorial command center for real survey heatmap points', () => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        timeseries={[{ fecha: '2026-06-05', respuestas: 12 }]}
        heatmap={heatmapFixture()}
        heatmapMeta={metadataFixture()}
        onExport={vi.fn().mockResolvedValue(undefined)}
        tenantSlug="junin"
        tenantId={1}
      />,
    );

    const commandCenter = screen.getByTestId('survey-territory-command-center');
    expect(commandCenter).toHaveTextContent('Centro territorial');
    expect(commandCenter).toHaveTextContent('Mapa vivo de participacion');
    expect(commandCenter).toHaveTextContent('Mapa real activo');
    expect(commandCenter).toHaveTextContent('MapLibre GL');
    expect(commandCenter).toHaveTextContent('4.0%');
    expect(commandCenter).toHaveTextContent('50 respuestas totales');
    expect(commandCenter).toHaveTextContent('Centro con 12 respuestas');
    expect(commandCenter).toHaveTextContent('whatsapp (31)');
    expect(screen.getByTestId('survey-territory-telemetry')).toBeInTheDocument();
  });

  it('marks synthetic survey heatmap data as fallback instead of real territory', () => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmap={heatmapFixture()}
        heatmapMeta={{
          ...metadataFixture(),
          using_synthetic_points: true,
          render_contract: { state: 'demo_fallback' },
        }}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const commandCenter = screen.getByTestId('survey-territory-command-center');
    expect(commandCenter).toHaveTextContent('Fallback sintetico');
    expect(commandCenter).toHaveTextContent('demo/fallback');
    expect(commandCenter).toHaveTextContent('No se presenta como precision territorial real');
  });
});
