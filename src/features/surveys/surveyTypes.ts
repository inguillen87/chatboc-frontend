export type SurveyQuestionType = 'single' | 'multi' | 'rating' | 'text' | 'nps';
export interface SurveyQuestionDraft { id: string; title: string; type: SurveyQuestionType; }
