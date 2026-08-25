import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SurveyLiveHeatmapPreview } from './SurveyLiveHeatmapPreview';

vi.mock('@/components/LazyMapLibreMap', () => ({
  default: ({ heatmapData, evidence }: { heatmapData?: unknown[]; evidence?: { usingSyntheticPoints?: boolean; label?: string } }) => (
    <div
      data-testid="mock-survey-live-maplibre"
      data-points={String(heatmapData?.length ?? 0)}
      data-synthetic={String(Boolean(evidence?.usingSyntheticPoints))}
      data-evidence-label={evidence?.label}
    >
      mapa live {heatmapData?.length ?? 0}
    </div>
  ),
}));

describe('SurveyLiveHeatmapPreview', () => {
  it('renders a premium live territory summary from points and centroid cells', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
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
            label: 'Reforzar difusion por WhatsApp',
            priority: 'high',
            ui_hint: 'share_public_link',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-preview')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-privacy')).toHaveTextContent('Privacidad protegida');
    expect(screen.getByTestId('survey-live-heatmap-privacy')).toHaveTextContent('coordenadas aproximadas');
    expect(screen.getByTestId('survey-live-heatmap-radar')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-telemetry-route')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-focus-lock')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('Zonas activas');
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('Centro');
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('San Martin');
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('whatsapp');
    expect(screen.getByTestId('survey-live-heatmap-ai-signal')).toHaveTextContent('Fallback local seguro');
    expect(screen.getByTestId('survey-live-heatmap-ai-signal')).toHaveTextContent('encuesta o votacion');
    expect(screen.getByTestId('survey-live-heatmap-ai-signal')).toHaveTextContent('Reforzar difusion por WhatsApp');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('Radar de decision');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('Zona caliente');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('Centro');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('Canal dominante');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('whatsapp');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('Proxima accion');
    expect(screen.getByTestId('survey-live-heatmap-maplibre')).toBeInTheDocument();
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-points', '2');
    expect(screen.getByText(/Senal:/)).toHaveTextContent('10');
  });

  it('keeps an actionable empty state when there is no geolocated activity', () => {
    render(<SurveyLiveHeatmapPreview heatmap={{ points: [], cells: [] }} emptyLabel="Sin actividad territorial" />);

    expect(screen.getByTestId('survey-live-heatmap-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-radar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-telemetry-route')).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-focus-lock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-operational-summary')).not.toBeInTheDocument();
    expect(screen.getByText('Sin actividad territorial')).toBeInTheDocument();
    expect(screen.getByText('Ajusta filtros o espera nuevas respuestas en vivo.')).toBeInTheDocument();
  });

  it('keeps the decision radar available without an AI provider payload', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          points: [{ lat: -33.079, lon: -68.47, respuestas: 5, barrio: 'La Colonia', canal: 'widget' }],
          cells: [],
        }}
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-focus-lock')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('La Colonia');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('widget');
    expect(screen.getByTestId('survey-live-heatmap-decision-radar')).toHaveTextContent('Monitorear evolucion');
    expect(screen.queryByText('Senales IA')).not.toBeInTheDocument();
  });

  it('marks deterministic demo points as synthetic evidence on the rendered map', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          points: [{ lat: -34.5889, lng: -60.9462, count: 100, label: 'Junín' }],
          cells: [],
          metadata: {
            source: 'demo_seeded_responses',
            using_synthetic_points: true,
            synthetic: true,
          },
        }}
      />,
    );

    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-synthetic', 'true');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute(
      'data-evidence-label',
      'Escenario sintético',
    );
  });

  it('shows backend and local dataset limits instead of silently truncating the map HUD', () => {
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

    expect(screen.getByTestId('survey-live-heatmap-points-count')).toHaveTextContent('Puntos: 40/120');
    expect(screen.getByTestId('survey-live-heatmap-cells-count')).toHaveTextContent('Celdas: 40/64');
    expect(screen.getByTestId('survey-live-heatmap-dataset-limit')).toHaveTextContent('Dataset limitado por backend');
    expect(screen.getByTestId('mock-survey-live-maplibre')).toHaveAttribute('data-points', '40');
  });
});
