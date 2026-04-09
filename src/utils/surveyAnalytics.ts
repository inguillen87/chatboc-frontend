import type { PublicResponsePayload, SurveyPublic } from '@/types/encuestas';

interface TrackSurveySubmissionParams {
  survey: SurveyPublic;
  payload: PublicResponsePayload;
}

interface TrackSurveyPageViewParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
}

interface TrackSurveyLoadErrorParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  statusCode?: number | null;
  reasonCode?: string | null;
  message?: string | null;
}

interface TrackSurveyRetryTriggeredParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  attempt: number;
  mode: 'auto' | 'manual';
}

interface TrackSurveyErrorRenderedParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  statusCode?: number | null;
  reasonCode?: string | null;
  actionHint?: string | null;
  requestId?: string | null;
}

interface TrackSurveyCtaClickedParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  actionHint?: string | null;
  ctaLabel?: string | null;
  requestId?: string | null;
}

interface TrackSurveyRetryClickedParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  statusCode?: number | null;
  reasonCode?: string | null;
  requestId?: string | null;
}

interface TrackSurveyCommentModeChangedParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  mode?: string | null;
  provider?: string | null;
}

interface TrackSurveyCommentSubmittedParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  mode?: string | null;
  provider?: string | null;
  commentLength?: number | null;
}

interface TrackSurveyAnswerSelectedParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  questionId?: number | null;
  questionType?: string | null;
  optionId?: number | null;
  selectionCount?: number | null;
}

interface TrackSurveySubmitErrorParams {
  slug?: string | null;
  host?: string | null;
  tenant?: string | null;
  statusCode?: number | null;
  reasonCode?: string | null;
  requestId?: string | null;
  message?: string | null;
}

const buildAnalyticsEvent = ({
  survey,
  payload,
}: TrackSurveySubmissionParams) => {
  const metadata = payload.metadata ?? {};

  return {
    event: 'survey_response_submitted',
    survey_id: survey.id ?? null,
    survey_slug: survey.slug,
    survey_title: survey.titulo,
    survey_tipo: survey.tipo,
    total_questions: metadata.totalQuestions ?? survey.preguntas?.length ?? null,
    answered_questions: metadata.answeredQuestions ?? null,
    submitted_at: metadata.submittedAt ?? new Date().toISOString(),
    canal: payload.canal ?? metadata.canal ?? null,
    utm_source: payload.utm_source ?? null,
    utm_campaign: payload.utm_campaign ?? null,
    demographics: metadata.demographics ?? null,
  } as Record<string, unknown>;
};

export const trackSurveySubmission = (params: TrackSurveySubmissionParams) => {
  if (typeof window === 'undefined') {
    return;
  }

  const analyticsEvent = buildAnalyticsEvent(params);

  try {
    const globalLayer = (window as { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
    if (Array.isArray(globalLayer)) {
      globalLayer.push(analyticsEvent);
    }
  } catch (error) {
    console.warn('[surveyAnalytics] No se pudo enviar el evento al dataLayer', error);
  }

  try {
    window.dispatchEvent(new CustomEvent('chatboc:survey-submitted', { detail: analyticsEvent }));
  } catch (error) {
    console.warn('[surveyAnalytics] No se pudo despachar el evento personalizado', error);
  }

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'chatboc:survey-submitted', detail: analyticsEvent }, '*');
    }
  } catch (error) {
    console.warn('[surveyAnalytics] No se pudo enviar el evento al contexto padre', error);
  }
};

const pushSurveyEvent = (eventPayload: Record<string, unknown>, domEventName: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const globalLayer = (window as { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
    if (Array.isArray(globalLayer)) {
      globalLayer.push(eventPayload);
    }
  } catch (error) {
    console.warn('[surveyAnalytics] No se pudo enviar el evento al dataLayer', error);
  }

  try {
    window.dispatchEvent(new CustomEvent(domEventName, { detail: eventPayload }));
  } catch (error) {
    console.warn('[surveyAnalytics] No se pudo despachar el evento personalizado', error);
  }
};

export const trackSurveyPageView = (params: TrackSurveyPageViewParams) => {
  pushSurveyEvent(
    {
      event: 'survey_page_view',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-page-view',
  );
};

export const trackSurveyLoadError = (params: TrackSurveyLoadErrorParams) => {
  pushSurveyEvent(
    {
      event: 'survey_load_error',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      status_code: params.statusCode ?? null,
      reason_code: params.reasonCode ?? null,
      error_message: params.message ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-load-error',
  );
};

export const trackSurveyRetryTriggered = (params: TrackSurveyRetryTriggeredParams) => {
  pushSurveyEvent(
    {
      event: 'survey_retry_triggered',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      attempt: params.attempt,
      mode: params.mode,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-retry-triggered',
  );
};

export const trackSurveyErrorRendered = (params: TrackSurveyErrorRenderedParams) => {
  pushSurveyEvent(
    {
      event: 'survey_error_rendered',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      status_code: params.statusCode ?? null,
      reason_code: params.reasonCode ?? null,
      action_hint: params.actionHint ?? null,
      request_id: params.requestId ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-error-rendered',
  );
};

export const trackSurveyCtaClicked = (params: TrackSurveyCtaClickedParams) => {
  pushSurveyEvent(
    {
      event: 'survey_cta_clicked',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      action_hint: params.actionHint ?? null,
      cta_label: params.ctaLabel ?? null,
      request_id: params.requestId ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-cta-clicked',
  );
};

export const trackSurveyRetryClicked = (params: TrackSurveyRetryClickedParams) => {
  pushSurveyEvent(
    {
      event: 'survey_retry_clicked',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      status_code: params.statusCode ?? null,
      reason_code: params.reasonCode ?? null,
      request_id: params.requestId ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-retry-clicked',
  );
};

export const trackSurveyCommentModeChanged = (params: TrackSurveyCommentModeChangedParams) => {
  pushSurveyEvent(
    {
      event: 'survey_comment_mode_changed',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      mode: params.mode ?? null,
      provider: params.provider ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-comment-mode-changed',
  );
};

export const trackSurveyCommentSubmitted = (params: TrackSurveyCommentSubmittedParams) => {
  pushSurveyEvent(
    {
      event: 'survey_comment_submitted',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      mode: params.mode ?? null,
      provider: params.provider ?? null,
      comment_length: params.commentLength ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-comment-submitted',
  );
};

export const trackSurveyAnswerSelected = (params: TrackSurveyAnswerSelectedParams) => {
  pushSurveyEvent(
    {
      event: 'survey_answer_selected',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      question_id: params.questionId ?? null,
      question_type: params.questionType ?? null,
      option_id: params.optionId ?? null,
      selection_count: params.selectionCount ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-answer-selected',
  );
};

export const trackSurveySubmitError = (params: TrackSurveySubmitErrorParams) => {
  pushSurveyEvent(
    {
      event: 'survey_submit_error',
      survey_slug: params.slug ?? null,
      host: params.host ?? null,
      tenant: params.tenant ?? null,
      status_code: params.statusCode ?? null,
      reason_code: params.reasonCode ?? null,
      request_id: params.requestId ?? null,
      error_message: params.message ?? null,
      timestamp: new Date().toISOString(),
    },
    'chatboc:survey-submit-error',
  );
};

export default trackSurveySubmission;
