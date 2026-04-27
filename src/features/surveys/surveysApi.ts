import { panelApi } from '@/api/v2/client';
import type { SurveyQuestionDraft } from './surveyTypes';

export const saveSurveyDraftV2 = (payload: { title: string; description?: string; questions: SurveyQuestionDraft[] }) =>
  panelApi.post('/api/v2/surveys/draft', payload, { legacyFallbackPath: '/municipal/surveys' });
