export type SurveyQuestionType = 'single' | 'multi' | 'rating' | 'text' | 'nps' | 'ranking' | 'location';
export interface SurveyQuestionDraft {
  id: string;
  title: string;
  type: SurveyQuestionType;
  options?: Array<{ id?: string; label?: string; value?: string | number }>;
}

export interface SurveyV2 {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  public_token?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  questions: SurveyQuestionDraft[];
  raw?: unknown;
}
