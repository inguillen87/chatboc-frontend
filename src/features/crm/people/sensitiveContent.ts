export const CRM_SENSITIVE_CONTENT_PLACEHOLDER =
  "Contenido sensible oculto por seguridad.";

const directSecretPatterns = [
  /\bbearer\s+[a-z0-9._~-]{8,}\b/i,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*(?:es|is|[:=])\s*\S{6,}/i,
  /\b(?:contrase(?:n|ñ)a|password|passcode)\s*(?:es|is|[:=])\s*\S{4,}/i,
];

const verificationContextPatterns = [
  /\b(?:otp|pin|passcode)\b/i,
  /\b(?:tu|su|your)\s+(?:c[oó]digo|code)\b/i,
  /\b(?:c[oó]digo|code)\s+(?:de\s+)?(?:verificaci[oó]n|seguridad|acceso|inicio\s+de\s+sesi[oó]n)\b/i,
  /\b(?:verification|security|login|sign[- ]?in)\s+code\b/i,
  /\b(?:no\s+(?:lo\s+)?compartas|do\s+not\s+share|don['’]t\s+share)\b/i,
];

const credentialValuePatterns = [
  /\b\d{4,10}\b/,
  /\b(?=[a-z0-9-]{5,16}\b)(?=[a-z0-9-]*\d)[a-z0-9-]+\b/i,
];

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

export const hasSensitiveCrmContent = (value: unknown): boolean => {
  const text = normalizeText(value);
  if (!text) return false;
  if (directSecretPatterns.some((pattern) => pattern.test(text))) return true;

  const hasVerificationContext = verificationContextPatterns.some((pattern) =>
    pattern.test(text),
  );
  const hasCredentialValue = credentialValuePatterns.some((pattern) =>
    pattern.test(text),
  );
  return hasVerificationContext && hasCredentialValue;
};

export const redactSensitiveCrmText = (value: unknown): string | null => {
  const text = normalizeText(value);
  if (!text) return null;
  return hasSensitiveCrmContent(text)
    ? CRM_SENSITIVE_CONTENT_PLACEHOLDER
    : text;
};
