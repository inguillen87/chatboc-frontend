import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SurveyOperationsOverview } from '@/components/surveys/SurveyOperationsOverview';

describe('SurveyOperationsOverview', () => {
  it('renders only source-backed totals and explains the unavailable denominator', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="colegio-demo"
        freshness={{
          generated_at: '2026-08-02T12:00:00Z',
          source: 'enc_encuesta_and_enc_respuesta',
          synthetic: false,
        }}
        overview={{
          total: 3,
          por_estado: { publicada: 2, borrador: 1 },
          activas: 2,
          con_respuestas: 2,
          total_respuestas: 48,
          respuestas_con_coordenadas: 0,
          respuestas_ultimas_24h: 7,
          accepting_responses: 2,
          por_tipo_instrumento: { survey: 2, voting: 1 },
          participation_denominator: {
            available: false,
            reason_code: 'survey_eligible_population_not_configured',
          },
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Estado operativo' })).toBeTruthy();
    expect(screen.getByText('colegio-demo')).toBeTruthy();
    expect(screen.getByText('2 encuestas · 1 votaciones')).toBeTruthy();
    expect(screen.getByText('48')).toBeTruthy();
    expect(screen.getByText(/abstención no se calculan/i)).toBeTruthy();
  });
});
