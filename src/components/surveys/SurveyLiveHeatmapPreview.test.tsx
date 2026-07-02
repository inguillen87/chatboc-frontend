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
        }}
      />,
    );

    expect(screen.getByTestId('survey-live-heatmap-preview')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-radar')).toBeInTheDocument();
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('Zonas activas');
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('Centro');
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('San Martin');
    expect(screen.getByTestId('survey-live-heatmap-operational-summary')).toHaveTextContent('whatsapp');
    expect(screen.getByText(/Senal:/)).toHaveTextContent('21');
  });

  it('keeps an actionable empty state when there is no geolocated activity', () => {
    render(<SurveyLiveHeatmapPreview heatmap={{ points: [], cells: [] }} emptyLabel="Sin actividad territorial" />);

    expect(screen.getByTestId('survey-live-heatmap-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-radar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-live-heatmap-operational-summary')).not.toBeInTheDocument();
    expect(screen.getByText('Sin actividad territorial')).toBeInTheDocument();
    expect(screen.getByText('Ajusta filtros o espera nuevas respuestas en vivo.')).toBeInTheDocument();
  });
});
