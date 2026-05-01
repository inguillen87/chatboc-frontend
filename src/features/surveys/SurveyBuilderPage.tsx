import React, { useState } from 'react';
import SurveyQuestionEditor from './SurveyQuestionEditor';
import SurveyPreview from './SurveyPreview';
import { saveSurveyDraftV2 } from './surveysApi';
import type { SurveyQuestionDraft } from './surveyTypes';
import { ViewState } from '@/components/app-shell/ViewState';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { OfflineDraftQueue } from '@/services/pwa/OfflineDraftQueue';
import { getErrorMessage } from '@/utils/api';

const createQuestionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `question-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createQuestion = (type: SurveyQuestionDraft['type'] = 'single'): SurveyQuestionDraft => ({
  id: createQuestionId(),
  title: '',
  type,
});

export default function SurveyBuilderPage() {
  const { isOnline } = useNetworkStatus();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestionDraft[]>([createQuestion()]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const payload = { title, description, questions };

  const handleSave = async () => {
    setSaveMessage('');
    setSaveError('');

    if (!isOnline) {
      OfflineDraftQueue.addAction('survey_draft', payload);
      setSaveMessage('Draft guardado localmente. Se sincronizara cuando vuelva la conexion.');
      return;
    }

    setIsSaving(true);
    try {
      await saveSurveyDraftV2(payload);
      setSaveMessage('Draft guardado.');
    } catch (error) {
      setSaveError(getErrorMessage(error, 'No se pudo guardar el draft.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Survey Builder</h1>
        <p className="text-sm text-muted-foreground">Constructor mobile-first con draft offline y preview.</p>
      </div>

      {!isOnline ? (
        <ViewState
          status="offline"
          description="Podes seguir armando el borrador. El guardado se encola hasta recuperar conexion."
          className="min-h-[120px]"
        />
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Titulo</span>
        <input className="w-full rounded-md border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Descripcion</span>
        <textarea className="min-h-24 w-full rounded-md border px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="space-y-3">
        {questions.map((question, index) => (
          <SurveyQuestionEditor
            key={question.id}
            question={question}
            onChange={(next) => setQuestions((prev) => prev.map((item, i) => (i === index ? next : item)))}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded-md border px-3 py-2 text-sm" type="button" onClick={() => setQuestions((prev) => [...prev, createQuestion('text')])}>
          Agregar pregunta
        </button>
        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" type="button" disabled={isSaving} onClick={() => void handleSave()}>
          {isSaving ? 'Guardando...' : 'Guardar draft'}
        </button>
      </div>

      {saveMessage ? <p className="text-sm text-emerald-600">{saveMessage}</p> : null}
      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

      <SurveyPreview questions={questions} />
    </div>
  );
}
