import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SurveyAnalytics } from './SurveyAnalytics';
import type { SurveyAnalyticsHeatmap, SurveySummary } from '@/types/encuestas';

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const PieChartContainer = ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-pie-chart">{children}</div>
  );
  const Empty = () => null;
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    LineChart: Container,
    PieChart: PieChartContainer,
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

const eligibleMultipleSummaryFixture = (): SurveySummary =>
  ({
    total_respuestas: 2,
    participantes_unicos: 2,
    tasa_completitud: 100,
    preguntas: [
      {
        pregunta_id: 10,
        texto: 'Canales utilizados',
        tipo: 'multiple_choice',
        tipo_interno: 'opcion_multiple',
        total_respuestas: 2,
        respuestas_elegibles: 1,
        respuestas_respondidas: 1,
        tasa_respuesta_elegible: 100,
        opciones: [
          {
            opcion_id: 1,
            texto: 'WhatsApp',
            respuestas: 1,
            porcentaje: 50,
            respuestas_seleccionaron: 1,
            porcentaje_total_encuesta: 50,
            porcentaje_elegibles: 100,
            porcentaje_respuestas_pregunta: 100,
          },
          {
            opcion_id: 2,
            texto: 'Web',
            respuestas: 1,
            porcentaje: 50,
            respuestas_seleccionaron: 1,
            porcentaje_total_encuesta: 50,
            porcentaje_elegibles: 100,
            porcentaje_respuestas_pregunta: 100,
          },
        ],
      },
    ],
  }) satisfies SurveySummary;

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
  it('renders multiple-choice eligibility as independent rates instead of a distribution pie', () => {
    render(
      <SurveyAnalytics
        summary={eligibleMultipleSummaryFixture()}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const ratesTable = screen.getByTestId('survey-eligible-option-rates');
    const rows = within(ratesTable).getAllByRole('row');

    expect(ratesTable).toHaveTextContent(
      'En selección múltiple pueden sumar más de 100%.',
    );
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('WhatsApp');
    expect(rows[1]).toHaveTextContent('100%');
    expect(rows[1]).toHaveTextContent('sobre elegibles');
    expect(rows[2]).toHaveTextContent('Web');
    expect(rows[2]).toHaveTextContent('100%');
    expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
  });

  it('keeps the legacy distribution fallback when eligibility metrics are absent', () => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByTestId('survey-eligible-option-rates')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-pie-chart')).toBeInTheDocument();
  });

  it('labels legacy rows honestly inside a mixed eligibility payload', () => {
    const mixedSummary = eligibleMultipleSummaryFixture();
    mixedSummary.preguntas.push({
      pregunta_id: 11,
      texto: 'Prioridad legacy',
      total_respuestas: 2,
      opciones: [
        {
          opcion_id: 3,
          texto: 'Arbolado',
          respuestas: 1,
          porcentaje: 50,
        },
      ],
    });

    render(
      <SurveyAnalytics
        summary={mixedSummary}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const legacyRow = screen.getByText('Arbolado').closest('tr');
    expect(legacyRow).not.toBeNull();
    expect(legacyRow).toHaveTextContent('porcentaje legacy');
    expect(legacyRow).toHaveTextContent('Base elegible no informada');
  });

  it('does not treat a total-survey percentage alone as an eligible denominator', () => {
    const partialSummary = summaryFixture();
    partialSummary.preguntas[0].opciones[0].porcentaje_total_encuesta = 52;

    render(
      <SurveyAnalytics
        summary={partialSummary}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByTestId('survey-eligible-option-rates')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-pie-chart')).toBeInTheDocument();
  });

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

  it('renders rich backend heatmap payload without requiring a separate metadata prop', () => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmapPayload={{
          points: [
            { lat: -33.086, lng: -68.471, value: 14, respuestas: 14, categoria: 'Centro', canal: 'whatsapp' },
          ],
          map: {
            render_ready: true,
            provider_hint: 'maplibre',
            fallback_provider: 'maplibre',
            available_providers: ['maplibre'],
          },
          category_layers: {
            categories: [{ categoria: 'Centro', color: '#22d3ee', event_count: 14 }],
          },
          render_contract: { state: 'live', preferred_visualization: 'territory_map' },
        }}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const commandCenter = screen.getByTestId('survey-territory-command-center');
    expect(commandCenter).toHaveTextContent('Mapa real activo');
    expect(commandCenter).toHaveTextContent('Centro con 14 respuestas');
    expect(screen.getAllByTestId('mock-survey-map').some((map) => map.getAttribute('data-points') === '1')).toBe(true);
  });
});
