import { render, screen } from '@testing-library/react';

import { SurveyLiveHeatmapPreview } from '@/components/surveys/SurveyLiveHeatmapPreview';

describe('SurveyLiveHeatmapPreview', () => {
  it('renders live heatmap counts and geographic points', () => {
    render(
      <SurveyLiveHeatmapPreview
        heatmap={{
          points: [
            { lat: -33.081, lng: -68.47, value: 4, barrio: 'Centro', canal: 'WhatsApp' },
            { lat: -33.09, lng: -68.45, respuestas: 2, barrio: 'Villa Talleres' },
          ],
          cells: [{ id: 'centro', value: 6, barrio: 'Centro' }],
        }}
      />,
    );

    const preview = screen.getByTestId('survey-live-heatmap-preview');
    expect(preview).toHaveTextContent('Mapa de calor ciudadano');
    expect(preview).toHaveTextContent('Puntos: 2');
    expect(preview).toHaveTextContent('Celdas: 1');
    expect(screen.getByText('En vivo')).toBeInTheDocument();
    expect(screen.getByText('Intensidad por volumen de respuestas')).toBeInTheDocument();
  });

  it('renders a professional empty state when there are no geolocated results', () => {
    render(<SurveyLiveHeatmapPreview heatmap={{ points: [], cells: [] }} />);

    expect(screen.getByTestId('survey-live-heatmap-preview')).toHaveTextContent(
      'Sin actividad geolocalizada para los filtros actuales',
    );
  });
});
