import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  trackSurveyAnswerSelected,
  trackSurveyDemoInteraction,
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

  it('tracks an isolated demo interaction without emitting a real survey submission or answer data', () => {
    const windowLike = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    windowLike.dataLayer = [];
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    trackSurveyDemoInteraction({
      survey: {
        slug: 'demo-gobierno-junin-prioridades-barriales',
        tenant_slug: 'junin',
        titulo: 'Prioridades barriales',
        tipo: 'votacion',
        inicio_at: '2026-08-01T00:00:00-03:00',
        fin_at: null,
        politica_unicidad: 'libre',
        preguntas: [],
      },
      payload: {
        submission_id: '018f4c8e-1e56-7f38-a4df-83fd68394879',
        respuestas: [{ pregunta_id: 1, opcion_ids: [10] }],
        metadata: {
          answeredQuestions: 1,
          totalQuestions: 1,
          demographics: { genero: 'dato-que-no-debe-salir' },
        },
      },
      persisted: true,
      durable: true,
    });

    expect(windowLike.dataLayer).toHaveLength(1);
    expect(windowLike.dataLayer?.[0]).toMatchObject({
      event: 'survey_demo_interaction',
      survey_slug: 'demo-gobierno-junin-prioridades-barriales',
      tenant: 'junin',
      persisted: true,
      durable: true,
      demo_mode: true,
      data_classification: 'interactive_demo',
      municipal_truth: false,
    });
    expect(windowLike.dataLayer?.[0]).not.toHaveProperty('respuestas');
    expect(windowLike.dataLayer?.[0]).not.toHaveProperty('option_id');
    expect(windowLike.dataLayer?.[0]).not.toHaveProperty('demographics');
    expect(windowLike.dataLayer?.[0]?.event).not.toBe('survey_response_submitted');
    const demoEvent = dispatchSpy.mock.calls
      .map(([event]) => event as CustomEvent)
      .find((event) => event.type === 'chatboc:survey-demo-interaction');
    expect(demoEvent).toBeDefined();
  });
});
