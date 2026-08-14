import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyEditor } from './SurveyEditor';
import type { SurveyAdmin, SurveyDraftPayload } from '@/types/encuestas';

vi.mock('framer-motion', () => ({
  Reorder: {
    Group: ({
      children,
      values,
      onReorder,
    }: PropsWithChildren<{ values?: unknown[]; onReorder?: (values: unknown[]) => void }>) => (
      <div>
        {children}
        <button
          type="button"
          onClick={() => {
            if (values && values.length >= 2) onReorder?.([values[1], values[0], ...values.slice(2)]);
          }}
        >
          Reordenar preguntas para prueba
        </button>
      </div>
    ),
    Item: ({
      children,
      dragListener,
    }: PropsWithChildren<{ dragListener?: boolean }>) => (
      <div data-testid="survey-reorder-item" data-drag-listener={String(dragListener)}>
        {children}
      </div>
    ),
  },
}));

const initialDraft: SurveyDraftPayload = {
  titulo: 'Titulo inicial',
  slug: 'titulo-inicial',
  descripcion: 'Descripcion inicial',
  tipo: 'opinion',
  inicio_at: null,
  fin_at: null,
  politica_unicidad: 'libre',
  anonimato: true,
  requiere_datos_contacto: false,
  preguntas: [
    {
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Pregunta inicial',
      obligatoria: true,
      opciones: [
        { orden: 1, texto: 'Opcion inicial', valor: 'inicial' },
        { orden: 2, texto: 'Otra opcion', valor: 'otra' },
      ],
    },
  ],
};

const adaptiveDraft: SurveyDraftPayload = {
  ...initialDraft,
  titulo: 'Entrevista adaptativa',
  preguntas: [
    {
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Canal utilizado',
      obligatoria: true,
      opciones: [
        { orden: 1, texto: 'Web', valor: 'web' },
        { orden: 2, texto: 'WhatsApp', valor: 'whatsapp' },
      ],
    },
    {
      orden: 2,
      tipo: 'abierta',
      texto: 'Comentario general',
      obligatoria: false,
    },
    {
      orden: 3,
      tipo: 'abierta',
      texto: 'Que paso en WhatsApp',
      obligatoria: true,
      conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 2 } },
    },
  ],
};

const ratingSourceDraft: SurveyDraftPayload = {
  ...initialDraft,
  preguntas: [
    {
      orden: 1,
      tipo: 'rating_emoji',
      texto: 'Califica la experiencia',
      obligatoria: true,
      opciones: [
        { orden: 1, texto: 'Bien' },
        { orden: 2, texto: 'Mal' },
      ],
    },
    {
      orden: 2,
      tipo: 'abierta',
      texto: 'Detalle',
      obligatoria: false,
    },
  ],
};

const immediateAdaptiveDraft: SurveyDraftPayload = {
  ...initialDraft,
  preguntas: [adaptiveDraft.preguntas[0], adaptiveDraft.preguntas[2]].map((question, index) => ({
    ...question,
    orden: index + 1,
    conditional_logic:
      index === 1 ? { version: 1, show_if: { question_order: 1, option_order: 2 } } : undefined,
  })),
};

const referencedDraft: SurveyDraftPayload = {
  ...initialDraft,
  document_ref: 'draft:municipio:participacion-2026',
  preguntas: [
    {
      ...initialDraft.preguntas[0],
      question_ref: 'question:canal-preferido',
      opciones: initialDraft.preguntas[0].opciones?.map((option, index) => ({
        ...option,
        option_ref: `option:canal-${index + 1}`,
      })),
    },
  ],
};

const multiSourceAdaptiveDraft: SurveyDraftPayload = {
  ...initialDraft,
  preguntas: [
    {
      orden: 1,
      question_ref: 'question:channel',
      tipo: 'opcion_unica',
      texto: 'Canal',
      obligatoria: true,
      opciones: [
        { orden: 1, option_ref: 'option:web', texto: 'Web' },
        { orden: 2, option_ref: 'option:whatsapp', texto: 'WhatsApp' },
      ],
    },
    {
      orden: 2,
      question_ref: 'question:device',
      tipo: 'multiple',
      texto: 'Dispositivo',
      obligatoria: true,
      opciones: [
        { orden: 1, option_ref: 'option:desktop', texto: 'Desktop' },
        { orden: 2, option_ref: 'option:mobile', texto: 'Mobile' },
      ],
    },
    {
      orden: 3,
      question_ref: 'question:detail',
      tipo: 'abierta',
      texto: 'Detalle',
      obligatoria: false,
      conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 2 } },
    },
  ],
};

