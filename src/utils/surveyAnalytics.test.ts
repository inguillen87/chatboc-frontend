import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  trackSurveyAnswerSelected,
  trackSurveySubmitError,
} from '@/utils/surveyAnalytics';

describe('surveyAnalytics events', () => {
  afterEach(() => {
    const windowLike = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    delete windowLike.dataLayer;
    vi.restoreAllMocks();
  });

  it('pushes survey_answer_selected to dataLayer and dispatches DOM event', () => {
    const windowLike = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    windowLike.dataLayer = [];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackSurveyAnswerSelected({
      slug: 'encuesta-demo',
      host: 'demo.chatboc.ar',
      tenant: 'demo',
      questionId: 7,
      questionType: 'opcion_unica',
      optionId: 12,
      selectionCount: 1,
    });

    expect(windowLike.dataLayer).toHaveLength(1);
    expect(windowLike.dataLayer?.[0]).toMatchObject({
      event: 'survey_answer_selected',
      survey_slug: 'encuesta-demo',
      host: 'demo.chatboc.ar',
      tenant: 'demo',
      question_id: 7,
      option_id: 12,
      selection_count: 1,
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const firstEvent = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(firstEvent.type).toBe('chatboc:survey-answer-selected');
  });

  it('pushes survey_submit_error with status/reason metadata', () => {
    const windowLike = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    windowLike.dataLayer = [];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackSurveySubmitError({
      slug: 'encuesta-demo',
      host: 'demo.chatboc.ar',
      tenant: 'demo',
      statusCode: 500,
      reasonCode: 'internal_error',
      requestId: 'req-500',
      message: 'Error interno',
    });

    expect(windowLike.dataLayer).toHaveLength(1);
    expect(windowLike.dataLayer?.[0]).toMatchObject({
      event: 'survey_submit_error',
      survey_slug: 'encuesta-demo',
      host: 'demo.chatboc.ar',
      tenant: 'demo',
      status_code: 500,
      reason_code: 'internal_error',
      request_id: 'req-500',
      error_message: 'Error interno',
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const firstEvent = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(firstEvent.type).toBe('chatboc:survey-submit-error');
  });
});
