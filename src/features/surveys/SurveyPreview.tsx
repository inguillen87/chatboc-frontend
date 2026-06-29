import React from 'react';
import { MessageSquareText, Star } from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';

import type { SurveyQuestionDraft } from './surveyTypes';

const TYPE_LABELS: Record<SurveyQuestionDraft['type'], string> = {
  single: 'Opcion unica',
  multi: 'Seleccion multiple',
  rating: 'Rating',
  text: 'Texto libre',
  nps: 'NPS',
  location: 'Ubicacion',
  ranking: 'Ranking',
};

export default function SurveyPreview({ questions }: { questions: SurveyQuestionDraft[] }) {
  if (!questions.length) {
    return (
      <ViewState
        status="empty"
        title="Preview sin preguntas"
        description="Agrega una pregunta para validar el recorrido antes de publicarlo."
        className="min-h-[180px] border-dashed bg-background"
      />
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const title = question.title.trim() || `Pregunta ${index + 1}`;

        return (
          <article key={question.id} className="rounded-lg border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paso {index + 1}</p>
                <h3 className="mt-1 break-words text-sm font-semibold leading-5">{title}</h3>
              </div>
              <Badge className="shrink-0" variant="outline">
                {TYPE_LABELS[question.type]}
              </Badge>
            </div>

            <div className="mt-4 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              {question.type === 'rating' || question.type === 'nps' ? (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  <span>Escala numerica definida al publicar.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4" />
                  <span>Respuesta preparada para render dinamico.</span>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
