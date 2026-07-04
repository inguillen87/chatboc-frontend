import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SurveyLiveHeatmapPreview } from './SurveyLiveHeatmapPreview';

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
    expect(screen.getByText(/Senal:/)).toHaveTextContent('21');
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
});
