import type { PublicResponsePayload, SurveyPublic } from '@/types/encuestas';

interface TrackSurveySubmissionParams {
  survey: SurveyPublic;
  payload: PublicResponsePayload;
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

export default trackSurveySubmission;
