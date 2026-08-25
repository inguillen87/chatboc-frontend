import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SurveyLiveHeatmapPreview } from './SurveyLiveHeatmapPreview';

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: ({
    heatmapData,
    evidence,
    showHeatmap,
    ariaLabel,
    fitBoundsRequestKey,
    popupContext,
  }: {
    heatmapData?: Array<{ categoryColor?: string }>;
    evidence?: { usingSyntheticPoints?: boolean; label?: string };
    showHeatmap?: boolean;
    ariaLabel?: string;
    fitBoundsRequestKey?: number;
    popupContext?: string;
  }) => (
    <div
      data-testid="mock-survey-live-maplibre"
      data-points={String(heatmapData?.length ?? 0)}
      data-synthetic={String(Boolean(evidence?.usingSyntheticPoints))}
      data-evidence-label={evidence?.label}
      data-show-heatmap={String(Boolean(showHeatmap))}
      data-fit-request={String(fitBoundsRequestKey ?? 0)}
      data-popup-context={popupContext}
      data-category-colors={heatmapData?.map((point) => point.categoryColor ?? '').join(',')}
      aria-label={ariaLabel}
    >
      mapa live {heatmapData?.length ?? 0}
    </div>
  ),
}));

const jurisdiction = {
  contract_version: 'demo.jurisdiction.v1',
  country: 'Argentina',
  province: 'Mendoza',
  municipality: 'Junin',
  display_name: 'Junin, Mendoza',
  center: { lat: -33.144539, lng: -68.485729 },
  coordinate_reference: 'WGS84',
  coordinate_source: 'tenant_demo_profile',
};

