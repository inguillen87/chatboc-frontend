export const SURVEY_CONSENT_TEXT_NORMALIZATION = 'unicode_nfc_lf_trim_v1';
export const SURVEY_CONSENT_TEXT_CONTENT_FORMAT = 'plain_text';
export const SURVEY_CONSENT_TEXT_MIN_CODEPOINTS = 1;
export const SURVEY_CONSENT_TEXT_MAX_CODEPOINTS = 4000;

const DISALLOWED_CONTROL_PATTERN = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const DOCUMENT_EDGE_PATTERN = /^[ \n]+|[ \n]+$/g;

const hasLoneUtf16Surrogate = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
};

export type PreparedSurveyConsentText = {
  publicText: string;
  codePointLength: number;
  textSha256: string;
};

export const normalizeSurveyConsentPublicText = (value: string): string =>
  value.replace(/\r\n?/g, '\n').normalize('NFC').replace(DOCUMENT_EDGE_PATTERN, '');

export const validateSurveyConsentPublicText = (value: string): string => {
  const normalized = normalizeSurveyConsentPublicText(value);
  if (hasLoneUtf16Surrogate(normalized)) {
    throw new Error('El consentimiento contiene una secuencia Unicode sustituta inválida.');
  }
  if (DISALLOWED_CONTROL_PATTERN.test(normalized)) {
    throw new Error(
      'El consentimiento contiene caracteres de control no permitidos. Usá únicamente texto plano y saltos de línea.',
    );
  }
  const codePointLength = Array.from(normalized).length;
  if (
    codePointLength < SURVEY_CONSENT_TEXT_MIN_CODEPOINTS ||
    codePointLength > SURVEY_CONSENT_TEXT_MAX_CODEPOINTS
  ) {
    throw new Error('El consentimiento debe tener entre 1 y 4000 caracteres.');
  }
  return normalized;
};

export const sha256SurveyConsentText = async (normalizedText: string): Promise<string> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof TextEncoder === 'undefined') {
    throw new Error(
      'Web Crypto no está disponible. El release quedó bloqueado para no publicar un consentimiento sin verificar.',
    );
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(normalizedText));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const prepareSurveyConsentPublicText = async (
  value: string,
): Promise<PreparedSurveyConsentText> => {
  const publicText = validateSurveyConsentPublicText(value);
  return {
    publicText,
    codePointLength: Array.from(publicText).length,
    textSha256: await sha256SurveyConsentText(publicText),
  };
};
