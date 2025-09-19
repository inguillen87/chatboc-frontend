// src/utils/rubros.ts
// Utilidades para trabajar con rubros y garantizar claves consistentes

/**
 * Normaliza un texto para usarlo como clave de rubro.
 * - Elimina tildes
 * - Colapsa espacios múltiples
 * - Convierte a minúsculas
 * - Conserva guiones y guiones bajos tal como vienen del backend
 */
export function normalizeRubroKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Extrae una clave de rubro válida a partir de cadenas, objetos o valores serializados.
 * Devuelve `null` si no puede obtener una clave utilizable.
 */
export function extractRubroKey(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Permitir almacenar objetos serializados sin romper compatibilidad
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        const parsedKey = extractRubroKey(parsed);
        if (parsedKey) return parsedKey;
      } catch {
        // No es JSON válido; continuar con la cadena original
      }
    }

    const normalized = normalizeRubroKey(trimmed);
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "object") {
    const raw =
      (typeof (value as any).clave === "string" && (value as any).clave.trim()) ||
      (typeof (value as any).nombre === "string" && (value as any).nombre.trim()) ||
      (typeof (value as any).name === "string" && (value as any).name.trim()) ||
      (typeof (value as any).label === "string" && (value as any).label.trim()) ||
      null;

    if (raw) {
      return normalizeRubroKey(raw);
    }
  }

  return null;
}

/**
 * Obtiene una etiqueta legible para mostrar el rubro.
 */
export function extractRubroLabel(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        const parsedLabel = extractRubroLabel(parsed);
        if (parsedLabel) return parsedLabel;
      } catch {
        // ignorar y usar la cadena original
      }
    }

    return trimmed;
  }

  if (typeof value === "object") {
    const label =
      (typeof (value as any).nombre === "string" && (value as any).nombre.trim()) ||
      (typeof (value as any).name === "string" && (value as any).name.trim()) ||
      (typeof (value as any).label === "string" && (value as any).label.trim()) ||
      (typeof (value as any).clave === "string" && (value as any).clave.trim()) ||
      null;

    return label;
  }

  return null;
}
