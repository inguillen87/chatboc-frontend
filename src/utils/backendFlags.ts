const FALSE_VALUES = new Set(["false", "0", "no", "off", "disabled"]);
const TRUE_VALUES = new Set(["true", "1", "yes", "si", "sí", "on", "enabled"]);

export const readBackendFlag = (
  value: unknown,
  fallback = true,
): boolean => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (FALSE_VALUES.has(normalized)) return false;
    if (TRUE_VALUES.has(normalized)) return true;
  }
  return fallback;
};
