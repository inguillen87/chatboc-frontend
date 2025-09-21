import { shiftDateByHours } from '@/utils/date';

const CANDIDATE_DATE_KEYS = ['date', 'fecha', 'created_at', 'updated_at', 'timestamp'] as const;

type HistoryLike = Record<string, unknown> | null | undefined;

export const pickHistoryDate = (
  entry: unknown,
): string | number | Date | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as HistoryLike;

  for (const key of CANDIDATE_DATE_KEYS) {
    const raw = record?.[key as keyof typeof record];
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      raw instanceof Date
    ) {
      return raw;
    }
  }

  return null;
};

export const formatHistoryDate = (
  value: string | number | Date | null | undefined,
): string | null => {
  if (!value && value !== 0) return null;

  const shifted = shiftDateByHours(value, -3);

  if (!shifted) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(shifted);
  } catch (error) {
    console.error('Error formatting history date', error);
    return null;
  }
};
