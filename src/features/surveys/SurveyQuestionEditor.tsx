import React from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { SurveyQuestionDraft, SurveyQuestionType } from './surveyTypes';

const QUESTION_TYPE_OPTIONS: Array<{ value: SurveyQuestionType; label: string }> = [
  { value: 'single', label: 'Opcion unica' },
  { value: 'multi', label: 'Seleccion multiple' },
  { value: 'rating', label: 'Rating' },
  { value: 'text', label: 'Texto libre' },
  { value: 'nps', label: 'NPS' },
];

interface SurveyQuestionEditorProps {
  question: SurveyQuestionDraft;
  index?: number;
  onChange: (q: SurveyQuestionDraft) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

export default function SurveyQuestionEditor({
  question,
  index = 0,
  onChange,
  onRemove,
  canRemove = false,
}: SurveyQuestionEditorProps) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pregunta {index + 1}</p>
          <p className="text-sm text-muted-foreground">El contenido final puede venir del backend o quedar como draft interno.</p>
        </div>
        {canRemove && onRemove ? (
          <Button aria-label={`Eliminar pregunta ${index + 1}`} size="icon" type="button" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <Label htmlFor={`survey-question-title-${question.id}`}>Texto de la pregunta</Label>
          <Input
            id={`survey-question-title-${question.id}`}
            value={question.title}
            placeholder="Escribir pregunta"
            onChange={(e) => onChange({ ...question, title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`survey-question-type-${question.id}`}>Tipo</Label>
          <Select value={question.type} onValueChange={(value) => onChange({ ...question, type: value as SurveyQuestionType })}>
            <SelectTrigger id={`survey-question-type-${question.id}`}>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
