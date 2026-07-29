import type { SurveyAdmin, SurveyDraftPayload } from '@/types/encuestas';

/**
 * Carries the revision that the operator actually edited. The backend can then
 * reject a stale structural write instead of silently overwriting a colleague.
 */
export const withExpectedSurveyStructureRevision = (
  payload: SurveyDraftPayload,
  survey?: Pick<SurveyAdmin, 'structure_guard'> | null,
): SurveyDraftPayload => {
  if (payload.expected_structure_revision !== undefined) return payload;
  const revision = survey?.structure_guard?.revision;
  if (!Number.isInteger(revision) || Number(revision) <= 0) return payload;
  return { ...payload, expected_structure_revision: Number(revision) };
};
