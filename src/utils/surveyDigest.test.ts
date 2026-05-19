import { describe, expect, it } from 'vitest';

import { buildSurveyDigestMessage } from './surveyDigest';
import type { SurveyPublic } from '@/types/encuestas';

const makeSurvey = (index: number): SurveyPublic => ({
  id: index,
  slug: `encuesta-${index}`,
  titulo: `Encuesta ${index}`,
  descripcion: `Descripcion ${index}`,
  tipo: 'opinion',
  inicio_at: '2026-01-01T00:00:00.000Z',
  fin_at: '2030-01-01T00:00:00.000Z',
  politica_unicidad: 'libre',
  preguntas: [],
});

describe('buildSurveyDigestMessage', () => {
  it('lists active surveys in batches of five by default', () => {
    const result = buildSurveyDigestMessage({
      surveys: Array.from({ length: 7 }, (_, index) => makeSurvey(index + 1)),
      channel: 'whatsapp',
    });

    expect(result.message).toContain('1. *Encuesta');
    expect(result.message).toContain('5. *Encuesta');
    expect(result.message).not.toContain('6. *Encuesta');
    expect(result.message.match(/^\d+\. \*Encuesta/gm) ?? []).toHaveLength(5);
  });

  it('includes direct participation and WhatsApp share links', () => {
    const result = buildSurveyDigestMessage({
      surveys: [makeSurvey(1)],
      channel: 'whatsapp',
    });

    expect(result.message).toContain('/e/encuesta-1');
    expect(result.message).toContain('https://wa.me/?text=');
    expect(result.message).toContain('Compartir directo por WhatsApp');
  });
});
