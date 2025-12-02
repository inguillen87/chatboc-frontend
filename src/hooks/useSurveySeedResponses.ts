import { useMutation } from '@tanstack/react-query';

import { postPublicResponse } from '@/api/encuestas';
import { ApiError } from '@/utils/api';
import type { SurveyAdmin, SurveyPublic } from '@/types/encuestas';
import { generateSurveySeedPayloads } from '@/utils/surveySeed';

interface SeedArgs {
  survey: SurveyAdmin | SurveyPublic;
  count?: number;
  scenario?: string | null;
}

interface SeedErrorDetail {
  index: number;
  error: unknown;
}

export interface SeedResultSummary {
  total: number;
  success: number;
  failures: number;
  errors: SeedErrorDetail[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRY_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRY_ATTEMPTS = 4;
const BASE_RETRY_DELAY_MS = 750;
const MAX_RETRY_DELAY_MS = 7000;
const RETRY_JITTER_MS = 400;
const MIN_BETWEEN_REQUESTS_MS = 120;
const MAX_BETWEEN_REQUESTS_MS = 320;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const extractRetryAfterMs = (error: ApiError): number | null => {
  const visited = new Set<unknown>();
  const queue: unknown[] = [error.body];
  const candidateKeys = [
    'retry_after_ms',
    'retryAfterMs',
    'retryAfterMS',
    'retry_after',
    'retryAfter',
    'retry-after',
    'retry_after_seconds',
    'retryAfterSeconds',
  ];

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const directNumber = toFiniteNumber(current);
    if (directNumber !== null) {
      if (directNumber > 1000) {
        return directNumber;
      }
      if (directNumber > 0 && directNumber <= 120) {
        return directNumber * 1000;
      }
      return directNumber;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      for (const key of candidateKeys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
          queue.push(record[key]);
        }
      }
    }
  }

  return null;
};

const shouldRetry = (error: unknown): error is ApiError => error instanceof ApiError && RETRY_STATUS_CODES.has(error.status);

const computeRetryDelay = (attempt: number, error?: ApiError | null) => {
  const fromError = error ? extractRetryAfterMs(error) : null;
  if (fromError && fromError > 0) {
    const jitter = Math.random() * RETRY_JITTER_MS;
    return Math.min(MAX_RETRY_DELAY_MS, fromError + jitter);
  }

  const exponential = BASE_RETRY_DELAY_MS * 2 ** attempt;
  const jitter = Math.random() * RETRY_JITTER_MS;
  return Math.min(MAX_RETRY_DELAY_MS, exponential + jitter);
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const postBatch = async (
  slug: string,
  payloads: ReturnType<typeof generateSurveySeedPayloads>['payloads'],
): Promise<SeedResultSummary> => {
  const summary: SeedResultSummary = { total: payloads.length, success: 0, failures: 0, errors: [] };

  for (let index = 0; index < payloads.length; index += 1) {
    const payload = payloads[index];
    let success = false;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        await postPublicResponse(slug, payload);
        summary.success += 1;
        success = true;
        break;
      } catch (error) {
        lastError = error;
        if (shouldRetry(error) && attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = computeRetryDelay(attempt, error);
          await sleep(delay);
          continue;
        }
        break;
      }
    }

    if (!success) {
      summary.failures += 1;
      summary.errors.push({ index, error: lastError });
      await sleep(computeRetryDelay(0));
    } else if (index < payloads.length - 1) {
      await sleep(randomBetween(MIN_BETWEEN_REQUESTS_MS, MAX_BETWEEN_REQUESTS_MS));
    }
  }

  return summary;
};

export function useSurveySeedResponses() {
  const mutation = useMutation({
    mutationFn: async ({ survey, count, scenario }: SeedArgs) => {
      if (!survey?.slug) {
        throw new Error('La encuesta no tiene un slug público configurado.');
      }

      const { payloads } = generateSurveySeedPayloads(survey, {
        count,
        scenario,
        municipalityLabel: survey?.municipio_nombre ?? undefined,
      });

      return postBatch(survey.slug, payloads);
    },
  });

  return {
    seed: mutation.mutateAsync,
    isSeeding: mutation.isPending,
    result: mutation.data,
    reset: mutation.reset,
  };
}
