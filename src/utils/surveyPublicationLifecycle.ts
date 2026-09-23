import type { SurveyAdmin } from '@/types/encuestas';

const GOVERNED_RELEASE_MODE = 'governed_release';
const GOVERNED_RELEASE_REASON = 'survey_governance_release_required';

export const isGovernedSurvey = (survey: SurveyAdmin): boolean =>
  survey.governance?.release_required === true ||
  survey.governance?.mode === GOVERNED_RELEASE_MODE ||
  survey.admin_lifecycle?.actions.publish.disabled_reason_code === GOVERNED_RELEASE_REASON;

export const getSurveyGovernanceWorkspacePath = (surveyId: number): string =>
  `/admin/encuestas/${surveyId}?section=governance#survey-governance`;
