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

const TECHNICAL_MESSAGE_PATTERNS = [
  /requested url was not found/i,
  /if you entered the url manually/i,
  /check your spelling/i,
  /not found on the server/i,
  /method not allowed/i,
  /internal server error/i,
  /traceback/i,
  /request_id/i,
  /\b404\b/i,
];

const publicDescription = (value: string | null): string | null => {
  if (!value) return null;
  if (TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(value))) return null;
  return value;
};

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
  const payloadDescription = publicDescription(readString(details.description) ?? readString(details.message));
  const payloadPrimary = readString(details.primary_cta) ?? readString(details.primaryCta);
  const payloadSecondary = readString(details.secondary_cta) ?? readString(details.secondaryCta);

  if (statusCode === 404) {
    return {
      title: payloadTitle ?? 'No encontramos esta encuesta',
      description: payloadDescription ?? 'Revisa el enlace o explora otras encuestas activas.',
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
      title: payloadTitle ?? 'Esta encuesta todavia no esta publicada',
      description: payloadDescription ?? 'Podes explorar otras encuestas disponibles en este momento.',
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
      title: payloadTitle ?? 'Esta encuesta no esta disponible en este momento',
      description: payloadDescription ?? 'La encuesta tiene una ventana de publicacion especifica.',
      primaryCta: payloadPrimary ?? 'Ver otras encuestas',
      secondaryCta: payloadSecondary ?? 'Volver al inicio',
      actionHint: actionHint ?? 'view_other_surveys',
      retryable: false,
      requestId,
      statusCode,
      reasonCode,
    };
  }

  if (reasonCode === 'social_token_required') {
    return {
      title: payloadTitle ?? 'Necesitas iniciar sesion social para comentar',
      description: payloadDescription ?? 'Conecta una cuenta social valida para habilitar los comentarios.',
      primaryCta: payloadPrimary ?? 'Conectar cuenta social',
      secondaryCta: payloadSecondary ?? 'Volver al inicio',
      actionHint: actionHint ?? 'retry',
      retryable: false,
      requestId,
      statusCode,
      reasonCode,
    };
  }

  if (reasonCode === 'invalid_social_token') {
    return {
      title: payloadTitle ?? 'Tu sesion social expiro',
      description: payloadDescription ?? 'Volve a conectar tu cuenta social para continuar.',
      primaryCta: payloadPrimary ?? 'Reconectar cuenta',
      secondaryCta: payloadSecondary ?? 'Volver al inicio',
      actionHint: actionHint ?? 'retry',
      retryable: false,
      requestId,
      statusCode,
      reasonCode,
    };
  }

  if (reasonCode === 'social_identity_mismatch') {
    return {
      title: payloadTitle ?? 'La identidad social no coincide',
      description: payloadDescription ?? 'Conecta la misma cuenta social para poder publicar.',
      primaryCta: payloadPrimary ?? 'Reintentar conexion',
      secondaryCta: payloadSecondary ?? 'Volver al inicio',
      actionHint: actionHint ?? 'retry',
      retryable: false,
      requestId,
      statusCode,
      reasonCode,
    };
  }

  return {
    title: payloadTitle ?? 'No pudimos cargar esta encuesta',
    description: payloadDescription ?? 'Proba nuevamente en unos segundos.',
    primaryCta: payloadPrimary ?? 'Reintentar',
    secondaryCta: payloadSecondary ?? 'Volver al inicio',
    actionHint: actionHint ?? 'retry',
    retryable,
    requestId,
    statusCode,
    reasonCode,
  };
};

export default mapSurveyError;
