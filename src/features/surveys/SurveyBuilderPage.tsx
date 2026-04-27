import React, { useState } from 'react';
import SurveyQuestionEditor from './SurveyQuestionEditor';
import SurveyPreview from './SurveyPreview';
import { saveSurveyDraftV2 } from './surveysApi';

export default function SurveyBuilderPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([{ id: crypto.randomUUID(), title: '', type: 'single' as const }]);

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-xl font-semibold">Survey Builder</h1>
      <input className="w-full rounded border px-2 py-1" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="w-full rounded border px-2 py-1" placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
      {questions.map((question, index) => (
        <SurveyQuestionEditor
          key={question.id}
          question={question}
          onChange={(next) => setQuestions((prev) => prev.map((item, i) => (i === index ? next : item)))}
        />
      ))}
      <button className="rounded border px-3 py-1" onClick={() => setQuestions((prev) => [...prev, { id: crypto.randomUUID(), title: '', type: 'text' }])}>Agregar pregunta</button>
      <button className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => void saveSurveyDraftV2({ title, description, questions })}>Guardar draft</button>
      <SurveyPreview questions={questions} />
    </div>
  );
}
