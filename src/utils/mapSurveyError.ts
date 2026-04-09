export interface SurveyErrorViewModel {
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string | null;
  actionHint: string;
  retryable: boolean;
  requestId: string | null;
  statusCode: number | null;
  reasonCode: string | null;
}

type RawPayload = Record<string, unknown> | null | undefined;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const readBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

export const mapSurveyError = (
  params: {
    error?: unknown;
    errorStatus?: number | null;
    reasonCode?: string | null;
    details?: RawPayload;
  },
): SurveyErrorViewModel => {
  const statusCode =
    typeof params.errorStatus === 'number' ? params.errorStatus : null;

  const details = params.details ?? {};
  const requestId =
    readString(details.request_id) ??
    readString(details.requestId) ??
    readString((details as Record<string, unknown>)['x-request-id']) ??
    null;
  const payloadReasonCode =
    readString(details.reason_code) ?? readString(details.reasonCode);
  const reasonCode = params.reasonCode ?? payloadReasonCode ?? null;

  const payloadRetryable = readBoolean(details.retryable);
  const retryable =
    payloadRetryable ??
    (typeof statusCode === 'number' ? statusCode >= 500 : false);
  const payloadActionHint =
    readString(details.action_hint) ??
    readString(details.actionHint) ??
    (retryable ? 'retry' : null);
  const actionHint = payloadActionHint;

  const payloadTitle = readString(details.title);
  const payloadDescription = readString(details.description) ?? readString(details.message);
  const payloadPrimary = readString(details.primary_cta) ?? readString(details.primaryCta);
  const payloadSecondary = readString(details.secondary_cta) ?? readString(details.secondaryCta);

  if (statusCode === 404) {
    return {
      title: payloadTitle ?? 'No encontramos esta encuesta',
      description: payloadDescription ?? 'Revisá el enlace o explorá otras encuestas activas.',
      primaryCta: payloadPrimary ?? 'Ver encuestas activas',
      secondaryCta: payloadSecondary ?? 'Volver al inicio',
      actionHint: actionHint ?? 'view_other_surveys',
      retryable: false,
      requestId,
      statusCode,
      reasonCode,
    };
  }

  if (reasonCode === 'survey_not_published') {
    return {
      title: payloadTitle ?? 'Esta encuesta todavía no está publicada',
      description: payloadDescription ?? 'Podés explorar otras encuestas disponibles en este momento.',
      primaryCta: payloadPrimary ?? 'Ver encuestas activas',
      secondaryCta: payloadSecondary ?? 'Volver al inicio',
      actionHint: actionHint ?? 'view_other_surveys',
      retryable: false,
      requestId,
      statusCode,
      reasonCode,
    };
  }

  if (reasonCode === 'survey_outside_active_window') {
    return {
      title: payloadTitle ?? 'Esta encuesta no está disponible en este momento',
      description: payloadDescription ?? 'La encuesta tiene una ventana de publicación específica.',
      primaryCta: payloadPrimary ?? 'Ver otras encuestas',
      secondaryCta: payloadSecondary ?? 'Volver al inicio',
      actionHint: actionHint ?? 'view_other_surveys',
      retryable: false,
      requestId,
      statusCode,
      reasonCode,
    };
  }

  return {
    title: payloadTitle ?? 'No pudimos cargar esta encuesta',
    description: payloadDescription ?? 'Probá nuevamente en unos segundos.',
    primaryCta: payloadPrimary ?? 'Reintentar',
    secondaryCta: payloadSecondary ?? 'Volver al inicio',
    actionHint: actionHint ?? (retryable ? 'retry' : 'go_home'),
    retryable,
    requestId,
    statusCode,
    reasonCode,
  };
};

export default mapSurveyError;
