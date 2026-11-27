import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SurveyOperationsOverview } from '@/components/surveys/SurveyOperationsOverview';

describe('SurveyOperationsOverview', () => {
  it('shows only the four source-backed summary values in an accessible region', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="colegio-demo"
        overview={{
          total: 3,
          por_estado: { publicada: 2, borrador: 1 },
          activas: 91,
          con_respuestas: 92,
          total_respuestas: 48,
          respuestas_con_coordenadas: 7,
          respuestas_ultimas_24h: 93,
          accepting_responses: 2,
          por_tipo_instrumento: { survey: 2, voting: 1 },
          participation_denominator: {
            available: false,
            reason_code: 'survey_eligible_population_not_configured',
          },
        }}
      />,
    );

    const summary = screen.getByRole('region', { name: 'Resumen' });

    expect(within(summary).getByRole('heading', { level: 2, name: 'Resumen' })).toBeTruthy();
    expect(Array.from(summary.querySelectorAll('dt'), (term) => term.textContent)).toEqual([
      'Encuestas y votaciones',
      'Abiertas ahora',
      'Respuestas recibidas',
      'Respuestas con ubicación',
    ]);
    expect(Array.from(summary.querySelectorAll('dd'), (value) => value.textContent)).toEqual([
      '3',
      '2',
      '48',
      '7',
    ]);

    expect(screen.queryByText(/91|92|93/)).toBeNull();
    expect(
      screen.queryByText(
        /centro ejecutivo|instrumento|persistid|backend|contrato|alcance operativo|compatibles|conflictos separados|evidencia|cartera|pulso/i,
      ),
    ).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Cartera por estado' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pulso operativo' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Alcance y certificación' })).toBeNull();
  });

  it('shows confirmed zeroes without adding source or certification claims', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="junin"
        overview={{
          total: 0,
          por_estado: {},
          activas: 0,
          con_respuestas: 0,
          total_respuestas: 0,
          respuestas_con_coordenadas: 0,
          respuestas_ultimas_24h: 0,
          accepting_responses: 0,
          por_tipo_instrumento: {},
          participation_denominator: { available: false, reason_code: 'not_configured' },
        }}
      />,
    );

    const summary = screen.getByRole('region', { name: 'Resumen' });
    expect(Array.from(summary.querySelectorAll('dd'), (value) => value.textContent)).toEqual(['0', '0', '0', '0']);
    expect(summary).not.toHaveTextContent(/procedencia|certificaci.n|fuente/i);
  });

  it('keeps the same clear labels while more pages are pending', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="junin"
        loadedCount={1}
        totalCount={null}
        isPartial
        overview={{
          total: 1,
          por_estado: { publicada: 1 },
          activas: 1,
          con_respuestas: 0,
          total_respuestas: 0,
          respuestas_con_coordenadas: 0,
          respuestas_ultimas_24h: 0,
          accepting_responses: 1,
          por_tipo_instrumento: { survey: 1, voting: 0 },
          participation_denominator: { available: false, reason_code: 'not_configured' },
        }}
      />,
    );

    const summary = screen.getByRole('region', { name: 'Resumen' });
    expect(within(summary).getByText('Encuestas y votaciones')).toBeTruthy();
    expect(Array.from(summary.querySelectorAll('dd'), (value) => value.textContent)).toEqual(['1', '1', '0', '0']);
    expect(summary).not.toHaveTextContent(/p.ginas pendientes|cargados/i);
  });

  it('does not turn separated organization records into a fifth summary block', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="junin"
        loadedCount={1}
        totalCount={2}
        sourceTotalCount={2}
        excludedScopeCount={1}
        confirmedConflictCount={1}
        overview={{
          total: 1,
          por_estado: { publicada: 1 },
          activas: 1,
          con_respuestas: 0,
          total_respuestas: 0,
          respuestas_con_coordenadas: 0,
          respuestas_ultimas_24h: 0,
          accepting_responses: 1,
          por_tipo_instrumento: { survey: 1, voting: 0 },
          participation_denominator: { available: false, reason_code: 'not_configured' },
        }}
      />,
    );

    const summary = screen.getByRole('region', { name: 'Resumen' });
    expect(summary.querySelectorAll('dt')).toHaveLength(4);
    expect(summary).not.toHaveTextContent(/conflicto|se excluyen|alcance/i);
  });

  it('does not expose internal verification metadata in the executive summary', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="junin"
        executiveSummary={{
          aggregation_scope: { mode: 'returned_page', returned_items: 3, query_total_items: 3, complete_for_query: true },
          jurisdiction: { compatible: 1, conflict: 1, unverified: 1 },
        } as never}
        dataQuality={{ contract_version: 'surveys.admin_data_quality.v1' } as never}
        overview={{
          total: 2,
          por_estado: { publicada: 1, borrador: 1 },
          activas: 1,
          con_respuestas: 1,
          total_respuestas: 10,
          respuestas_con_coordenadas: 5,
          respuestas_ultimas_24h: 2,
          accepting_responses: 1,
          por_tipo_instrumento: { survey: 1, voting: 1 },
          participation_denominator: { available: false, reason_code: 'not_configured' },
        }}
      />,
    );

    const summary = screen.getByRole('region', { name: 'Resumen' });
    expect(Array.from(summary.querySelectorAll('dd'), (value) => value.textContent)).toEqual(['2', '1', '10', '5']);
    expect(summary).not.toHaveTextContent(/backend|compatible|verificaci.n|contrato/i);
  });
});
