import { describe, expect, it } from 'vitest';

import {
  ALL_SURVEY_TEMPLATES,
  buildDraftFromTemplate,
  type SurveyTemplateDefinition,
} from './templates';

describe('survey template catalog', () => {
  it('offers a reusable live Sí / No voting preset', () => {
    const template = ALL_SURVEY_TEMPLATES.find((item) => item.slug === 'votacion-si-no');

    expect(template).toBeDefined();
    expect(template).toMatchObject({
      titulo: 'Votación Sí / No',
      tipo: 'votacion',
      es_votacion_envivo: true,
      mostrar_resultados_envivo: true,
    });

    const draft = buildDraftFromTemplate(template!, {
      municipality: 'Organización demo',
      startDate: new Date('2026-08-14T12:00:00.000Z'),
      endDate: new Date('2026-08-21T12:00:00.000Z'),
    });

    expect(draft.slug).toBe('votacion-si-no-organizacion-demo');
    expect(draft.preguntas).toEqual([
      expect.objectContaining({
        tipo: 'opcion_unica',
        obligatoria: true,
        opciones: [
          expect.objectContaining({ texto: 'Sí', valor: 'si' }),
          expect.objectContaining({ texto: 'No', valor: 'no' }),
        ],
      }),
    ]);
  });

  it('preserves explicit demographic references when materializing a template', () => {
    const template: SurveyTemplateDefinition = {
      slug: 'prioridades-por-ciudad',
      titulo: 'Prioridades por ciudad',
      tipo: 'opinion',
      politica_unicidad: 'por_cookie',
      preguntas: [{
        orden: 1,
        question_ref: 'demographic:city',
        logical_ref: 'demographic:city',
        tipo: 'opcion_unica',
        texto: 'Seleccioná tu ciudad',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Ushuaia', valor: 'ushuaia' },
          { orden: 2, texto: 'Río Grande', valor: 'rio-grande' },
        ],
      }],
    };

    const draft = buildDraftFromTemplate(template, {
      startDate: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(draft.preguntas[0]).toMatchObject({
      question_ref: 'demographic:city',
      logical_ref: 'demographic:city',
    });
  });
});
