import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { adminSeedSurvey } from '@/api/encuestas';
import type { SurveyAdmin, SurveyPublic } from '@/types/encuestas';
import { isSurveyResponseDuplicateError } from '@/utils/surveySubmissionErrors';

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

const normalizeRequestedCount = (count: number | undefined): number => {
  const normalized = Math.round(count ?? 100);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error('La cantidad de respuestas sintéticas debe ser un número entero mayor a cero.');
  }
  return normalized;
};

export function useSurveySeedResponses() {
  const [progress, setProgress] = useState<SeedProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ survey, count, scenario }: SeedArgs) => {
      setProgress(null);
      const surveyId = typeof (survey as { id?: unknown })?.id === 'number'
        ? (survey as { id: number }).id
        : null;
      if (surveyId === null || !Number.isSafeInteger(surveyId) || surveyId <= 0) {
        throw new Error('La encuesta no tiene un identificador administrativo válido.');
      }

      const requestedCount = normalizeRequestedCount(count);

      try {
        const seeded = await adminSeedSurvey(surveyId, {
          cantidad: requestedCount,
          municipality_label: survey?.municipio_nombre ?? undefined,
          scenario: scenario ?? undefined,
        });
        const success = Math.max(0, Math.min(requestedCount, Number(seeded?.creadas ?? 0)));
        const duplicates = Math.max(0, requestedCount - success);
        setProgress({ processed: requestedCount, total: requestedCount, success, duplicates, failures: 0 });
        return {
          total: requestedCount,
          success,
          duplicates,
          failures: 0,
          errors: [],
        } satisfies SeedResultSummary;
      } catch (error) {
        if (isSurveyResponseDuplicateError(error)) {
          const duplicateSummary = {
            total: requestedCount,
            success: 0,
            duplicates: requestedCount,
            failures: 0,
            errors: [],
          } satisfies SeedResultSummary;
          setProgress({
            processed: requestedCount,
            total: requestedCount,
            success: 0,
            duplicates: requestedCount,
            failures: 0,
          });
          return duplicateSummary;
        }
        throw error;
      }
    },
    // Synthetic generation is server-side only. A failed administrative call
    // is terminal and must never degrade to public-response submissions.
    retry: false,
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