describe('SurveyLiveHeatmapPreview', () => {
  it('renders an executive, source-backed territorial dashboard without decorative radar UI', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          source: 'survey_live_results',
          jurisdiction,
          points: [
            { lat: -33.079, lon: -68.47, respuestas: 7, barrio: 'Centro', canal: 'whatsapp' },
            { lat: -33.081, lng: -68.475, respuestas: 3, barrio: 'San Martin', canal: 'web' },
          ],
          cells: [
            { id: 'cell-1', centroid_lat: -33.08, centroid_lon: -68.472, count: 11, barrio: 'Centro', channel: 'whatsapp' },
          ],
          metadata: {
            privacy_mode: 'public_aggregated',
            raw_points_redacted: true,
            coordinate_precision: 'rounded_3_decimals',
            provider: 'municipal_analytics',
          },
        }}
        aiSignal={{
          mode: 'deterministic_local_fallback',
          hf_status: { configured: false, used: false },
          summary: {
            dominant_intent_label: 'encuesta o votacion',
            risk_level: 'normal',
            requires_human_attention: false,
          },
        }}
        operatorRecommendations={[
          {
            id: 'share_survey_now',
            label: 'Reforzar difusión por WhatsApp',
            priority: 'high',
            ui_hint: 'share_public_link',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-preview')).toBeInTheDocument();
    const layout = screen.getByTestId('survey-live-heatmap-layout');
    expect(layout).toHaveClass(
      'p-2',
      'sm:p-3',
      'lg:p-4',
      '2xl:grid-cols-[minmax(0,1.8fr)_minmax(17rem,0.55fr)]',
    );
    expect(layout).not.toHaveClass('xl:grid-cols-[minmax(0,1.8fr)_minmax(17rem,0.55fr)]');
    expect(screen.getByTestId('survey-live-heatmap-jurisdiction')).toHaveTextContent('Junin, Mendoza');
    expect(screen.getByTestId('survey-live-heatmap-privacy')).toHaveTextContent('Privacidad protegida');
    expect(screen.getByTestId('survey-live-heatmap-evidence-summary')).toHaveTextContent('survey live results');
    expect(screen.getByTestId('survey-live-heatmap-evidence-summary')).toHaveTextContent('WGS84');
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent('Densidad espacial relativa');
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent('mín. 3');
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent('mediana 5');
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent('máx. 7');
    expect(screen.getByTestId('survey-live-heatmap-zone-ranking')).toHaveTextContent('Centro');
    expect(screen.getByTestId('survey-live-heatmap-zone-ranking')).toHaveTextContent('70%');
    expect(screen.getByTestId('survey-live-heatmap-zone-ranking')).toHaveTextContent('San Martin');
    expect(screen.getByTestId('survey-live-heatmap-channel-ranking')).toHaveTextContent('whatsapp');
    expect(screen.getByTestId('survey-live-heatmap-executive-summary')).toHaveTextContent('Mayor participación');
    expect(screen.getByTestId('survey-live-heatmap-executive-summary')).toHaveTextContent('Centro');
    expect(screen.getByTestId('survey-live-heatmap-ai-signal')).toHaveTextContent('Fallback local seguro');
    expect(screen.getByTestId('survey-live-heatmap-ai-signal')).toHaveTextContent('encuesta o votacion');
    expect(screen.getByTestId('survey-live-heatmap-ai-signal')).toHaveTextContent('Reforzar difusión por WhatsApp');
    expect(screen.queryByText('share_public_link')).not.toBeInTheDocument();
    expect(screen.queryByText(/radar/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-radar')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-points', '2');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute(
      'aria-label',
      'Mapa de participación de Junin, Mendoza',
    );
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-popup-context', 'survey');
  });

  it('offers keyboard-addressable density, point and fit controls', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          jurisdiction,
          points: [{ lat: -33.144539, lng: -68.485729, count: 12, label: 'Centro' }],
          cells: [],
        }}
      />,
    );

    const densityButton = screen.getByRole('button', { name: 'Densidad' });
    const pointsButton = screen.getByRole('button', { name: 'Puntos' });
    const fitButton = screen.getByRole('button', { name: 'Ajustar área' });
    expect(densityButton).toHaveAttribute('aria-pressed', 'true');
    expect(pointsButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-show-heatmap', 'true');

    fireEvent.click(pointsButton);
    expect(pointsButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-show-heatmap', 'false');
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent(
      'Volumen por ubicación',
    );

    fireEvent.click(fitButton);
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-fit-request', '1');
  });

  it('uses the point legend palette for relative minimum, intermediate and maximum volumes', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          jurisdiction,
          points: [
            { lat: -33.14, lng: -68.48, count: 1, label: 'Mínima' },
            { lat: -33.145, lng: -68.485, count: 4, label: 'Intermedia' },
            { lat: -33.15, lng: -68.49, count: 7, label: 'Máxima' },
          ],
          cells: [],
        }}
      />,
    );

    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute(
      'data-category-colors',
      '#38bdf8,#1f54dd,#ef4444',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Puntos' }));
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent('mín. 1');
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent('mediana 4');
    expect(screen.getByTestId('survey-live-heatmap-quantitative-legend')).toHaveTextContent('máx. 7');

    const colorRamp = screen.getByTestId('survey-live-heatmap-color-ramp');
    expect(colorRamp.getAttribute('style')).toContain('#38bdf8 0%');
    expect(colorRamp.getAttribute('style')).toContain('#1d4ed8 58%');
    expect(colorRamp.getAttribute('style')).toContain('#ef4444 100%');
  });

  it('does not invent geographic positions when aggregates lack coordinates', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          jurisdiction,
          points: [{ respuestas: 5, barrio: 'La Colonia', canal: 'widget' }],
          cells: [],
        }}
      />,
    );

    expect(screen.queryByTestId('survey-live-heatmap-maplibre')).not.toBeInTheDocument();
    expect(screen.getByText(/no coordenadas suficientes/i)).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-zone-ranking')).toHaveTextContent('La Colonia');
    expect(screen.getByTestId('survey-live-heatmap-executive-summary')).toHaveTextContent('La Colonia');
  });

  it('rejects blank, out-of-range and zero-placeholder coordinates before rendering the map', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          jurisdiction,
          points: [
            { lat: '', lng: '', count: 1, barrio: 'Vacía' },
            { lat: null, lng: null, count: 1, barrio: 'Nula' },
            { lat: 91, lng: -68.48, count: 1, barrio: 'Latitud inválida' },
            { lat: -33.14, lng: 181, count: 1, barrio: 'Longitud inválida' },
            { lat: 0, lng: 0, count: 1, barrio: 'Marcador nulo' },
            { lat: -33.144539, lng: -68.485729, count: 1, barrio: 'Centro' },
          ] as any,
          cells: [],
        }}
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-points-count')).toHaveTextContent('6');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-points', '1');
  });

  it('reports every distinct zone while limiting the operational ranking to five', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          jurisdiction,
          points: Array.from({ length: 7 }, (_, index) => ({
            lat: -33.14 - index * 0.001,
            lng: -68.48 - index * 0.001,
            count: 7 - index,
            barrio: `Zona ${index + 1}`,
          })),
          cells: [],
        }}
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-zones-count')).toHaveTextContent('7');
    expect(screen.getByText('Top 5 de 7')).toBeInTheDocument();
    const ranking = within(screen.getByTestId('survey-live-heatmap-zone-ranking'));
    expect(ranking.getByText('Zona 5')).toBeInTheDocument();
    expect(ranking.queryByText('Zona 6')).not.toBeInTheDocument();
    expect(ranking.queryByText('Zona 7')).not.toBeInTheDocument();
  });

  it('keeps an actionable empty state while preserving jurisdiction evidence', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{ jurisdiction, points: [], cells: [] }}
        emptyLabel="Sin actividad territorial"
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-jurisdiction')).toHaveTextContent('Junin, Mendoza');
    expect(screen.queryByTestId('survey-live-heatmap-maplibre')).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-operational-summary')).not.toBeInTheDocument();
    expect(screen.getByText('Sin actividad territorial')).toBeInTheDocument();
    expect(screen.getByText(/Ajustá los filtros/i)).toBeInTheDocument();
  });

  it('marks deterministic demo points as synthetic and exposes source, size and provenance', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          source: 'demo_seeded_responses',
          jurisdiction,
          points: [{ lat: -33.144539, lng: -68.485729, count: 100, label: 'Junín' }],
          cells: [],
          metadata: {
            provider: 'chatboc_demo_seed',
            source: 'demo_seeded_responses',
            point_count: 1,
            using_synthetic_points: true,
            synthetic: true,
          },
        }}
      />,
    );

    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-synthetic', 'true');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-evidence-label', 'Escenario sintético');
    expect(screen.getByTestId('survey-live-heatmap-provenance')).toHaveTextContent('Datos sintéticos de demostración');
    expect(screen.getByTestId('survey-live-heatmap-evidence-summary')).toHaveTextContent('Respuestas sintéticas determinísticas');
    expect(screen.getByTestId('survey-live-heatmap-evidence-summary')).toHaveTextContent('Motor de escenarios Chatboc');
    expect(screen.getByTestId('survey-live-heatmap-evidence-summary')).toHaveTextContent('1 ubicación');
    expect(screen.getByTestId('survey-live-heatmap-evidence-summary')).toHaveTextContent('100 respuestas representadas');
  });

  it('shows backend dataset limits instead of silently truncating evidence', () => {
    const points = Array.from({ length: 40 }, (_, index) => ({
      lat: -33.08 - index * 0.001,
      lng: -68.47 + index * 0.001,
      respuestas: index + 1,
      barrio: `Zona ${index + 1}`,
      canal: 'web',
    }));
    const cells = Array.from({ length: 40 }, (_, index) => ({
      id: `cell-${index + 1}`,
      centroid_lat: -33.09 - index * 0.001,
      centroid_lon: -68.45 + index * 0.001,
      count: index + 2,
      barrio: `Celda ${index + 1}`,
      channel: 'whatsapp',
    }));

    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          jurisdiction,
          points,
          cells,
          metadata: {
            points_count: 120,
            cells_count: 64,
            truncated_points: true,
            truncated_cells: true,
          },
        }}
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-points-count')).toHaveTextContent('40/120');
    expect(screen.getByTestId('survey-live-heatmap-cells-count')).toHaveTextContent('40/64');
    expect(screen.getByTestId('survey-live-heatmap-dataset-limit')).toHaveTextContent('Dataset limitado por backend');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-points', '40');
  });
});
