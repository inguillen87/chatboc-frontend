import React from 'react';
import type { SurveyQuestionDraft, SurveyQuestionType } from './surveyTypes';

export default function SurveyQuestionEditor({ question, onChange }: { question: SurveyQuestionDraft; onChange: (q: SurveyQuestionDraft) => void }) {
  return (
    <div className="grid gap-2 rounded border p-2">
      <input className="rounded border px-2 py-1" value={question.title} onChange={(e) => onChange({ ...question, title: e.target.value })} />
      <select className="rounded border px-2 py-1" value={question.type} onChange={(e) => onChange({ ...question, type: e.target.value as SurveyQuestionType })}>
        <option value="single">single</option><option value="multi">multi</option><option value="rating">rating</option><option value="text">text</option><option value="nps">nps</option>
      </select>
    </div>
  );
}
