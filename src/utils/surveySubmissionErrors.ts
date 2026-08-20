import { ApiError } from '@/utils/api';

export const SURVEY_RESPONSE_DUPLICATE_REASON_CODE = 'survey_response_duplicate';
export const SURVEY_SUBMISSION_ID_CONFLICT_REASON_CODE = 'survey_submission_id_conflict';
export const SURVEY_RESPONSE_DUPLICATE_TITLE = 'Ya registramos tu opinión';
export const SURVEY_RESPONSE_DUPLICATE_MESSAGE =
  'Esta consulta admite una sola participación por persona. Tu respuesta anterior sigue registrada y no enviamos una nueva.';
export const SURVEY_RESPONSE_DUPLICATE_ADMIN_TITLE = 'Las respuestas ya estaban registradas';
export const SURVEY_RESPONSE_DUPLICATE_ADMIN_MESSAGE =
  'No generamos duplicados. Las respuestas existentes se conservaron sin cambios.';

export class AmbiguousSurveySubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousSurveySubmissionError';
    Object.setPrototypeOf(this, AmbiguousSurveySubmissionError.prototype);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeReasonCode = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;

export const getSurveySubmissionReasonCode = (error: unknown): string | null => {
  if (!(error instanceof ApiError) || !isRecord(error.body)) return null;

  const direct = normalizeReasonCode(error.body.reason_code ?? error.body.reasonCode);
  if (direct) return direct;

  const nestedError = isRecord(error.body.error) ? error.body.error : null;
  return nestedError
    ? normalizeReasonCode(nestedError.reason_code ?? nestedError.reasonCode)
    : null;
};

export const isSurveyResponseDuplicateError = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status === 409 &&
  getSurveySubmissionReasonCode(error) === SURVEY_RESPONSE_DUPLICATE_REASON_CODE;

export const isSurveySubmissionIdConflictError = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status === 409 &&
  getSurveySubmissionReasonCode(error) === SURVEY_SUBMISSION_ID_CONFLICT_REASON_CODE;

export const getSurveySubmissionUserMessage = (error: unknown): string | null => {
  if (isSurveyResponseDuplicateError(error)) {
    return SURVEY_RESPONSE_DUPLICATE_MESSAGE;
  }

  return null;
};

/**
 * Keep one identity for every retry of an unchanged logical response. Only a
 * terminal duplicate or an explicit key collision authorizes rotating it; form
 * edits and participant/survey scope changes rotate it independently.
 */
export const shouldReuseSurveySubmissionAttempt = (error: unknown): boolean =>
  !isSurveyResponseDuplicateError(error) && !isSurveySubmissionIdConflictError(error);
