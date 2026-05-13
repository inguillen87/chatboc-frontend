import { describe, expect, it } from 'vitest';

import { mapSurveyError } from '@/utils/mapSurveyError';

describe('mapSurveyError', () => {
  it('maps survey_not_published to view_other_surveys by default', () => {
    const view = mapSurveyError({
      errorStatus: 403,
      reasonCode: 'survey_not_published',
      details: {
        request_id: 'req-1',
      },
    });

    expect(view.title).toContain('todavia no esta publicada');
    expect(view.primaryCta).toBe('Ver encuestas activas');
    expect(view.actionHint).toBe('view_other_surveys');
    expect(view.requestId).toBe('req-1');
  });

  it('maps survey_outside_active_window to view_other_surveys by default', () => {
    const view = mapSurveyError({
      errorStatus: 403,
      reasonCode: 'survey_outside_active_window',
      details: {
        request_id: 'req-2',
      },
    });

    expect(view.title).toContain('no esta disponible');
    expect(view.primaryCta).toBe('Ver otras encuestas');
    expect(view.actionHint).toBe('view_other_surveys');
    expect(view.requestId).toBe('req-2');
  });

  it('keeps explicit action_hint from backend when present', () => {
    const view = mapSurveyError({
      errorStatus: 403,
      reasonCode: 'survey_not_published',
      details: {
        request_id: 'req-3',
        action_hint: 'go_home',
      },
    });

    expect(view.actionHint).toBe('go_home');
  });

  it('maps 500/internal_error to retryable retry action', () => {
    const view = mapSurveyError({
      errorStatus: 500,
      reasonCode: 'internal_error',
      details: {
        request_id: 'req-4',
      },
    });

    expect(view.retryable).toBe(true);
    expect(view.primaryCta).toBe('Reintentar');
    expect(view.actionHint).toBe('retry');
  });

  it('maps 404 errors to surveys list CTA with view_other_surveys hint', () => {
    const view = mapSurveyError({
      errorStatus: 404,
      details: {
        request_id: 'req-404',
      },
    });

    expect(view.primaryCta).toBe('Ver encuestas activas');
    expect(view.actionHint).toBe('view_other_surveys');
    expect(view.retryable).toBe(false);
  });

  it('does not expose server 404 copy in the public survey error', () => {
    const view = mapSurveyError({
      errorStatus: 404,
      details: {
        title: 'Not Found',
        message: 'The requested URL was not found on the server.',
        request_id: 'req-404',
      },
    });

    expect(view.title).toBe('No encontramos esta encuesta');
    expect(view.description).toBe('Revisa el enlace o explora otras encuestas activas.');
  });

  it('keeps generic fallback action as retry when reason_code is missing', () => {
    const view = mapSurveyError({
      errorStatus: 403,
      details: {
        request_id: 'req-generic-403',
      },
    });

    expect(view.primaryCta).toBe('Reintentar');
    expect(view.actionHint).toBe('retry');
  });

  it('maps social_token_required with dedicated copy', () => {
    const view = mapSurveyError({
      errorStatus: 403,
      reasonCode: 'social_token_required',
      details: {
        request_id: 'req-social-required',
      },
    });

    expect(view.primaryCta).toBe('Conectar cuenta social');
    expect(view.actionHint).toBe('retry');
    expect(view.retryable).toBe(false);
  });

  it('maps invalid_social_token with reconnect CTA', () => {
    const view = mapSurveyError({
      errorStatus: 403,
      reasonCode: 'invalid_social_token',
      details: {
        request_id: 'req-invalid-token',
      },
    });

    expect(view.title).toContain('sesion social');
    expect(view.primaryCta).toBe('Reconectar cuenta');
  });

  it('maps social_identity_mismatch with retry connection CTA', () => {
    const view = mapSurveyError({
      errorStatus: 403,
      reasonCode: 'social_identity_mismatch',
      details: {
        request_id: 'req-social-mismatch',
      },
    });

    expect(view.title).toContain('identidad social');
    expect(view.primaryCta).toBe('Reintentar conexion');
  });
});
