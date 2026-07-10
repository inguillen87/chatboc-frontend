import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyForm } from './SurveyForm';
import type { SurveyPublic } from '@/types/encuestas';

const envMock = vi.hoisted(() => ({ turnstileSiteKey: '' }));
const requestLocationMock = vi.hoisted(() => vi.fn());

vi.mock('@/env', () => ({
  get CLOUDFLARE_TURNSTILE_SITE_KEY() {
    return envMock.turnstileSiteKey;
  },
}));

vi.mock('@/utils/geolocation', () => ({
  requestLocation: (...args: unknown[]) => requestLocationMock(...args),
}));

const baseSurvey: SurveyPublic = {
  slug: 'consulta-barrial',
  titulo: 'Consulta barrial',
  descripcion: 'Prioridades del barrio',
  tipo: 'votacion',
  inicio_at: '2026-06-01',
  fin_at: '2026-06-30',
  politica_unicidad: 'libre',
  preguntas: [
    {
      id: 101,
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Que prioridad elegis?',
      obligatoria: true,
      opciones: [
        { id: 1, orden: 1, texto: 'Luminaria' },
        { id: 2, orden: 2, texto: 'Arbolado' },
      ],
    },
  ],
};

const securedSurvey: SurveyPublic = {
  ...baseSurvey,
  security: {
    contract_version: 'cloudflare.turnstile.public_intake.v1',
    provider: 'cloudflare_turnstile',
    surface: 'survey_public_response',
    required: true,
    enforced: true,
    status: 'required',
  },
  frontend_contract: {
    contract_version: 'surveys.public_frontend.v2',
    turnstile: {
      enabled: true,
      required: true,
      token_header: 'X-Turnstile-Token',
      token_fields: ['turnstile_token'],
    },
  },
};

const liveSurvey: SurveyPublic = {
  ...baseSurvey,
  es_votacion_envivo: true,
  realtime: {
    enabled: true,
  },
};

describe('SurveyForm security contract', () => {
  beforeEach(() => {
    envMock.turnstileSiteKey = '';
    requestLocationMock.mockReset();
    delete (window as any).turnstile;
    document.getElementById('chatboc-cloudflare-turnstile')?.remove();
  });

  it('renders Turnstile and submits the token when the public survey requires it', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const renderTurnstile = vi.fn((container: HTMLElement, options: { callback?: (token: string) => void }) => {
      container.setAttribute('data-rendered-turnstile', 'true');
      options.callback?.('survey-turnstile-token');
      return 'survey-widget-1';
    });
    (window as any).turnstile = {
      render: renderTurnstile,
      remove: vi.fn(),
    };
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={securedSurvey} onSubmit={onSubmit} />);

    expect(await screen.findByTestId('survey-turnstile-challenge')).toBeInTheDocument();
    await waitFor(() => expect(renderTurnstile).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        turnstile_token: 'survey-turnstile-token',
        respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
      }),
    );
  });

  it('resets Turnstile when backend response asks the frontend to reset it', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const resetTurnstile = vi.fn();
    const renderTurnstile = vi.fn((container: HTMLElement, options: { callback?: (token: string) => void }) => {
      container.setAttribute('data-rendered-turnstile', 'true');
      options.callback?.('expired-token');
      return 'survey-widget-1';
    });
    (window as any).turnstile = {
      render: renderTurnstile,
      remove: vi.fn(),
      reset: resetTurnstile,
    };

    const { rerender } = render(<SurveyForm survey={securedSurvey} onSubmit={vi.fn()} />);

    expect(await screen.findByTestId('survey-turnstile-challenge')).toBeInTheDocument();
    rerender(
      <SurveyForm
        survey={securedSurvey}
        onSubmit={vi.fn()}
        submitErrorMessage="No pudimos validar la verificacion de seguridad."
        submitErrorStatus={400}
        submitErrorDetails={{
          frontend_contract: { reset_turnstile: true },
          security: { reset_required: true },
        }}
      />,
    );

    await waitFor(() => expect(resetTurnstile).toHaveBeenCalledWith('survey-widget-1'));
  });

  it('keeps optional territorial capture available for live voting and submits manual location metadata', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={liveSurvey} onSubmit={onSubmit} />);

    expect(screen.getByText(/datos demogr/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/provincia/i), { target: { value: 'Mendoza' } });
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'Junin' } });
    fireEvent.change(screen.getByLabelText(/barrio/i), { target: { value: 'Centro' } });
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
        metadata: expect.objectContaining({
          demographics: expect.objectContaining({
            ubicacion: expect.objectContaining({
              provincia: 'Mendoza',
              ciudad: 'Junin',
              barrio: 'Centro',
              precision: 'manual',
              origen: 'usuario',
            }),
          }),
        }),
      }),
    );
  });

  it('submits gps location metadata for live voting when the user shares current location', async () => {
    requestLocationMock.mockResolvedValueOnce({ latitud: -33.0861, longitud: -68.4712 });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={liveSurvey} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /usar mi ubicaci/i }));

    await waitFor(() => expect(requestLocationMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/coordenadas registradas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          demographics: expect.objectContaining({
            ubicacion: expect.objectContaining({
              lat: -33.0861,
              lng: -68.4712,
              precision: 'gps',
              origen: 'gps',
            }),
          }),
        }),
      }),
    );
  });
});