const v2AdaptiveDraft: SurveyDraftPayload = {
  ...multiSourceAdaptiveDraft,
  preguntas: multiSourceAdaptiveDraft.preguntas.map((question, index) => index === 2
    ? {
        ...question,
        conditional_logic: {
          version: 2,
          show_if: {
            kind: 'group',
            operator: 'and',
            children: [
              { kind: 'option_selected', question_ref: 'question:channel', option_ref: 'option:whatsapp' },
              {
                kind: 'group',
                operator: 'or',
                children: [
                  { kind: 'option_selected', question_ref: 'question:device', option_ref: 'option:mobile' },
                ],
              },
            ],
          },
        },
      }
    : question),
};

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

describe('SurveyEditor save and publish flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('preserves durable document, question and option references when saving in the admin editor', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={referencedDraft} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.document_ref).toBe('draft:municipio:participacion-2026');
    expect(payload.preguntas[0].question_ref).toBe('question:canal-preferido');
    expect(payload.preguntas[0].opciones?.map((option) => option.option_ref)).toEqual([
      'option:canal-1',
      'option:canal-2',
    ]);
  });

  it('assigns the city role explicitly and persists matching backend references', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={initialDraft} onSave={onSave} />);

    fireEvent.keyDown(screen.getByRole('combobox', {
      name: 'Uso en segmentación de la pregunta 1',
    }), { key: 'ArrowDown' });
    fireEvent.pointerUp(await screen.findByRole('option', { name: 'Ciudad o localidad' }), {
      button: 0,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas[0]).toMatchObject({
      tipo: 'opcion_unica',
      question_ref: 'demographic:city',
      logical_ref: 'demographic:city',
    });
    expect(screen.getByText(/JUNI no la deduce del enunciado/i)).toBeInTheDocument();
  });

  it('keeps adaptive references valid when assigning a demographic role', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const draftWithReportingValues: SurveyDraftPayload = {
      ...v2AdaptiveDraft,
      preguntas: v2AdaptiveDraft.preguntas.map((question, questionIndex) => questionIndex === 0
        ? {
            ...question,
            opciones: question.opciones?.map((option, optionIndex) => ({
              ...option,
              valor: optionIndex === 0 ? 'web' : 'whatsapp',
            })),
          }
        : question),
    };
    render(<SurveyEditor initialDraft={draftWithReportingValues} onSave={onSave} />);

    fireEvent.keyDown(screen.getByRole('combobox', {
      name: 'Uso en segmentación de la pregunta 1',
    }), { key: 'ArrowDown' });
    fireEvent.pointerUp(await screen.findByRole('option', { name: 'Ciudad o localidad' }), {
      button: 0,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas[2].conditional_logic).toEqual({
      version: 2,
      show_if: {
        kind: 'group',
        operator: 'and',
        children: [
          { kind: 'option_selected', question_ref: 'demographic:city', option_ref: 'option:whatsapp' },
          {
            kind: 'group',
            operator: 'or',
            children: [
              { kind: 'option_selected', question_ref: 'question:device', option_ref: 'option:mobile' },
            ],
          },
        ],
      },
    });
  });

  it('blocks duplicate demographic roles before calling the backend', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const duplicateCityDraft: SurveyDraftPayload = {
      ...initialDraft,
      preguntas: [
        {
          ...initialDraft.preguntas[0],
          question_ref: 'demographic:city',
          logical_ref: 'demographic:city',
        },
        {
          ...initialDraft.preguntas[0],
          orden: 2,
          texto: 'Otra ciudad',
          question_ref: 'demographic:city',
          logical_ref: 'demographic:city',
        },
      ],
    };
    render(<SurveyEditor initialDraft={duplicateCityDraft} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/solo puede asignarse a una pregunta/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires explicit unique reporting values for demographic options', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const missingValuesDraft: SurveyDraftPayload = {
      ...initialDraft,
      preguntas: [{
        ...initialDraft.preguntas[0],
        question_ref: 'demographic:province',
        logical_ref: 'demographic:province',
        opciones: initialDraft.preguntas[0].opciones?.map((option) => ({
          ...option,
          valor: undefined,
        })),
      }],
    };
    render(<SurveyEditor initialDraft={missingValuesDraft} onSave={onSave} />);

    expect(screen.getAllByPlaceholderText('Valor para informes (obligatorio)')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Completá el valor para informes/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('preserves and locks the role reference of an already persisted question', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const persistedSurvey = {
      ...initialDraft,
      id: 77,
      estado: 'borrador',
      preguntas: [{
        ...initialDraft.preguntas[0],
        id: 701,
        question_ref: 'question:existing-city-label',
        logical_ref: 'question:existing-city-label',
        opciones: initialDraft.preguntas[0].opciones?.map((option, optionIndex) => ({
          ...option,
          id: optionIndex + 1,
        })),
      }],
    } as SurveyAdmin;
    render(<SurveyEditor survey={persistedSurvey} onSave={onSave} />);

    expect(screen.getByRole('combobox', {
      name: 'Uso en segmentación de la pregunta 1',
    })).toBeDisabled();
    expect(screen.getByText(/para conservar el historial/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas[0]).toMatchObject({
      question_ref: 'question:existing-city-label',
      logical_ref: 'question:existing-city-label',
    });
  });

  it('saves the prepared title and option before publishing and blocks duplicate submits', async () => {
    const update = createDeferred();
    const calls: string[] = [];
    const onSave = vi.fn(async () => {
      calls.push('update');
      await update.promise;
    });
    const onPublish = vi.fn(async () => {
      calls.push('publish');
    });

    render(
      <SurveyEditor
        initialDraft={initialDraft}
        onSave={onSave}
        onPublish={onPublish}
      />,
    );

    const titleInput = screen.getByLabelText(/t.tulo/i);
    const optionInput = screen.getAllByPlaceholderText('Texto visible')[0];
    fireEvent.change(titleInput, { target: { value: 'Titulo listo para publicar' } });
    fireEvent.change(optionInput, { target: { value: 'Opcion editada' } });

    const publishButton = screen.getByRole('button', { name: 'Publicar' });
    fireEvent.click(publishButton);
    fireEvent.click(publishButton);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardando y publicando...' })).toBeDisabled();
    expect(titleInput).toBeDisabled();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Titulo listo para publicar',
        preguntas: [
          expect.objectContaining({
            opciones: [
              expect.objectContaining({ texto: 'Opcion editada' }),
              expect.objectContaining({ texto: 'Otra opcion' }),
            ],
          }),
        ],
      }),
    );

    update.resolve();

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(calls).toEqual(['update', 'publish']);
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeEnabled();
  });

  it('keeps the edited draft and update error when saving fails without publishing', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Update rechazado'));
    const onPublish = vi.fn().mockResolvedValue(undefined);

    render(
      <SurveyEditor
        initialDraft={initialDraft}
        onSave={onSave}
        onPublish={onPublish}
      />,
    );

    const titleInput = screen.getByLabelText(/t.tulo/i);
    const optionInput = screen.getAllByPlaceholderText('Texto visible')[0];
    fireEvent.change(titleInput, { target: { value: 'Titulo pendiente' } });
    fireEvent.change(optionInput, { target: { value: 'Opcion pendiente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Update rechazado');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
    expect(titleInput).toHaveValue('Titulo pendiente');
    expect(optionInput).toHaveValue('Opcion pendiente');
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeEnabled();
  });

  it('loads a conditional rule and serializes its current orders after reordering', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={adaptiveDraft} onSave={onSave} />);

    expect(screen.getByRole('switch', { name: 'Activar ruta adaptativa para pregunta 3' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Reordenar preguntas para prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas.map((question) => question.texto)).toEqual([
      'Comentario general',
      'Canal utilizado',
      'Que paso en WhatsApp',
    ]);
    expect(payload.preguntas[2].conditional_logic).toEqual({
      version: 1,
      show_if: { question_order: 2, option_order: 2 },
    });
  });

  it('allows an operator to remove an existing adaptive rule explicitly', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={adaptiveDraft} onSave={onSave} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Activar ruta adaptativa para pregunta 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas[2].conditional_logic).toBeNull();
  });

  it('upgrades a simple v1 route explicitly and authors a lossless AND group', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={multiSourceAdaptiveDraft} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Combinar con AND/OR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar condicion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas[2].conditional_logic).toEqual({
      version: 2,
      show_if: {
        kind: 'group',
        operator: 'and',
        children: [
          { kind: 'option_selected', question_ref: 'question:channel', option_ref: 'option:whatsapp' },
          { kind: 'option_selected', question_ref: 'question:device', option_ref: 'option:desktop' },
        ],
      },
    });
  });

  it('preserves a nested v2 expression exactly when opening and saving the editor', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={v2AdaptiveDraft} onSave={onSave} />);

    expect(screen.getByRole('heading', { name: /mapa de l.gica/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Condicion 1: pregunta')).toBeInTheDocument();
    expect(screen.getByLabelText('Condicion 2: pregunta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas[2].conditional_logic).toEqual(v2AdaptiveDraft.preguntas[2].conditional_logic);
  });

  it('blocks saving a v2 rule with a dangling stable reference instead of deleting it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const danglingDraft: SurveyDraftPayload = {
      ...v2AdaptiveDraft,
      preguntas: v2AdaptiveDraft.preguntas.map((question, index) => index === 2
        ? {
            ...question,
            conditional_logic: {
              version: 2,
              show_if: {
                kind: 'group',
                operator: 'and',
                children: [
                  { kind: 'option_selected', question_ref: 'question:missing', option_ref: 'option:missing' },
                ],
              },
            },
          }
        : question),
    };
    render(<SurveyEditor initialDraft={danglingDraft} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText(/hay una ruta adaptativa invalida/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not offer rating questions as conditional sources', () => {
    render(<SurveyEditor initialDraft={ratingSourceDraft} onSave={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Activar ruta adaptativa para pregunta 2' })).toBeDisabled();
  });

  it('does not reorder or rewrite adaptive rules when the structure is locked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={adaptiveDraft} structureLocked onSave={onSave} />);

    screen.getAllByTestId('survey-reorder-item').forEach((item) => {
      expect(item).toHaveAttribute('data-drag-listener', 'false');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar preguntas para prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas.map((question) => question.texto)).toEqual([
      'Canal utilizado',
      'Comentario general',
      'Que paso en WhatsApp',
    ]);
    expect(payload.preguntas[2].conditional_logic).toEqual({
      version: 1,
      show_if: { question_order: 1, option_order: 2 },
    });
  });

  it('rejects a reorder that would move a dependent before its source', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={immediateAdaptiveDraft} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reordenar preguntas para prueba' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/antes de la pregunta que activa su ruta/i);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0] as SurveyDraftPayload;
    expect(payload.preguntas.map((question) => question.texto)).toEqual([
      'Canal utilizado',
      'Que paso en WhatsApp',
    ]);
    expect(payload.preguntas[1].conditional_logic).toEqual({
      version: 1,
      show_if: { question_order: 1, option_order: 2 },
    });
  });

  it('opens the current adaptive draft in an isolated visual tester', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SurveyEditor initialDraft={adaptiveDraft} onSave={onSave} />);

    const openButton = screen.getByRole('button', { name: /abrir tester/i });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(openButton);

    const previewTester = screen.getByTestId('survey-preview-tester');
    expect(await within(previewTester).findByTestId('survey-preview-route')).toHaveTextContent(/2 de 3 preguntas visibles/i);
    expect(within(previewTester).queryByText(/que paso en whatsapp/i, { selector: 'h3' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('WhatsApp'));

    expect(await within(previewTester).findByText(/3 de 3 preguntas visibles/i)).toBeInTheDocument();
    expect(within(previewTester).getByText(/que paso en whatsapp/i, { selector: 'h3' })).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(window.localStorage).toHaveLength(0);
  });

  it('offers a WhatsApp CTA when a published survey has a public URL', () => {
    const survey = {
      ...initialDraft,
      id: 42,
      estado: 'publicada',
      inicio_at: '2026-08-14T12:00:00.000Z',
      fin_at: '2026-08-21T12:00:00.000Z',
      tenant_slug: 'tenant-equivocado',
      url_publica: 'https://www.chatboc.ar/e/votacion-si-no',
      preguntas: initialDraft.preguntas.map((question, questionIndex) => ({
        ...question,
        id: questionIndex + 1,
        opciones: question.opciones?.map((option, optionIndex) => ({
          ...option,
          id: optionIndex + 1,
        })),
      })),
    } as SurveyAdmin;

    render(<SurveyEditor survey={survey} tenantSlug="org-demo" onSave={vi.fn()} />);

    const whatsappLink = screen.getByRole('link', { name: 'Compartir por WhatsApp' });
    const whatsappUrl = new URL(whatsappLink.getAttribute('href') ?? '');
    expect(whatsappUrl.origin).toBe('https://wa.me');
    expect(whatsappUrl.searchParams.get('text')).toContain(survey.titulo);
    expect(whatsappUrl.searchParams.get('text')).toContain(
      'https://www.chatboc.ar/e/votacion-si-no?tenant_slug=org-demo',
    );
    expect(whatsappUrl.searchParams.get('text')).not.toContain('tenant-equivocado');
    expect(decodeURIComponent(screen.getByAltText('Código QR de la encuesta').getAttribute('src') ?? ''))
      .toContain('tenant_slug=org-demo');
  });

  it('shows an honest open-ended schedule when a published survey has no closing date', () => {
    const survey = {
      ...initialDraft,
      id: 43,
      estado: 'publicada',
      inicio_at: '2026-08-14T12:00:00.000Z',
      fin_at: null,
      preguntas: initialDraft.preguntas.map((question, questionIndex) => ({
        ...question,
        id: questionIndex + 1,
        opciones: question.opciones?.map((option, optionIndex) => ({
          ...option,
          id: optionIndex + 1,
        })),
      })),
    } as unknown as SurveyAdmin;

    render(<SurveyEditor survey={survey} onSave={vi.fn()} />);

    expect(screen.getByText('Sin fecha de cierre')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
