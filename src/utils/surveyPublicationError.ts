import { ApiError, getErrorMessage } from '@/utils/api';

export interface SurveyPublicationFailure {
  title: string;
  message: string;
  reasonCode: string | null;
  action: 'edit' | 'governance' | 'retry';
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asReasonCode = (body: Record<string, unknown> | null) => {
  const nestedError = asRecord(body?.error);
  const value = body?.reason_code ?? nestedError?.reason_code ?? nestedError?.code;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const asNonNegativeInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const withRequestId = (message: string, error: ApiError | null) =>
  error?.requestId && !message.includes(error.requestId)
    ? `${message} (Req ID: ${error.requestId})`
    : message;

export const resolveSurveyPublicationFailure = (error: unknown): SurveyPublicationFailure => {
  const apiError = error instanceof ApiError ? error : null;
  const body = asRecord(apiError?.body);
  const reasonCode = asReasonCode(body);

  if (reasonCode === 'survey_synthetic_sandbox_publish_forbidden') {
    const nonRealResponses = asNonNegativeInteger(body?.non_real_responses);
    const responseDetail = nonRealResponses
      ? ` Tiene ${nonRealResponses.toLocaleString('es-AR')} respuestas de prueba.`
      : '';
    return {
      title: 'La versión de prueba no se puede publicar',
      message: `Este instrumento está marcado como sandbox o contiene datos sintéticos.${responseDetail} Creá o prepará una versión limpia antes de abrir la participación ciudadana.`,
      reasonCode,
      action: 'edit',
    };
  }

  if (reasonCode === 'survey_governance_publish_endpoint_required') {
    return {
      title: 'La publicación requiere aprobar el release',
      message: 'Esta encuesta tiene gobierno de cambios activo. Publicala desde su release aprobado para conservar consentimiento, trazabilidad y versión.',
      reasonCode,
      action: 'governance',
    };
  }

  if (reasonCode === 'survey_identity_hmac_secret_unavailable') {
    return {
      title: 'Falta una configuración segura del servidor',
      message: 'La política de unicidad necesita el secreto de identidad de encuestas. El instrumento quedó bloqueado para no exponer ni vincular identidades de forma insegura.',
      reasonCode,
      action: 'retry',
    };
  }

  if (reasonCode === 'survey_jurisdiction_binding_conflict') {
    return {
      title: 'La jurisdicción no coincide con la organización',
      message: 'El contenido está vinculado a una jurisdicción distinta de la organización seleccionada. Se bloqueó la publicación para evitar presentar esa encuesta como propia. Revisá la vinculación institucional o prepará una versión para esta jurisdicción.',
      reasonCode,
      action: 'edit',
    };
  }

  if (
    reasonCode === 'survey_tenant_jurisdiction_unverified' ||
    reasonCode === 'survey_jurisdiction_unbound' ||
    reasonCode === 'survey_jurisdiction_binding_required'
  ) {
    return {
      title: 'Falta validar la jurisdicción institucional',
      message: 'La publicación quedó bloqueada hasta que la encuesta y la organización tengan una jurisdicción verificada y revisada. Esto evita mezclar municipios o atribuir contenido al gobierno equivocado.',
      reasonCode,
      action: 'edit',
    };
  }

  if (apiError?.status === 409) {
    const message = getErrorMessage(apiError, 'Revisá el estado, las preguntas y la ventana de participación antes de reintentar.');
    return {
      title: 'La encuesta no está lista para publicar',
      message: withRequestId(message, apiError),
      reasonCode,
      action: 'edit',
    };
  }

  const message = getErrorMessage(error, 'Reintentá cuando el servicio vuelva a estar disponible.');
  return {
    title: 'No pudimos publicar la encuesta',
    message: withRequestId(message, apiError),
    reasonCode,
    action: 'retry',
  };
};
