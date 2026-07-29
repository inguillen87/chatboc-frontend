import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SurveyQuestionEditor, { normalizeSurveyQuestionForType } from './SurveyQuestionEditor';
import type { SurveyQuestionDraft } from './surveyTypes';

const Harness = ({ initial }: { initial: SurveyQuestionDraft }) => {
  const [question, setQuestion] = useState(initial);
  return <SurveyQuestionEditor index={0} question={question} onChange={setQuestion} />;
};

describe('SurveyQuestionEditor materializable questions', () => {
  it('clears hidden selection data when the operator changes a question to free text', () => {
    const question: SurveyQuestionDraft = {
      id: 'q-selection',
      title: 'Seleccion',
      type: 'single',
      required: true,
      min_selections: 1,
      max_selections: 1,
      options: [{ id: 'o-1', label: 'Uno', value: 'uno' }],
    };

    expect(normalizeSurveyQuestionForType(question, 'text')).toMatchObject({
      type: 'text',
      options: undefined,
      min_selections: null,
      max_selections: null,
    });
  });
  it('creates a valid rating shape with stable, unique option refs', () => {
    const normalized = normalizeSurveyQuestionForType(
      { id: 'q-rating', title: 'Puntua', type: 'text' },
      'rating',
    );

    expect(normalized).toMatchObject({ required: true, min_selections: 1, max_selections: 1 });
    expect(normalized.options).toHaveLength(5);
    expect(new Set(normalized.options?.map((option) => option.id)).size).toBe(5);
  });

  it('edits and adds options without replacing their existing refs', () => {
    render(
      <Harness
        initial={{
          id: 'q-multi',
          title: 'Canales',
          type: 'multi',
          required: true,
          min_selections: 1,
          max_selections: 2,
          options: [
            { id: 'o-web', label: 'Web', value: 'web' },
            { id: 'o-wa', label: 'WhatsApp', value: 'wa' },
          ],
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Opcion 1 de pregunta 1'), { target: { value: 'Portal web' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar opcion' }));

    expect(screen.getByDisplayValue('Portal web')).toBeInTheDocument();
    expect(screen.getByLabelText('Opcion 3 de pregunta 1')).toHaveValue('Opcion 3');
    expect(screen.getByLabelText('Maximo de selecciones')).toHaveValue(3);
    expect(screen.getAllByRole('button', { name: /eliminar opcion/i })).toHaveLength(3);
  });

  it('marks unsupported question types as non-materializable instead of disguising them', () => {
    render(<Harness initial={{ id: 'q-nps', title: 'NPS', type: 'nps' }} />);

    expect(screen.getByRole('status')).toHaveTextContent(/tipo en cuarentena/i);
    expect(screen.queryByLabelText('Respuesta obligatoria')).not.toBeInTheDocument();
  });
});
