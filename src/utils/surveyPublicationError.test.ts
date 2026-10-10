import { describe, expect, it } from 'vitest';

import { ApiError } from '@/utils/api';
import { resolveSurveyPublicationFailure } from '@/utils/surveyPublicationError';

describe('resolveSurveyPublicationFailure', () => {
  it('turns a synthetic sandbox conflict into an actionable and truthful message', () => {
    const failure = resolveSurveyPublicationFailure(new ApiError(
      'Un instrumento sandbox con datos sintéticos no puede publicarse.',
      409,
      {
        reason_code: 'survey_synthetic_sandbox_publish_forbidden',
        non_real_responses: 100,
        auto_seed_configured: true,
      },
    ));

    expect(failure).toMatchObject({
      title: 'La versión de prueba no se puede publicar',
      reasonCode: 'survey_synthetic_sandbox_publish_forbidden',
      action: 'edit',
    });
    expect(failure.message).toContain('100 respuestas de prueba');
    expect(failure.message).toContain('versión limpia');
  });

  it('preserves the backend conflict message when the reason is not specialized', () => {
    const failure = resolveSurveyPublicationFailure(new ApiError(
      'La fecha de cierre ya pasó.',
      409,
      { reason_code: 'survey_publication_window_ended', message: 'La fecha de cierre ya pasó.' },
      'req-publish-1',
    ));

    expect(failure.title).toBe('La encuesta no está lista para publicar');
    expect(failure.message).toContain('La fecha de cierre ya pasó.');
    expect(failure.message).toContain('Req ID: req-publish-1');
  });

  it('distinguishes governance release publication from a generic retry', () => {
    const failure = resolveSurveyPublicationFailure(new ApiError(
      'La encuesta gobernada debe publicarse desde su release',
      409,
      { reason_code: 'survey_governance_publish_endpoint_required' },
    ));

    expect(failure.action).toBe('governance');
    expect(failure.message).toContain('release aprobado');
  });

  it('explains a cross-jurisdiction block without presenting it as a server failure', () => {
    const failure = resolveSurveyPublicationFailure(new ApiError(
      'La publicación está bloqueada por el control institucional de jurisdicción',
      409,
      { reason_code: 'survey_jurisdiction_binding_conflict' },
    ));

    expect(failure.title).toBe('La jurisdicción no coincide con la organización');
    expect(failure.message).toContain('evitar presentar esa encuesta como propia');
    expect(failure.action).toBe('edit');
  });
});
