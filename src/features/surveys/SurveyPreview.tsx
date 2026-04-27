import React from 'react';
import type { SurveyQuestionDraft } from './surveyTypes';

export default function SurveyPreview({ questions }: { questions: SurveyQuestionDraft[] }) {
  return <ul className="text-sm text-muted-foreground">{questions.map((q) => <li key={q.id}>{q.title} · {q.type}</li>)}</ul>;
}
