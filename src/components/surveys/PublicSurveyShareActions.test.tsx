import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PublicSurveyShareActions } from './PublicSurveyShareActions';
import type { PublicResponsePayload, SurveyPublic } from '@/types/encuestas';

const baseSurvey: SurveyPublic = {
  slug: 'consulta-barrial',
  titulo: 'Consulta barrial',
  descripcion: 'Prioridades del barrio',
  tipo: 'votacion',
  inicio_at: '2026-06-01',
  fin_at: '2026-06-30',
  politica_unicidad: 'libre',
  preguntas: [],
};

describe('PublicSurveyShareActions', () => {
  it('explains QR, share and realtime readiness before a response exists', () => {
    render(
      <PublicSurveyShareActions
        survey={{
          ...baseSurvey,
          es_votacion_envivo: true,
          mostrar_resultados_envivo: true,
        }}
      />,
    );

    const status = screen.getByTestId('public-survey-distribution-status');
    expect(status).toHaveTextContent('Difusion operativa');
    expect(status).toHaveTextContent('Link publico activo');
    expect(status).toHaveTextContent('Realtime encendido');
    expect(status).toHaveTextContent('QR para sala');
    expect(status).toHaveTextContent('Share multicanal');
    expect(status).toHaveTextContent('Preparado');
  });

  it('surfaces the submitted channel and synchronized state after participation', () => {
    const submission: PublicResponsePayload = {
      canal: 'qr',
      respuestas: [],
      metadata: {
        answeredQuestions: 2,
        totalQuestions: 3,
        canal: 'qr',
      },
    };

    render(<PublicSurveyShareActions survey={baseSurvey} submission={submission} />);

    const status = screen.getByTestId('public-survey-distribution-status');
    expect(status).toHaveTextContent('Respuesta registrada');
    expect(status).toHaveTextContent('Sincronizado');
    expect(status).toHaveTextContent('Canal qr');
    expect(screen.getByText('Preguntas respondidas: 2 de 3.')).toBeInTheDocument();
  });
});
