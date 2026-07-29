import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyForm } from './SurveyForm';
import type { SurveyPublic } from '@/types/encuestas';
import { ApiError, NetworkError } from '@/utils/api';
import { AmbiguousSurveySubmissionError } from '@/utils/surveySubmissionErrors';
import { runBootstrapPrivacyMigrations } from '@/utils/bootstrapPrivacy';

const envMock = vi.hoisted(() => ({ turnstileSiteKey: '' }));
const requestLocationMock = vi.hoisted(() => vi.fn());
const userMock = vi.hoisted(() => ({ user: null as null | { id: number }, loading: false }));
const analyticsMocks = vi.hoisted(() => ({
  answerSelected: vi.fn(),
  submitError: vi.fn(),
}));

vi.mock('@/env', () => ({
  CLERK_PUBLISHABLE_KEY: '',
  get CLOUDFLARE_TURNSTILE_SITE_KEY() {
    return envMock.turnstileSiteKey;
  },
}));

vi.mock('@/utils/geolocation', () => ({
  requestLocation: (...args: unknown[]) => requestLocationMock(...args),
}));

vi.mock('@/utils/surveyAnalytics', () => ({
  trackSurveyAnswerSelected: (...args: unknown[]) => analyticsMocks.answerSelected(...args),
  trackSurveySubmitError: (...args: unknown[]) => analyticsMocks.submitError(...args),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: userMock.user,
    loading: userMock.loading,
    setUser: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const baseSurvey: SurveyPublic = {
  slug: 'consulta-barrial',
  instrument_revision: 7,
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

const adaptiveSurvey: SurveyPublic = {
  ...baseSurvey,
  slug: 'entrevista-adaptativa',
  titulo: 'Entrevista adaptativa',
  preguntas: [
    {
      id: 301,
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Usaste WhatsApp?',
      obligatoria: true,
      opciones: [
        { id: 3011, orden: 1, texto: 'Si' },
        { id: 3012, orden: 2, texto: 'No' },
      ],
    },
    {
      id: 302,
      orden: 2,
      tipo: 'opcion_unica',
      texto: 'Como fue la experiencia?',
      obligatoria: true,
      conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 1 } },
      opciones: [
        { id: 3021, orden: 1, texto: 'Buena' },
        { id: 3022, orden: 2, texto: 'Mala' },
      ],
    },
    {
      id: 303,
      orden: 3,
      tipo: 'abierta',
      texto: 'Que deberiamos mejorar?',
      obligatoria: true,
      conditional_logic: { version: 1, show_if: { question_order: 2, option_order: 2 } },
    },
  ],
};

const authenticatedSurvey: SurveyPublic = {
  ...baseSurvey,
  politica_unicidad: 'por_usuario',
  auth_mode: 'required',
  anonimo_permitido: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SurveyForm security contract', () => {
  beforeEach(() => {
    envMock.turnstileSiteKey = '';
    userMock.user = null;
    userMock.loading = false;
    requestLocationMock.mockReset();
    analyticsMocks.answerSelected.mockReset();
    analyticsMocks.submitError.mockReset();
    delete (window as any).turnstile;
    document.getElementById('chatboc-cloudflare-turnstile')?.remove();
    window.localStorage.clear();
  });

  it('gates one-person voting behind account authentication', () => {
    render(<SurveyForm survey={authenticatedSurvey} onSubmit={vi.fn()} />);

    expect(screen.getByTestId('survey-auth-gate')).toHaveTextContent('Identifica tu participacion');
    expect(screen.getByRole('link', { name: /iniciar sesion para participar/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/login?return_to='),
    );
    expect(screen.queryByLabelText('Luminaria')).not.toBeInTheDocument();
  });

  it('submits an authenticated vote without copying user identifiers into the payload', async () => {
    userMock.user = { id: 77 };
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={authenticatedSurvey} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.instrument_revision).toBe(7);
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('userId');
    expect(payload.respuestas).toEqual([{ pregunta_id: 101, opcion_ids: [1] }]);
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

  it('renders only the active adaptive path and submits visible answers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SurveyForm survey={adaptiveSurvey} onSubmit={onSubmit} />);

    expect(screen.getByText(/usaste whatsapp/i)).toBeInTheDocument();
    expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument();
    expect(screen.getByText('Pregunta 1 de 1')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Si'));
    expect(await screen.findByText(/como fue la experiencia/i)).toBeInTheDocument();
    expect(screen.getByText('Pregunta 2 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mala'));
    expect(await screen.findByText(/que deberiamos mejorar/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/escrib/i), {
      target: { value: 'Mas claridad' },
    });

    fireEvent.click(screen.getByLabelText('No'));
    await waitFor(() => expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/que deberiamos mejorar/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        respuestas: [{ pregunta_id: 301, opcion_ids: [3012] }],
        metadata: expect.objectContaining({ answeredQuestions: 1, totalQuestions: 1 }),
      }),
    );
  });

  it('clears hidden branch errors and stale descendant answers when the controller changes', async () => {
    render(<SurveyForm survey={adaptiveSurvey} onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.click(screen.getByLabelText('Si'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(await screen.findByText(/^seleccion.+una opci.n\.$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('No'));
    await waitFor(() => expect(screen.queryByText(/^seleccion.+una opci.n\.$/i)).not.toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Si'));
    expect(await screen.findByText(/como fue la experiencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Mala')).not.toBeChecked();
    expect(screen.queryByText(/que deberiamos mejorar/i)).not.toBeInTheDocument();
  });

  it('shows every adaptive question in read-only aggregate results', () => {
    render(
      <SurveyForm
        survey={adaptiveSurvey}
        onSubmit={vi.fn()}
        readOnly
        showLiveResults
        liveResults={{ total_respuestas: 12, preguntas: {} }}
      />,
    );

    expect(screen.getByText(/usaste whatsapp/i)).toBeInTheDocument();
    expect(screen.getByText(/como fue la experiencia/i)).toBeInTheDocument();
    expect(screen.getByText(/que deberiamos mejorar/i)).toBeInTheDocument();
  });

  it('does not restore or rewrite response PII after the bootstrap privacy migration', async () => {
    window.localStorage.setItem(
      'chatboc:survey:draft:global:entrevista-adaptativa',
      JSON.stringify({
        updatedAt: Date.now(),
        answers: { 301: { opcionIds: [3011] } },
        dni: '12345678',
      }),
    );
    window.localStorage.setItem(
      'chatboc_offline_draft_queue',
      JSON.stringify([
        { id: 'legacy-response', type: 'survey_response', payload: { phone: '5491112345678' } },
        { id: 'ticket-draft', type: 'create_ticket_draft', payload: { title: 'Sin luz' } },
      ]),
    );
    window.localStorage.setItem('unrelated-key', 'preserved');
    runBootstrapPrivacyMigrations();

    render(<SurveyForm survey={adaptiveSurvey} onSubmit={vi.fn()} />);

    expect(screen.getByText(/usaste whatsapp/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument());
    await waitFor(() =>
      expect(window.localStorage.getItem('chatboc:survey:draft:global:entrevista-adaptativa')).toBeNull(),
    );
    expect(JSON.parse(window.localStorage.getItem('chatboc_offline_draft_queue') ?? '[]')).toEqual([
      { id: 'ticket-draft', type: 'create_ticket_draft', payload: { title: 'Sin luz' } },
    ]);
    expect(window.localStorage.getItem('unrelated-key')).toBe('preserved');

    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.click(screen.getByLabelText('Si'));
    expect(storageSetSpy).not.toHaveBeenCalled();
  });

  it('reuses one UUID and submittedAt after ambiguous failures, then rotates them after edits and ACK', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new AmbiguousSurveySubmissionError('Incomplete durable ack'))
      .mockRejectedValueOnce(new NetworkError('Network unavailable'))
      .mockResolvedValue(undefined);
    const isoSpy = vi
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('2026-07-28T12:00:00.000Z')
      .mockReturnValueOnce('2026-07-28T12:01:00.000Z')
      .mockReturnValueOnce('2026-07-28T12:02:00.000Z');

    render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const firstAttempt = onSubmit.mock.calls[0][0];
    expect(firstAttempt.submission_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(firstAttempt.metadata?.submittedAt).toBe('2026-07-28T12:00:00.000Z');
    expect(screen.getByLabelText('Luminaria')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    const retryAttempt = onSubmit.mock.calls[1][0];
    expect(retryAttempt.submission_id).toBe(firstAttempt.submission_id);
    expect(retryAttempt.metadata?.submittedAt).toBe(firstAttempt.metadata?.submittedAt);
    expect(isoSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Arbolado'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3));
    const editedAttempt = onSubmit.mock.calls[2][0];
    expect(editedAttempt.submission_id).not.toBe(firstAttempt.submission_id);
    expect(editedAttempt.metadata?.submittedAt).toBe('2026-07-28T12:01:00.000Z');
    await waitFor(() => expect(screen.getByLabelText('Arbolado')).not.toBeChecked());

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(4));
    const postAckAttempt = onSubmit.mock.calls[3][0];
    expect(postAckAttempt.submission_id).not.toBe(editedAttempt.submission_id);
    expect(postAckAttempt.metadata?.submittedAt).toBe('2026-07-28T12:02:00.000Z');
  });

  it('keeps answers but rotates the attempt after a submission id conflict', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Submission id conflict', 409, {
        reason_code: 'survey_submission_id_conflict',
      }))
      .mockResolvedValue(undefined);

    render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const conflictedAttempt = onSubmit.mock.calls[0][0];

    expect(screen.getByLabelText('Luminaria')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    expect(onSubmit.mock.calls[1][0].submission_id).not.toBe(conflictedAttempt.submission_id);
  });

  it.each([400, 429])('keeps one submission id when the unchanged payload is retried after HTTP %s', async (status) => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Retry without changing the response', status))
      .mockResolvedValueOnce(undefined);

    render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    expect(onSubmit.mock.calls[1][0].submission_id).toBe(onSubmit.mock.calls[0][0].submission_id);
  });

  it('clears in-memory answers and identity after an explicit terminal duplicate', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new ApiError('Duplicate', 409, {
      reason_code: 'survey_response_duplicate',
      duplicate: true,
    }));
    render(
      <SurveyForm
        survey={{ ...baseSurvey, requiere_datos_contacto: true }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Documento'), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText(/tel.fono/i), { target: { value: '5491112345678' } });
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    expect(screen.getByLabelText('Documento')).toHaveValue('');
    expect(screen.getByLabelText(/tel.fono/i)).toHaveValue('');
  });

  it('labels only an explicit duplicate reason as a duplicate, not every 409', async () => {
    const { rerender } = render(
      <SurveyForm
        survey={baseSurvey}
        onSubmit={vi.fn()}
        submitErrorMessage="La encuesta cambio de revision."
        submitErrorStatus={409}
        submitReasonCode="survey_instrument_revision_conflict"
      />,
    );

    expect(await screen.findByText('No pudimos enviar tu respuesta')).toBeInTheDocument();
    expect(screen.queryByText(/ya registramos tu opini.n/i)).not.toBeInTheDocument();

    rerender(
      <SurveyForm
        survey={baseSurvey}
        onSubmit={vi.fn()}
        submitErrorMessage="La respuesta ya existe."
        submitErrorStatus={409}
        submitReasonCode="survey_response_duplicate"
      />,
    );

    expect(await screen.findByText(/ya registramos tu opini.n/i)).toBeInTheDocument();
  });

  it('invalidates a failed submission attempt when slug, revision, or signed-in user changes', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Ack unavailable'));
    const { rerender } = render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);

    const submitCurrentForm = async () => {
      fireEvent.click(screen.getByLabelText('Luminaria'));
      fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      return onSubmit.mock.calls.at(-1)?.[0];
    };

    const initialAttempt = await submitCurrentForm();

    const otherSlugSurvey = { ...baseSurvey, slug: 'consulta-barrial-2' };
    rerender(<SurveyForm survey={otherSlugSurvey} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    const slugAttempt = await submitCurrentForm();

    const nextRevisionSurvey = { ...otherSlugSurvey, instrument_revision: 8 };
    rerender(<SurveyForm survey={nextRevisionSurvey} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    const revisionAttempt = await submitCurrentForm();

    userMock.user = { id: 42 };
    rerender(<SurveyForm survey={nextRevisionSurvey} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    const userAttempt = await submitCurrentForm();

    expect(new Set([
      initialAttempt?.submission_id,
      slugAttempt?.submission_id,
      revisionAttempt?.submission_id,
      userAttempt?.submission_id,
    ]).size).toBe(4);
  });

  it('keeps preview simulation isolated from auth, PII, Turnstile, storage, analytics, and submit', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const storageRemoveSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const protectedPreviewSurvey: SurveyPublic = {
      ...securedSurvey,
      politica_unicidad: 'por_usuario',
      auth_mode: 'required',
      anonimo_permitido: false,
      requiere_datos_contacto: true,
    };

    render(<SurveyForm survey={protectedPreviewSurvey} onSubmit={onSubmit} previewMode />);

    expect(screen.queryByTestId('survey-auth-gate')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/documento/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tel.fono/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/datos demogr.ficos/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-turnstile-challenge')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /validar esta ruta/i }));

    expect(await screen.findByText(/ruta visible est. completa/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(analyticsMocks.answerSelected).not.toHaveBeenCalled();
    expect(analyticsMocks.submitError).not.toHaveBeenCalled();
    expect(requestLocationMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(storageRemoveSpy).not.toHaveBeenCalled();
    expect(window.localStorage).toHaveLength(0);
  });

  it('shows the active adaptive route and resets every in-memory answer', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SurveyForm survey={adaptiveSurvey} onSubmit={onSubmit} previewMode />);

    expect(screen.getByText(/1 de 3 preguntas visibles/i)).toBeInTheDocument();
    expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Si'));
    expect(await screen.findByText(/2 de 3 preguntas visibles/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mala'));
    expect(await screen.findByText(/3 de 3 preguntas visibles/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/escrib/i), { target: { value: 'Mas claridad' } });
    fireEvent.click(screen.getByRole('button', { name: /validar esta ruta/i }));

    expect(await screen.findByText('Ruta validada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reiniciar prueba/i }));

    await waitFor(() => expect(screen.getByText(/1 de 3 preguntas visibles/i)).toBeInTheDocument());
    expect(screen.getByLabelText('Si')).not.toBeChecked();
    expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/que deberiamos mejorar/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Ruta validada')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(analyticsMocks.answerSelected).not.toHaveBeenCalled();
  });
});
