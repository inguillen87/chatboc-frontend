import { describe, expect, it } from 'vitest';

import type { SurveyDraftPayload } from '@/types/encuestas';
import { withExpectedSurveyStructureRevision } from './surveyStructureGuard';

const draft: SurveyDraftPayload = {
  titulo: 'Prioridades 2026',
  tipo: 'votacion',
  politica_unicidad: 'libre',
  anonimato: true,
  requiere_datos_contacto: false,
  preguntas: [],
};

describe('withExpectedSurveyStructureRevision', () => {
  it('attaches the revision read by the editor', () => {
    expect(
      withExpectedSurveyStructureRevision(draft, {
        structure_guard: { revision: 4, locked: false },
      }),
    ).toEqual({ ...draft, expected_structure_revision: 4 });
  });

  it('never overwrites an explicit revision', () => {
    const explicit = { ...draft, expected_structure_revision: 3 };
    expect(
      withExpectedSurveyStructureRevision(explicit, {
        structure_guard: { revision: 4, locked: false },
      }),
    ).toBe(explicit);
  });

  it('keeps legacy admin payloads unchanged when the server has no guard contract', () => {
    expect(withExpectedSurveyStructureRevision(draft)).toBe(draft);
  });
});
