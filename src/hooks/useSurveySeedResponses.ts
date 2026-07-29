import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { adminSeedSurvey, postPublicResponse } from '@/api/encuestas';
import { ApiError, NetworkError } from '@/utils/api';
import type { SurveyAdmin, SurveyPublic } from '@/types/encuestas';
import { generateSurveySeedPayloads } from '@/utils/surveySeed';
import {
  AmbiguousSurveySubmissionError,
  isSurveyResponseDuplicateError,
} from '@/utils/surveySubmissionErrors';

interface SeedArgs {
  survey: SurveyAdmin | SurveyPublic;
  count?: number;
  scenario?: string | null;
}

export interface SeedProgress {
  processed: number;
  total: number;
  success: number;
  duplicates: number;
  failures: number;
}

interface SeedErrorDetail {
  index: number;
  error: unknown;
}

export interface SeedResultSummary {
  total: number;
  success: number;
  duplicates: number;
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

const shouldRetry = (error: unknown): boolean =>
  error instanceof NetworkError ||
  error instanceof AmbiguousSurveySubmissionError ||
  (error instanceof ApiError && RETRY_STATUS_CODES.has(error.status));

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
  onProgress?: (progress: SeedProgress) => void,
): Promise<SeedResultSummary> => {
  const summary: SeedResultSummary = { total: payloads.length, success: 0, duplicates: 0, failures: 0, errors: [] };

  onProgress?.({ processed: 0, total: payloads.length, success: 0, duplicates: 0, failures: 0 });

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
          const delay = computeRetryDelay(attempt, error instanceof ApiError ? error : null);
          await sleep(delay);
          continue;
        }
        break;
      }
    }

    if (!success) {
      if (isSurveyResponseDuplicateError(lastError)) {
        summary.duplicates += 1;
      } else {
        summary.failures += 1;
        summary.errors.push({ index, error: lastError });
        await sleep(computeRetryDelay(0));
      }
    } else if (index < payloads.length - 1) {
      await sleep(randomBetween(MIN_BETWEEN_REQUESTS_MS, MAX_BETWEEN_REQUESTS_MS));
    }

    onProgress?.({
      processed: index + 1,
      total: payloads.length,
      success: summary.success,
      duplicates: summary.duplicates,
      failures: summary.failures,
    });
  }

  return summary;
};

export function useSurveySeedResponses() {
  const [progress, setProgress] = useState<SeedProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ survey, count, scenario }: SeedArgs) => {
      setProgress(null);
      if (!survey?.slug) {
        throw new Error('La encuesta no tiene un slug público configurado.');
      }

      const { payloads } = generateSurveySeedPayloads(survey, {
        count,
        scenario,
        municipalityLabel: survey?.municipio_nombre ?? undefined,
      });

      const surveyId = typeof (survey as { id?: unknown })?.id === 'number'
        ? (survey as { id: number }).id
        : null;

      if (surveyId && Number.isFinite(surveyId)) {
        try {
          const seeded = await adminSeedSurvey(surveyId, {
            cantidad: payloads.length,
            municipality_label: survey?.municipio_nombre ?? undefined,
          });
          const success = Math.max(0, Math.min(payloads.length, Number(seeded?.creadas ?? 0)));
          const duplicates = Math.max(0, payloads.length - success);
          setProgress({ processed: payloads.length, total: payloads.length, success, duplicates, failures: 0 });
          return {
            total: payloads.length,
            success,
            duplicates,
            failures: 0,
            errors: [],
          } satisfies SeedResultSummary;
        } catch (error) {
          const canFallbackToPublic = error instanceof ApiError && [400, 404, 405, 501].includes(error.status);
          if (!canFallbackToPublic) {
            throw error;
          }
        }
      }

      return postBatch(survey.slug, payloads, setProgress);
    },
  });

  return {
    seed: mutation.mutateAsync,
    isSeeding: mutation.isPending,
    result: mutation.data,
    progress,
    reset: () => {
      setProgress(null);
      mutation.reset();
    },
  };
}
