import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SurveySummary } from '@/types/encuestas';
import { readSurveyWordClouds, SurveyWordClouds } from './SurveyWordClouds';

const summary = (preguntas: unknown[]) => ({ total_respuestas: 12, preguntas }) as unknown as SurveySummary;
const open = (word_cloud: unknown, extra: Record<string, unknown> = {}) => ({
  pregunta_id: 7, texto: '¿Qué mejorarías del barrio?', tipo: 'abierta', total_respuestas: 12, opciones: [], word_cloud, ...extra,
});

describe('survey word clouds', () => {
  it('renders nothing when the server sends no aggregate or withheld it', () => {
    const { container } = render(<SurveyWordClouds summary={summary([open(null), { pregunta_id: 1, texto: 'Otra', opciones: [] }])} />);
    expect(container).toBeEmptyDOMElement();
    expect(readSurveyWordClouds(undefined)).toEqual([]);
  });

  it('shows each term with its count, bigger when more people wrote it', () => {
    render(<SurveyWordClouds summary={summary([open({
      terms: [{ term: 'luminarias', count: 9 }, { term: 'veredas', count: 4 }, { term: 'plaza', count: 3 }],
      responses_considered: 12, min_count: 3, truncated: false,
    })])} />);
    const section = screen.getByRole('region', { name: '¿Qué mejorarías del barrio?' });
    const items = within(section).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['luminarias9 respuestas', 'veredas4 respuestas', 'plaza3 respuestas']);
    expect(parseFloat(items[0].style.fontSize)).toBeGreaterThan(parseFloat(items[1].style.fontSize));
    expect(parseFloat(items[1].style.fontSize)).toBeGreaterThan(parseFloat(items[2].style.fontSize));
    expect(within(section).getByText('12 respuestas escritas')).toBeInTheDocument();
    expect(within(section).getByText(/aparecen en 3 respuestas o más\.$/)).toBeInTheDocument();
  });

  it('never shows a term below the server threshold and says when nothing repeats yet', () => {
    const clouds = readSurveyWordClouds(summary([open({
      terms: [{ term: 'unica', count: 1 }, { term: 'x'.repeat(41), count: 9 }, { term: 'transporte', count: 5 }],
      responses_considered: 8, min_count: 5, truncated: true,
    })]));
    expect(clouds[0].terms).toEqual([{ term: 'transporte', count: 5 }]);

    render(<SurveyWordClouds summary={summary([open({ terms: [], responses_considered: 2, min_count: 3, truncated: true })])} />);
    expect(screen.getByText('Todavía no hay palabras que se repitan en al menos 3 respuestas.')).toBeInTheDocument();
    expect(screen.getByText(/Se usaron las respuestas más recientes\./)).toBeInTheDocument();
  });
});
