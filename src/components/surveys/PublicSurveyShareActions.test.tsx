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
    expect(screen.getByText('Analíticas preparadas')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Al responder, el tablero recibirá los metadatos autorizados de difusión, demografía y ubicación.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Analíticas capturadas')).not.toBeInTheDocument();
  });

  it('surfaces the submitted channel and synchronized state after participation', () => {
    const submission: PublicResponsePayload = {
      submission_id: '018f4c8e-1e56-7f38-a4df-83fd68394874',
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
    expect(screen.getByText('Analíticas capturadas')).toBeInTheDocument();
    expect(screen.getByText('Preguntas respondidas: 2 de 3.')).toBeInTheDocument();
  });

  it('keeps WhatsApp and QR links in the explicit tenant scope', () => {
    render(
      <PublicSurveyShareActions
        survey={{ ...baseSurvey, tenant_slug: 'tenant-equivocado' }}
        tenantSlug="rio-grande"
      />,
    );

    const whatsappLink = screen.getByRole('link', { name: /Compartir por WhatsApp/i });
    const whatsappUrl = new URL(whatsappLink.getAttribute('href') ?? '');
    const sharedText = whatsappUrl.searchParams.get('text') ?? '';
    expect(sharedText).toContain('tenant_slug=rio-grande');
    expect(sharedText).not.toContain('tenant-equivocado');

    const qrImage = screen.getByRole('img', { name: /Código QR para participar/i });
    expect(decodeURIComponent(qrImage.getAttribute('src') ?? '')).toContain(
      'tenant_slug=rio-grande',
    );
  });
});
