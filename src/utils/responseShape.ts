export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const pickCollection = <T = unknown>(
  payload: unknown,
  keys: string[] = ['items', 'data', 'results', 'rows'],
): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];

  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
};

export const pickText = (
  payload: unknown,
  keys: string[] = ['summary', 'message', 'text', 'description', 'detail'],
): string | null => {
  if (typeof payload === 'string') return payload.trim() || null;
  if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);
  if (!isRecord(payload)) return null;

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }

  return null;
};
