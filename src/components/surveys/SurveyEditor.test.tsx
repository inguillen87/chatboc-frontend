import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyEditor } from './SurveyEditor';
import type { SurveyDraftPayload } from '@/types/encuestas';

vi.mock('framer-motion', () => ({
  Reorder: {
    Group: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Item: ({ children }: PropsWithChildren) => <div>{children}</div>,
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
});
