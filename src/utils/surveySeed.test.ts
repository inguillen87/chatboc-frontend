import { describe, expect, it } from 'vitest';

import type { SurveyPublic } from '@/types/encuestas';
import { isSurveySubmissionId } from '@/utils/surveySubmissionIdentity';
import { generateSurveySeedPayloads } from './surveySeed';

const survey: SurveyPublic = {
  slug: 'prioridades-barriales',
  titulo: 'Prioridades barriales',
  tipo: 'votacion',
  instrument_revision: 9,
  politica_unicidad: 'por_dni',
  preguntas: [
    {
      id: 11,
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Prioridad',
      obligatoria: true,
      opciones: [
        { id: 101, orden: 1, texto: 'Iluminacion' },
        { id: 102, orden: 2, texto: 'Arbolado' },
      ],
    },
  ],
};

describe('survey seed response identities', () => {
  it('creates one distinct opaque submission id per logical seed response', () => {
    const { payloads } = generateSurveySeedPayloads(survey, { count: 3 });
    const ids = payloads.map((payload) => payload.submission_id);

    expect(payloads).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every(isSurveySubmissionId)).toBe(true);
    expect(payloads.every((payload) => payload.instrument_revision === 9)).toBe(true);
    payloads.forEach((payload) => {
      expect(payload.dni).toBeTruthy();
      expect(payload.submission_id).not.toContain(payload.dni as string);
    });
  });
});
