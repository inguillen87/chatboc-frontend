import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Plus, Save } from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { OfflineDraftQueue } from '@/services/pwa/OfflineDraftQueue';
import { getErrorMessage } from '@/utils/api';

import SurveyPreview from './SurveyPreview';
import SurveyQuestionEditor from './SurveyQuestionEditor';
import { saveSurveyDraftV2 } from './surveysApi';
import type { SurveyQuestionDraft } from './surveyTypes';

const QUESTION_TYPES: Array<{ type: SurveyQuestionDraft['type']; label: string }> = [
  { type: 'single', label: 'Opcion unica' },
  { type: 'multi', label: 'Multiple' },
  { type: 'rating', label: 'Rating' },
  { type: 'text', label: 'Texto' },
  { type: 'nps', label: 'NPS' },
];

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

  const payload = useMemo(
    () => ({
      title: title.trim(),
      description: description.trim(),
      questions,
    }),
    [description, questions, title],
  );

  const completedQuestions = questions.filter((question) => question.title.trim()).length;

  const addQuestion = (type: SurveyQuestionDraft['type']) => {
    setQuestions((prev) => [...prev, createQuestion(type)]);
  };

  const removeQuestion = (questionId: string) => {
    setQuestions((prev) => {
      const next = prev.filter((question) => question.id !== questionId);
      return next.length ? next : [createQuestion()];
    });
  };

  const updateQuestion = (questionId: string, nextQuestion: SurveyQuestionDraft) => {
    setQuestions((prev) => prev.map((question) => (question.id === questionId ? nextQuestion : question)));
  };

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Surveys v2</p>
          <h1 className="text-2xl font-semibold tracking-tight">Constructor de encuestas</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Draft mobile-first con guardado offline, preview y contrato listo para sincronizar con backend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isOnline ? 'secondary' : 'destructive'}>
            {isOnline ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <CloudOff className="mr-1 h-3.5 w-3.5" />}
            {isOnline ? 'Online' : 'Offline queue'}
          </Badge>
          <Badge variant="outline">{questions.length} preguntas</Badge>
          <Badge variant="outline">{completedQuestions} completas</Badge>
        </div>
      </header>

      {!isOnline ? (
        <ViewState
          status="offline"
          description="Podes seguir armando el borrador. El guardado se encola hasta recuperar conexion."
          className="min-h-[120px]"
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos del draft</CardTitle>
              <CardDescription>Informacion editable antes de publicar o entregar al backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="survey-draft-title">Titulo</Label>
                <Input
                  id="survey-draft-title"
                  value={title}
                  placeholder="Nombre interno de la encuesta"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-draft-description">Descripcion</Label>
                <Textarea
                  id="survey-draft-description"
                  className="min-h-28"
                  value={description}
                  placeholder="Contexto visible para operadores o plantilla backend"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-lg">Preguntas</CardTitle>
                <CardDescription>Tipos soportados por el contrato de encuestas v2.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPES.map((item) => (
                  <Button key={item.type} size="sm" type="button" variant="outline" onClick={() => addQuestion(item.type)}>
                    <Plus className="h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <SurveyQuestionEditor
                  key={question.id}
                  canRemove={questions.length > 1}
                  index={index}
                  question={question}
                  onChange={(next) => updateQuestion(question.id, next)}
                  onRemove={() => removeQuestion(question.id)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>Validacion rapida de estructura antes de guardar.</CardDescription>
            </CardHeader>
            <CardContent>
              <SurveyPreview questions={questions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guardado</CardTitle>
              <CardDescription>Usa el endpoint v2 cuando hay conexion y la cola PWA cuando no.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" type="button" disabled={isSaving} onClick={() => void handleSave()}>
                <Save className="h-4 w-4" />
                {isSaving ? 'Guardando...' : 'Guardar draft'}
              </Button>

              <Separator />

              {saveMessage ? (
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              ) : null}
              {saveError ? (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              ) : null}
              {!saveMessage && !saveError ? <p className="text-sm text-muted-foreground">Los drafts quedan listos para sincronizacion backend.</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
