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

    expect(view.title).toContain('todavía no está publicada');
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

    expect(view.title).toContain('no está disponible');
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
});
