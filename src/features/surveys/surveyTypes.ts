import type { SurveyConditionalLogic } from '@/types/encuestas';

export type SurveyQuestionType = 'single' | 'multi' | 'rating' | 'text' | 'nps' | 'ranking' | 'location';
export interface SurveyQuestionDraft {
  id: string;
  title: string;
  type: SurveyQuestionType;
  required?: boolean;
  min_selections?: number | null;
  max_selections?: number | null;
  options?: Array<{
    id?: string;
    option_ref?: string | null;
    label?: string;
    value?: string | number;
    [key: string]: unknown;
  }>;
  question_ref?: string | null;
  conditional_logic?: SurveyConditionalLogic | null;
  [key: string]: unknown;
}

export interface SurveyDraftSaveInput {
  draft_id?: string;
  idempotency_key?: string;
  revision?: number;
  schema_version?: string;
  document?: import('./surveyDocument').SurveyDocument;
  title: string;
  description?: string;
  questions: SurveyQuestionDraft[];
  [key: string]: unknown;
}

export interface SurveyDraftDocument {
  draft_id: string;
  revision: number;
  schema_version?: string;
  title: string;
  description?: string;
  questions: SurveyQuestionDraft[];
  [key: string]: unknown;
}

export interface SurveyDraftPersistenceAck {
  ok?: boolean;
  contract_version?: string;
  persisted: boolean;
  draft_id?: string;
  revision?: number;
  schema_version?: string;
  created_at?: string;
  updated_at?: string;
  draft?: SurveyDraftDocument;
  document?: import('./surveyDocument').SurveyDocument;
  raw: unknown;
}

export interface SurveyDraftMaterializationAck {
  contract_version: 'surveys.materialization.v1';
  ok: true;
  persisted: true;
  replayed: boolean;
  idempotency_key: string;
  receipt_id: number;
  survey_id: number;
  draft: {
    draft_id: string;
    revision: number;
    schema_version: import('./surveyDocument').SurveyDocumentSchemaVersion;
    document_ref: string;
    payload_hash: string;
  };
  survey: Record<string, unknown>;
  raw: unknown;
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
