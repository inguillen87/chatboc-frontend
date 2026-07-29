import React from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { SurveyQuestionDraft, SurveyQuestionType } from './surveyTypes';

const QUESTION_TYPE_OPTIONS: Array<{ value: SurveyQuestionType; label: string }> = [
  { value: 'single', label: 'Opcion unica' },
  { value: 'multi', label: 'Seleccion multiple' },
  { value: 'rating', label: 'Rating' },
  { value: 'text', label: 'Texto libre' },
  { value: 'nps', label: 'NPS (cuarentena)' },
  { value: 'ranking', label: 'Ranking (cuarentena)' },
  { value: 'location', label: 'Ubicacion (cuarentena)' },
];

const MATERIALIZABLE_TYPES = new Set<SurveyQuestionType>(['single', 'multi', 'rating', 'text']);

const createEditorOptionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `option-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createDefaultOptions = (type: SurveyQuestionType) =>
  (type === 'rating' ? ['1', '2', '3', '4', '5'] : ['Opcion 1', 'Opcion 2']).map((label) => ({
    id: createEditorOptionId(),
    label,
    value: label,
  }));

export const normalizeSurveyQuestionForType = (
  question: SurveyQuestionDraft,
  type: SurveyQuestionType,
): SurveyQuestionDraft => {
  if (!MATERIALIZABLE_TYPES.has(type)) return { ...question, type };
  if (type === 'text') {
    return {
      ...question,
      type,
      options: undefined,
      min_selections: null,
      max_selections: null,
    };
  }
  const options = question.options?.length ? question.options : createDefaultOptions(type);
  if (type === 'multi') {
    const min = Math.max(question.required === false ? 0 : 1, question.min_selections ?? 1);
    const max = Math.max(min, Math.min(question.max_selections ?? options.length, options.length));
    return { ...question, type, required: question.required ?? true, options, min_selections: min, max_selections: max };
  }
  return {
    ...question,
    type,
    required: question.required ?? true,
    options,
    min_selections: question.required === false ? 0 : 1,
    max_selections: 1,
  };
};

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
  const materializable = MATERIALIZABLE_TYPES.has(question.type);
  const hasEditableOptions = question.type === 'single' || question.type === 'multi' || question.type === 'rating';
  const updateRequired = (checked: boolean) => {
    const next = { ...question, required: checked };
    if (hasEditableOptions && question.type !== 'multi') next.min_selections = checked ? 1 : 0;
    if (question.type === 'multi' && checked && (question.min_selections ?? 0) < 1) next.min_selections = 1;
    onChange(next);
  };

  const addOption = () => {
    const nextNumber = (question.options?.length ?? 0) + 1;
    const option = { id: createEditorOptionId(), label: `Opcion ${nextNumber}`, value: `Opcion ${nextNumber}` };
    onChange({
      ...question,
      options: [...(question.options ?? []), option],
      ...(question.type === 'multi' && question.max_selections === question.options?.length
        ? { max_selections: nextNumber }
        : {}),
    });
  };

  const updateOption = (optionId: string | undefined, optionIndex: number, label: string) => {
    onChange({
      ...question,
      options: (question.options ?? []).map((option, index) => {
        if (index !== optionIndex) return option;
        const previousLabel = option.label;
        return {
          ...option,
          id: optionId ?? createEditorOptionId(),
          label,
          value: option.value === undefined || option.value === previousLabel ? label : option.value,
        };
      }),
    });
  };

  const removeOption = (optionIndex: number) => {
    const options = (question.options ?? []).filter((_, index) => index !== optionIndex);
    const next: SurveyQuestionDraft = { ...question, options };
    if (question.type === 'multi') {
      next.max_selections = Math.min(question.max_selections ?? options.length, options.length);
      next.min_selections = Math.min(question.min_selections ?? 0, next.max_selections);
    }
    onChange(next);
  };

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
          <Select
            value={question.type}
            onValueChange={(value) => onChange(normalizeSurveyQuestionForType(question, value as SurveyQuestionType))}
          >
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

      {!materializable ? (
        <div className="mt-4 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Tipo en cuarentena: se conserva sin conversion, pero no puede materializarse ni publicarse hasta tener soporte backend.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            id={`survey-question-required-${question.id}`}
            checked={question.required === true}
            onCheckedChange={(checked) => updateRequired(checked === true)}
          />
          <Label htmlFor={`survey-question-required-${question.id}`}>Respuesta obligatoria</Label>
        </div>
      )}

      {hasEditableOptions ? (
        <div className="mt-4 space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <Label>Opciones</Label>
            <Button size="sm" type="button" variant="outline" onClick={addOption}>
              <Plus className="h-4 w-4" />
              Agregar opcion
            </Button>
          </div>
          {(question.options ?? []).map((option, optionIndex) => (
            <div className="flex items-center gap-2" key={option.id ?? `${question.id}-option-${optionIndex}`}>
              <Input
                aria-label={`Opcion ${optionIndex + 1} de pregunta ${index + 1}`}
                value={option.label ?? ''}
                onChange={(event) => updateOption(option.id, optionIndex, event.target.value)}
              />
              <Button
                aria-label={`Eliminar opcion ${optionIndex + 1} de pregunta ${index + 1}`}
                disabled={(question.options?.length ?? 0) <= 2}
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => removeOption(optionIndex)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {question.type === 'multi' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`survey-question-min-${question.id}`}>Minimo de selecciones</Label>
                <Input
                  id={`survey-question-min-${question.id}`}
                  max={question.max_selections ?? question.options?.length ?? 1}
                  min={question.required ? 1 : 0}
                  type="number"
                  value={question.min_selections ?? (question.required ? 1 : 0)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    const maximum = question.max_selections ?? question.options?.length ?? 1;
                    onChange({ ...question, min_selections: Math.max(question.required ? 1 : 0, Math.min(value, maximum)) });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`survey-question-max-${question.id}`}>Maximo de selecciones</Label>
                <Input
                  id={`survey-question-max-${question.id}`}
                  max={question.options?.length ?? 1}
                  min={question.min_selections ?? 0}
                  type="number"
                  value={question.max_selections ?? question.options?.length ?? 1}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    const minimum = question.min_selections ?? 0;
                    onChange({
                      ...question,
                      max_selections: Math.max(minimum, Math.min(value, question.options?.length ?? 1)),
                    });
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
