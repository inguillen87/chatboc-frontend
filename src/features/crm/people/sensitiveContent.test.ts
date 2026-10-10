import { describe, expect, it } from "vitest";

import {
  CRM_SENSITIVE_CONTENT_PLACEHOLDER,
  hasSensitiveCrmContent,
  redactSensitiveCrmText,
} from "./sensitiveContent";

describe("CRM sensitive content guard", () => {
  it.each([
    "123456 es tu código de verificación. No lo compartas.",
    "Your verification code is 654321. Do not share it.",
    "PIN: 8432",
    "password: secreto-temporal",
    "access_token=token-de-prueba-123",
    "Bearer token-de-prueba-123456",
  ])("redacts high-confidence credential content: %s", (value) => {
    expect(hasSensitiveCrmContent(value)).toBe(true);
    expect(redactSensitiveCrmText(value)).toBe(
      CRM_SENSITIVE_CONTENT_PLACEHOLDER,
    );
  });

  it.each([
    "El reclamo 123456 sigue en proceso.",
    "La dirección informada es Ruta 60 km 3.",
    "Necesito ayuda para iniciar el CUD.",
    "Código postal 5573.",
  ])("preserves ordinary municipal context: %s", (value) => {
    expect(hasSensitiveCrmContent(value)).toBe(false);
    expect(redactSensitiveCrmText(value)).toBe(value);
  });

  it("normalizes empty and non-string values to null", () => {
    expect(redactSensitiveCrmText("   ")).toBeNull();
    expect(redactSensitiveCrmText(null)).toBeNull();
  });
});
