const SURVEY_SUBMISSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isSurveySubmissionId = (value: unknown): value is string =>
  typeof value === 'string' && SURVEY_SUBMISSION_ID_PATTERN.test(value);

export const assertSurveySubmissionId = (value: unknown): string => {
  if (!isSurveySubmissionId(value)) {
    throw new Error(
      'No se pudo vincular la respuesta a un identificador opaco y seguro. Conservamos los datos para reintentar.',
    );
  }
  return value;
};

/**
 * Creates a PII-free identity for one logical response. Callers must retain the
 * returned value until that response receives a matching durable ACK or its
 * payload changes.
 */
export const createSecureSurveySubmissionId = (): string => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('Este navegador no puede generar un identificador seguro para enviar la respuesta.');
};
