import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SurveyDraftPayload, SurveyPublic } from '@/types/encuestas';
import { buildSurveyPreview, SurveyPreviewTester } from './SurveyPreviewTester';

vi.mock('./SurveyForm', () => ({
  SurveyForm: ({ survey, previewMode }: { survey: SurveyPublic; previewMode?: boolean }) => (
    <div data-testid="mock-preview-form" data-preview-mode={String(previewMode)}>
      <span>{survey.titulo}</span>
      <span>{survey.preguntas.map((question) => question.id).join(',')}</span>
    </div>
  ),
}));

const adaptiveDraft: SurveyDraftPayload = {
  titulo: 'Entrevista vecinal',
  slug: 'entrevista-vecinal',
  descripcion: 'Diagnóstico de atención',
  tipo: 'opinion',
  inicio_at: null,
  fin_at: null,
  politica_unicidad: 'por_dni',
  anonimato: false,
  requiere_datos_contacto: true,
  preguntas: [
    {
      id: 900,
      orden: 1,
      tipo: 'opcion_unica',
      texto: '¿Usaste WhatsApp?',
      obligatoria: true,
      opciones: [
        { id: 500, orden: 1, texto: 'Sí' },
        { id: 501, orden: 2, texto: 'No' },
      ],
    },
    {
      id: 901,
      orden: 2,
      tipo: 'abierta',
      texto: 'Contanos qué pasó',
      obligatoria: true,
      conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 1 } },
    },
  ],
};

describe('SurveyPreviewTester', () => {
  it('builds deterministic synthetic IDs while preserving adaptive order rules', () => {
    const preview = buildSurveyPreview(adaptiveDraft);

    expect(preview).toEqual(
      expect.objectContaining({
        slug: '__local-survey-preview__',
        titulo: 'Entrevista vecinal',
        auth_mode: 'anonymous',
        anonimo_permitido: true,
      }),
    );
    expect(preview.preguntas.map((question) => question.id)).toEqual([1, 2]);
    expect(preview.preguntas[0].opciones?.map((option) => option.id)).toEqual([
      'preview-1-1',
      'preview-1-2',
    ]);
    expect(preview.preguntas[1].conditional_logic).toEqual({
      version: 1,
      show_if: { question_order: 1, option_order: 1 },
    });
  });

  it('opens an accessible, isolated preview on demand and can close it', async () => {
    render(<SurveyPreviewTester draft={adaptiveDraft} />);

    const openButton = screen.getByRole('button', { name: /abrir tester/i });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('mock-preview-form')).not.toBeInTheDocument();

    fireEvent.click(openButton);

    const previewForm = await screen.findByTestId('mock-preview-form');
    expect(previewForm).toHaveAttribute('data-preview-mode', 'true');
    expect(previewForm).toHaveTextContent('Entrevista vecinal');
    expect(screen.getByText(/no crea votos, no llama APIs, no emite analítica/i)).toBeInTheDocument();
    const closeButton = screen.getByRole('button', { name: /cerrar tester/i });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(closeButton.getAttribute('aria-controls') ?? '')).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(screen.queryByTestId('mock-preview-form')).not.toBeInTheDocument();
  });

  it('preserves stable refs and a nested v2 tree in the isolated preview', () => {
    const v2Draft: SurveyDraftPayload = {
      ...adaptiveDraft,
      preguntas: [
        {
          ...adaptiveDraft.preguntas[0],
          question_ref: 'question:channel',
          opciones: adaptiveDraft.preguntas[0].opciones?.map((option, index) => ({
            ...option,
            option_ref: index === 0 ? 'option:yes' : 'option:no',
          })),
        },
        {
          ...adaptiveDraft.preguntas[1],
          question_ref: 'question:detail',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator: 'and',
              children: [
                { kind: 'option_selected', question_ref: 'question:channel', option_ref: 'option:yes' },
              ],
            },
          },
        },
      ],
    };

    const preview = buildSurveyPreview(v2Draft);

    expect(preview.preguntas[0].question_ref).toBe('question:channel');
    expect(preview.preguntas[0].opciones?.[0].option_ref).toBe('option:yes');
    expect(preview.preguntas[1].conditional_logic).toEqual(v2Draft.preguntas[1].conditional_logic);
  });
});
