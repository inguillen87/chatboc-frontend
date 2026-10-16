import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyAnalytics } from './SurveyAnalytics';
import { normalizeSurveySummary } from '@/api/encuestas';
import type { SurveyAnalyticsHeatmap, SurveySummary } from '@/types/encuestas';

const motionHarness = vi.hoisted(() => ({ shouldReduceMotion: false }));

vi.mock('framer-motion', () => ({
  useReducedMotion: () => motionHarness.shouldReduceMotion,
}));

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const PieChartContainer = ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-pie-chart">{children}</div>
  );
  const BarChartContainer = ({ children, data }: { children?: ReactNode; data?: unknown[] }) => (
    <div data-testid="mock-bar-chart" data-chart-data={JSON.stringify(data)}>{children}</div>
  );
  const Empty = () => null;
  return {
    ResponsiveContainer: Container,
    BarChart: BarChartContainer,
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
    tasa_completitud: 88,
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

const OFFICIAL_SOURCE = 'https://ide.mendoza.gov.ar/junin/survey-boundary';
const OFFICIAL_SHA = 'a'.repeat(64);
const JURISDICTION_CONTRACT_VERSION = 'surveys.heatmap.jurisdiction.v1';
const PROVENANCE_CONTRACT_VERSION = 'surveys.heatmap.territorial_provenance.v1';
const MAP_CONTRACT_VERSION = 'surveys.heatmap.map_render.v1';
const POINT_EVIDENCE_CONTRACT_VERSION = 'surveys.heatmap.point_jurisdiction_evidence.v1';
const containedJurisdictionEvidence = {
  contract_version: POINT_EVIDENCE_CONTRACT_VERSION,
  containment_verified: true,
  coordinate_jurisdiction_status: 'within',
  containment_method: 'point_in_polygon',
  authority_kind: 'official',
  source_ref: OFFICIAL_SOURCE,
  snapshot_sha256: OFFICIAL_SHA,
};
const containedPoint = {
  containment_verified: true,
  coordinate_jurisdiction_status: 'within',
  source_ref: OFFICIAL_SOURCE,
  snapshot_sha256: OFFICIAL_SHA,
  jurisdiction_evidence: containedJurisdictionEvidence,
};
const heatmapFixture = () => [
  { lat: -33.086, lng: -68.471, respuestas: 12, categoria: 'Centro', canal: 'whatsapp', ...containedPoint },
  { lat: -33.081, lng: -68.462, respuestas: 7, categoria: 'Barrio Norte', canal: 'web', ...containedPoint },
];

const metadataFixture = (): NonNullable<SurveyAnalyticsHeatmap['metadata']> => ({
  jurisdiction: {
    contract_version: JURISDICTION_CONTRACT_VERSION,
    enforced: true,
    containment_verified: true,
    containment_method: 'point_in_polygon',
    boundary_authority: {
      kind: 'official',
      source_ref: OFFICIAL_SOURCE,
      snapshot_sha256: OFFICIAL_SHA,
    },
  },
  provenance: {
    contract_version: PROVENANCE_CONTRACT_VERSION,
    source_ref: OFFICIAL_SOURCE,
    snapshot_sha256: OFFICIAL_SHA,
  },
  map: {
    contract_version: MAP_CONTRACT_VERSION,
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
  beforeEach(() => {
    motionHarness.shouldReduceMotion = false;
  });

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
    const chartData = JSON.parse(screen.getByTestId('mock-bar-chart').getAttribute('data-chart-data') ?? '[]');
    expect(chartData.map((row: { respuestasSeleccionaron: number }) => row.respuestasSeleccionaron)).toEqual([1, 1]);
    expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
  });

  it.each(['opcion_multiple', 'multiple_choice', 'multiple-choice', 'multiple', 'checkbox', 'check', 'multi_select', 'multi-select', 'multiselect'])(
    'uses the canonical multiple-choice contract with internal type %s',
    (internalType) => {
      const summary = eligibleMultipleSummaryFixture();
      summary.preguntas[0].tipo_interno = internalType;
      render(<SurveyAnalytics summary={normalizeSurveySummary(summary)} onExport={vi.fn().mockResolvedValue(undefined)} />);
      const rates = screen.getByTestId('survey-eligible-option-rates');
      expect(rates).toHaveTextContent('En selección múltiple pueden sumar más de 100%.');
      expect(within(rates).getAllByRole('row').slice(1).every((row) => row.textContent?.includes('100%'))).toBe(true);
      expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
    },
  );

  it('recognizes a legacy checkbox without a canonical question type', () => {
    const summary = eligibleMultipleSummaryFixture();
    summary.preguntas[0].tipo = undefined;
    summary.preguntas[0].tipo_interno = 'checkbox';
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByTestId('survey-eligible-option-rates')).toHaveTextContent('En selección múltiple pueden sumar más de 100%.');
  });

  it('lets canonical single choice take precedence over an internal alias', () => {
    const summary = eligibleMultipleSummaryFixture();
    summary.preguntas[0].tipo = 'single_choice';
    summary.preguntas[0].tipo_interno = 'opcion_multiple';
    summary.preguntas[0].opciones[1] = { ...summary.preguntas[0].opciones[1], respuestas: 0, respuestas_seleccionaron: 0, porcentaje: 0, porcentaje_elegibles: 0, porcentaje_respuestas_pregunta: 0 };
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByTestId('survey-eligible-option-rates')).not.toHaveTextContent('En selección múltiple pueden sumar más de 100%.');
  });

  it('renders real backend demographic counts including zero without inventing percentages or duplicate aliases', () => {
    const genero = [{ label: 'Femenino', value: 3 }, { label: 'Masculino', value: 2 }, { label: 'Otro', value: 0 }];
    const summary = normalizeSurveySummary({ total_respuestas: 10, preguntas: [], demografia: {
      genero, genero_series: genero, genero_map: { Femenino: 3, Masculino: 2, Otro: 0 },
      edad: { promedio: 40, mediana: 38, p90: 70, muestra: 5 },
    } });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const demographicCard = screen.getByText('Segmentación demográfica').closest('[class*="rounded"]') as HTMLElement;
    const charts = within(demographicCard).getAllByTestId('mock-bar-chart');
    expect(charts).toHaveLength(1);
    const rows = JSON.parse(charts[0].getAttribute('data-chart-data') ?? '[]');
    expect(rows.map((row: { label: string; value: number }) => [row.label, row.value])).toEqual([['Femenino', 3], ['Masculino', 2], ['Otro', 0]]);
    expect(rows.every((row: Record<string, unknown>) => !('percentage' in row))).toBe(true);
    expect(within(demographicCard).queryByText(/series|map/i)).not.toBeInTheDocument();
  });

  it.each([false, true])('uses the exact question-response percentage when eligibility is estimated (stale fields: %s)', (staleFields) => {
    const summary = normalizeSurveySummary({ total_respuestas: 5, preguntas: [{
      texto: 'Canales utilizados', tipo: 'multiple_choice', tipo_interno: 'checkbox',
      base_elegibles_estimada: true, respuestas_elegibles_estimadas: 2, respuestas_respondidas: 4,
      ...(staleFields ? { respuestas_elegibles: 2, tasa_respuesta_elegible: 200 } : {}),
      opciones: ['WhatsApp', 'Web'].map((texto) => ({ texto, respuestas: 4, respuestas_seleccionaron: 4,
        porcentaje_total_encuesta: 80, porcentaje_respuestas_pregunta: 100,
        ...(staleFields ? { porcentaje_elegibles: 200 } : {}),
      })),
    }] });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const rates = screen.getByTestId('survey-eligible-option-rates');
    const rows = within(rates).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveTextContent('100%');
      expect(row).toHaveTextContent('sobre respuestas de la pregunta');
      expect(row).toHaveTextContent('2 elegibles estimados');
      expect(row).toHaveTextContent('4 respondieron');
      expect(row).not.toHaveTextContent('200%');
      expect(row).not.toHaveTextContent('sobre elegibles');
    }
    expect(screen.queryByTestId('mock-pie-chart')).not.toBeInTheDocument();
  });

  it('uses only the supplied total-survey rate if the question-response rate is absent from an estimated base', () => {
    const summary = normalizeSurveySummary({ total_respuestas: 5, preguntas: [{
      texto: 'Canales utilizados', tipo: 'multiple_choice', base_elegibles_estimada: true,
      respuestas_elegibles_estimadas: 2, respuestas_elegibles: 2, respuestas_respondidas: 4,
      opciones: [{ texto: 'Web', respuestas: 4, respuestas_seleccionaron: 4, porcentaje_total_encuesta: 80 }],
    }] });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const row = screen.getByText('Web').closest('tr');
    expect(row).toHaveTextContent('80%');
    expect(row).toHaveTextContent('sobre total de encuesta');
    expect(row).toHaveTextContent('2 elegibles estimados');
    expect(row).not.toHaveTextContent('200%');
  });

  it('does not invent a rate from an estimated denominator or normalized legacy percentage', () => {
    const summary = normalizeSurveySummary({ total_respuestas: 5, preguntas: [{
      texto: 'Canales utilizados', tipo: 'multiple_choice', base_elegibles_estimada: true,
      respuestas_elegibles_estimadas: 0, respuestas_elegibles: 2, respuestas_respondidas: 4,
      opciones: [{ texto: 'Web', respuestas: 4, respuestas_seleccionaron: 4 }],
    }] });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const row = screen.getByText('Web').closest('tr');
    expect(row).toHaveTextContent('Sin tasa exacta');
    expect(row).toHaveTextContent('0 elegibles estimados');
    expect(row).not.toHaveTextContent('%');
  });

  it('does not display an unavailable eligible estimate as zero when the sample cap is zero', () => {
    const summary = normalizeSurveySummary({ total_respuestas: 5, preguntas: [{
      texto: 'Canales utilizados', tipo: 'multiple_choice', base_elegibles_estimada: true,
      respuestas_elegibles_estimadas: null, respuestas_respondidas: 4,
      opciones: [{ texto: 'Web', respuestas: 4, porcentaje_respuestas_pregunta: 100 }],
    }] });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const row = screen.getByText('Web').closest('tr');
    expect(row).toHaveTextContent('Base elegible estimada');
    expect(row).toHaveTextContent('100%');
    expect(row).toHaveTextContent('sobre respuestas de la pregunta');
    expect(row).not.toHaveTextContent('0 elegibles');
  });

  it('renders the backend territorial demographic series once per attribute', () => {
    const barrios = [{ label: 'Centro', value: 4 }, { label: 'Norte', value: 0 }];
    const ciudades = [{ label: 'Ushuaia', value: 4 }];
    const summary = normalizeSurveySummary({ total_respuestas: 10, preguntas: [], demografia: {
      territorio: [{ key: 'barrios', label: 'Barrios', series: barrios }, { key: 'ciudades', label: 'Ciudades', series: ciudades }],
      territorio_map: { barrios, ciudades },
    } });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const demographicCard = screen.getByText('Segmentación demográfica').closest('[class*="rounded"]') as HTMLElement;
    const charts = within(demographicCard).getAllByTestId('mock-bar-chart');
    expect(charts).toHaveLength(2);
    expect(charts.map((chart) => JSON.parse(chart.getAttribute('data-chart-data') ?? '[]').map((row: { label: string; value: number }) => [row.label, row.value]))).toEqual([[['Centro', 4], ['Norte', 0]], [['Ushuaia', 4]]]);
    expect(within(demographicCard).getByText('Barrios')).toBeInTheDocument();
    expect(within(demographicCard).getByText('Ciudades')).toBeInTheDocument();
  });

  it('preserves legacy demographic counts and explicit zero percentages while rejecting invalid counts', () => {
    const summary = normalizeSurveySummary({ total_respuestas: 5, preguntas: [], demografia: { genero: [
      { etiqueta: 'Sin declarar', respuestas: 0, porcentaje: 0 },
      { clave: 'Femenino', respuestas: 3, porcentaje: 60 },
      { label: 'Inválido', value: -1 }, { label: 'No finito', value: Number.NaN },
    ] } });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const chart = within(screen.getByText('Segmentación demográfica').closest('[class*="rounded"]') as HTMLElement).getByTestId('mock-bar-chart');
    const rows = JSON.parse(chart.getAttribute('data-chart-data') ?? '[]');
    expect(rows.map((row: { label: string; value: number; percentage: number }) => [row.label, row.value, row.percentage])).toEqual([
      ['Sin declarar', 0, 0], ['Femenino', 3, 60],
    ]);
  });

  it('uses compatibility demographic maps once when canonical series are absent', () => {
    const summary = normalizeSurveySummary({ total_respuestas: 5, preguntas: [], demografia: {
      genero_map: { Femenino: 3, Masculino: 0 },
      territorio_map: { barrios: [{ label: 'Centro', value: 3 }] },
    } });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const charts = within(screen.getByText('Segmentación demográfica').closest('[class*="rounded"]') as HTMLElement).getAllByTestId('mock-bar-chart');
    expect(charts).toHaveLength(2);
    expect(charts.map((chart) => JSON.parse(chart.getAttribute('data-chart-data') ?? '[]').map((row: { label: string; value: number }) => [row.label, row.value]))).toEqual([
      [['Femenino', 3], ['Masculino', 0]], [['Centro', 3]],
    ]);
  });

  it('keeps exact eligible rates authoritative when the estimated-base flag is false', () => {
    const summary = normalizeSurveySummary({ total_respuestas: 5, preguntas: [{
      texto: 'Canales utilizados', tipo: 'multiple_choice', base_elegibles_estimada: false,
      respuestas_elegibles_estimadas: 2, respuestas_elegibles: 4, respuestas_respondidas: 4,
      opciones: [{ texto: 'Web', respuestas: 4, respuestas_seleccionaron: 4, porcentaje_elegibles: 100, porcentaje_total_encuesta: 80 }],
    }] });
    render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const row = screen.getByText('Web').closest('tr');
    expect(row).toHaveTextContent('100%');
    expect(row).toHaveTextContent('sobre elegibles');
    expect(row).toHaveTextContent('4 elegibles');
    expect(row).not.toHaveTextContent('estimados');
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
    expect(commandCenter).toHaveTextContent('Mapa vivo de participación');
    expect(commandCenter).toHaveTextContent('Evidencia territorial activa');
    expect(commandCenter).toHaveTextContent('MapLibre GL');
    expect(commandCenter).toHaveTextContent('38.0%');
    expect(commandCenter).toHaveTextContent('50 respuestas totales');
    expect(commandCenter).toHaveTextContent('Centro con 12 respuestas');
    expect(commandCenter).toHaveTextContent('whatsapp (31)');
    expect(screen.getByTestId('survey-territory-telemetry')).toBeInTheDocument();
  });

  it('keeps an explicit non-government territorial contract usable without an official polygon', () => {
    const points = heatmapFixture().map(({ lat, lng, respuestas, categoria, canal }) => ({
      lat,
      lng,
      respuestas,
      categoria,
      canal,
    }));
    const metadata = {
      ...metadataFixture(),
      jurisdiction: {
        contract_version: JURISDICTION_CONTRACT_VERSION,
        required: false,
        state: 'not_required',
      },
      provenance: { contract_version: PROVENANCE_CONTRACT_VERSION },
    };

    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmap={points}
        heatmapMeta={metadata}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('mock-survey-map')).toBeInTheDocument();
    expect(screen.queryByTestId('survey-territory-evidence-block')).not.toBeInTheDocument();
  });

  it.each([
    ['missing authority contract', null],
    ['missing provenance', { ...metadataFixture(), provenance: undefined }],
    ['missing jurisdiction contract version', {
      ...metadataFixture(),
      jurisdiction: { ...metadataFixture().jurisdiction, contract_version: undefined },
    }],
    ['unknown jurisdiction contract version', {
      ...metadataFixture(),
      jurisdiction: { ...metadataFixture().jurisdiction, contract_version: 'surveys.heatmap.jurisdiction.v2' },
    }],
    ['missing provenance contract version', {
      ...metadataFixture(),
      provenance: { ...metadataFixture().provenance, contract_version: undefined },
    }],
    ['unknown provenance contract version', {
      ...metadataFixture(),
      provenance: { ...metadataFixture().provenance, contract_version: 'surveys.heatmap.territorial_provenance.v2' },
    }],
    ['missing map contract version', {
      ...metadataFixture(),
      map: { ...(metadataFixture().map as Record<string, unknown>), contract_version: undefined },
    }],
    ['unknown map contract version', {
      ...metadataFixture(),
      map: { ...(metadataFixture().map as Record<string, unknown>), contract_version: 'surveys.heatmap.map_render.v2' },
    }],
    ['case-sensitive provenance source mismatch', {
      ...metadataFixture(),
      provenance: {
        ...metadataFixture().provenance,
        source_ref: OFFICIAL_SOURCE.replace('/junin/', '/Junin/'),
      },
    }],
    ['mismatched snapshot', {
      ...metadataFixture(),
      provenance: {
        ...metadataFixture().provenance,
        snapshot_sha256: 'b'.repeat(64),
      },
    }],
    ['invalid authority snapshot', {
      ...metadataFixture(),
      jurisdiction: {
        ...metadataFixture().jurisdiction,
        boundary_authority: {
          ...metadataFixture().jurisdiction?.boundary_authority,
          snapshot_sha256: 'not-a-sha',
        },
      },
    }],
  ])('fails closed with an executive state for %s', (_label, metadata) => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmap={heatmapFixture()}
        heatmapMeta={metadata ?? undefined}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('survey-territory-evidence-block')).toHaveTextContent('Lectura territorial bloqueada');
    expect(screen.queryByTestId('mock-survey-map')).not.toBeInTheDocument();
    expect(screen.queryByText(/focos detectados/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Evidencia territorial activa')).not.toBeInTheDocument();
  });

  it('blocks the entire territorial reading when one point lacks verified containment', () => {
    const points = heatmapFixture();
    points[1] = { ...points[1], containment_verified: false };
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmap={points}
        heatmapMeta={metadataFixture()}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const state = screen.getByTestId('survey-territory-evidence-block');
    expect(state).toHaveTextContent('Puntos territoriales pendientes de validación');
    expect(state).toHaveTextContent('Próxima acción');
    expect(screen.queryByTestId('mock-survey-map')).not.toBeInTheDocument();
  });

  it.each([
    ['status', { coordinate_jurisdiction_status: 'outside' }],
    ['source', { source_ref: 'https://untrusted.example/boundary' }],
    ['case-sensitive source', { source_ref: OFFICIAL_SOURCE.replace('/junin/', '/Junin/') }],
    ['snapshot', { snapshot_sha256: 'b'.repeat(64) }],
    ['valid snapshot', { snapshot_sha256: 'not-a-sha' }],
    ['missing point contract version', {
      jurisdiction_evidence: { ...containedJurisdictionEvidence, contract_version: undefined },
    }],
    ['unknown point contract version', {
      jurisdiction_evidence: {
        ...containedJurisdictionEvidence,
        contract_version: 'surveys.heatmap.point_jurisdiction_evidence.v2',
      },
    }],
  ])('blocks territorial output when a point has mismatched %s evidence', (_field, override) => {
    const points = heatmapFixture();
    points[1] = { ...points[1], ...override };

    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmap={points}
        heatmapMeta={metadataFixture()}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('survey-territory-evidence-block')).toHaveTextContent(
      'Puntos territoriales pendientes de validación',
    );
    expect(screen.queryByTestId('mock-survey-map')).not.toBeInTheDocument();
    expect(screen.queryByText(/focos detectados/i)).not.toBeInTheDocument();
  });

  it('uses an evidence-first empty state instead of drawing synthetic territory', () => {
    render(
      <SurveyAnalytics
        summary={{ ...summaryFixture(), total_respuestas: 18 }}
        heatmap={[]}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const commandCenter = screen.getByTestId('survey-territory-command-center');
    expect(commandCenter).toHaveTextContent('Cobertura territorial pendiente');
    expect(commandCenter).toHaveTextContent('0 registros georreferenciados');
    expect(commandCenter).toHaveTextContent('No se generan puntos');
    expect(commandCenter).not.toHaveTextContent('Cobertura geográfica');
    expect(screen.queryByTestId('survey-territory-telemetry')).not.toBeInTheDocument();
  });

  it('keeps synthetic survey heatmap data out of territorial metrics and maps', () => {
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
    expect(commandCenter).toHaveTextContent('Cobertura territorial pendiente');
    expect(screen.queryByTestId('mock-survey-map')).not.toBeInTheDocument();
    expect(screen.queryByText(/focos detectados/i)).not.toBeInTheDocument();
  });

  it.each([
    { total: 200, rate: 0.5, expected: '0.5%' },
    { total: 100, rate: 1, expected: '1.0%' },
    { total: 1, rate: 100, expected: '100.0%' },
    { total: 200, rate: 0, expected: '0.0%' },
  ])('preserves $rate percentage points over $total received responses', ({ total, rate, expected }) => {
    render(<SurveyAnalytics summary={{ ...summaryFixture(), total_respuestas: total, tasa_completitud: rate }} onExport={vi.fn().mockResolvedValue(undefined)} />);
    const card = screen.getByText('Completitud de respuestas recibidas').closest('[class*="rounded"]');
    expect(card).toHaveTextContent('Respuestas completas sobre respuestas recibidas');
    expect(card).toHaveTextContent('No mide formularios iniciados ni población convocada');
    expect(within(card as HTMLElement).getByText(expected, { exact: true })).toBeInTheDocument();
  });

  it.each([null, undefined, -1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    'keeps an unavailable completion rate when the server value is %s',
    (rate) => {
      const summary = { ...summaryFixture(), tasa_completitud: rate } as unknown as SurveySummary;
      render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
      const card = screen.getByText('Completitud de respuestas recibidas').closest('[class*="rounded"]');
      expect(within(card as HTMLElement).getByText('—', { exact: true })).toBeInTheDocument();
    },
  );

  it.each([0, -1, null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 0.5])(
    'keeps completion unavailable without a valid positive received-response count: %s',
    (total) => {
      const summary = { ...summaryFixture(), total_respuestas: total, tasa_completitud: 0 } as unknown as SurveySummary;
      render(<SurveyAnalytics summary={summary} onExport={vi.fn().mockResolvedValue(undefined)} />);
      const card = screen.getByText('Completitud de respuestas recibidas').closest('[class*="rounded"]');
      expect(within(card as HTMLElement).getByText('—', { exact: true })).toBeInTheDocument();
    },
  );

  it('keeps completion unavailable before a summary is received', () => {
    render(<SurveyAnalytics onExport={vi.fn().mockResolvedValue(undefined)} />);
    const card = screen.getByText('Completitud de respuestas recibidas').closest('[class*="rounded"]');
    expect(within(card as HTMLElement).getByText('—', { exact: true })).toBeInTheDocument();
  });

  it('uses authoritative backend geographic coverage when supplied', () => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmap={heatmapFixture()}
        heatmapMeta={{
          ...metadataFixture(),
          map: { ...metadataFixture().map, coverage_pct: 82.4 },
        }}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('survey-territory-command-center')).toHaveTextContent('82.4%');
  });

  it('removes non-essential SVG motion when the user prefers reduced motion', () => {
    motionHarness.shouldReduceMotion = true;

    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmap={heatmapFixture()}
        heatmapMeta={metadataFixture()}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const telemetry = screen.getByTestId('survey-territory-telemetry');
    expect(telemetry.querySelector('animate')).toBeNull();
    expect(telemetry.querySelector('animateMotion')).toBeNull();
    expect(telemetry.querySelector('animateTransform')).toBeNull();
  });

  it('labels every synthetic analytics module as demo data, not real responses', () => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        timeseries={[{ fecha: '2026-06-05', respuestas: 12 }]}
        onExport={vi.fn().mockResolvedValue(undefined)}
        provenance={{
          source: 'frontend_demo_fallback',
          synthetic: true,
          affected_modules: ['summary', 'timeseries'],
        }}
      />,
    );

    const notice = screen.getByTestId('survey-analytics-synthetic-notice');
    expect(notice).toHaveTextContent(/no son respuestas reales/i);
    expect(notice).toHaveTextContent('summary, timeseries');
    expect(notice).toHaveTextContent(/solo esta habilitado en desarrollo o pruebas/i);
  });

  it('shows backend-validated citizen provenance in the admin analytics header', () => {
    const summary = summaryFixture();
    summary.data_provenance = {
      contract_version: 'surveys.response_provenance.v1',
      mode: 'real',
      server_trusted_classification: true,
      contains_synthetic: false,
      real_responses_included: 50,
      synthetic_responses_included: 0,
      synthetic_responses_excluded: 100,
      synthetic_marker_contract: 'surveys.demo_seeding.v1',
    };

    render(
      <SurveyAnalytics
        summary={summary}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const provenance = screen.getByTestId('survey-response-provenance-real');
    expect(provenance).toHaveTextContent('Resultados ciudadanos');
    expect(provenance).toHaveTextContent('100 respuestas excluidas');
  });

  it('renders rich backend heatmap payload without requiring a separate metadata prop', () => {
    render(
      <SurveyAnalytics
        summary={summaryFixture()}
        heatmapPayload={{
          points: [
            { lat: -33.086, lng: -68.471, value: 14, respuestas: 14, categoria: 'Centro', canal: 'whatsapp', ...containedPoint },
          ],
          map: {
            contract_version: MAP_CONTRACT_VERSION,
            render_ready: true,
            provider_hint: 'maplibre',
            fallback_provider: 'maplibre',
            available_providers: ['maplibre'],
          },
          category_layers: {
            categories: [{ categoria: 'Centro', color: '#22d3ee', event_count: 14 }],
          },
          render_contract: { state: 'live', preferred_visualization: 'territory_map' },
          jurisdiction: metadataFixture().jurisdiction,
          provenance: metadataFixture().provenance,
        }}
        onExport={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const commandCenter = screen.getByTestId('survey-territory-command-center');
    expect(commandCenter).toHaveTextContent('Evidencia territorial activa');
    expect(commandCenter).toHaveTextContent('Centro con 14 respuestas');
    expect(screen.getAllByTestId('mock-survey-map').some((map) => map.getAttribute('data-points') === '1')).toBe(true);
  });
});
