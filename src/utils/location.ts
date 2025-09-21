export const parseCoordinateValue = (value?: unknown): number | undefined => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) {
      return undefined;
    }
    return value;
  }

  if (typeof value === 'string') {
    const sanitized = value.trim();

    if (!sanitized) {
      return undefined;
    }

    const normalized = sanitized.replace(',', '.');
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed === 0) {
      return undefined;
    }

    return parsed;
  }

  return undefined;
};

export const hasCoordinateValue = (value?: unknown): boolean => {
  return typeof parseCoordinateValue(value) === 'number';
};

export const pickFirstCoordinate = (
  ...values: unknown[]
): number | undefined => {
  for (const value of values) {
    const parsed = parseCoordinateValue(value);

    if (typeof parsed === 'number') {
      return parsed;
    }
  }

  return undefined;
};
