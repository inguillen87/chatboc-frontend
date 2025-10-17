import { useMutation } from '@tanstack/react-query';

import { postPublicResponse } from '@/api/encuestas';
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

const postBatch = async (
  slug: string,
  payloads: ReturnType<typeof generateSurveySeedPayloads>['payloads'],
): Promise<SeedResultSummary> => {
  const summary: SeedResultSummary = { total: payloads.length, success: 0, failures: 0, errors: [] };
  const concurrency = 5;

  for (let index = 0; index < payloads.length; index += concurrency) {
    const chunk = payloads.slice(index, index + concurrency);
    const settled = await Promise.allSettled(
      chunk.map((payload) =>
        postPublicResponse(slug, payload).catch((error) => {
          throw error;
        }),
      ),
    );

    settled.forEach((result, offset) => {
      const globalIndex = index + offset;
      if (result.status === 'fulfilled') {
        summary.success += 1;
      } else {
        summary.failures += 1;
        summary.errors.push({ index: globalIndex, error: result.reason });
      }
    });
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
