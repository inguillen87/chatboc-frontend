import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SurveyOperationsOverview } from '@/components/surveys/SurveyOperationsOverview';

describe('SurveyOperationsOverview', () => {
  it('renders only source-backed totals and explains the unavailable denominator', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="colegio-demo"
        instruments={[
          {
            id: 1,
            slug: 'consulta-servicios',
            titulo: 'Consulta de servicios',
            tipo: 'opinion',
            estado: 'publicada',
            inicio_at: '2026-08-01T12:00:00Z',
            fin_at: null,
            politica_unicidad: 'libre',
            preguntas: [],
            governance: { result_certified: false },
          },
        ]}
        freshness={{
          generated_at: '2026-08-02T12:00:00Z',
          source: 'enc_encuesta_and_enc_respuesta',
          synthetic: false,
        }}
        overview={{
          total: 3,
          por_estado: { publicada: 2, borrador: 1 },
          activas: 2,
          con_respuestas: 2,
          total_respuestas: 48,
          respuestas_con_coordenadas: 0,
          respuestas_ultimas_24h: 7,
          accepting_responses: 2,
          por_tipo_instrumento: { survey: 2, voting: 1 },
          participation_denominator: {
            available: false,
            reason_code: 'survey_eligible_population_not_configured',
          },
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Centro ejecutivo de participación' })).toBeTruthy();
    expect(screen.getByText('colegio-demo')).toBeTruthy();
    expect(screen.getByText('2 encuestas · 1 votaciones')).toBeTruthy();
    expect(screen.getByText('48')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cartera por estado' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pulso operativo' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Alcance y certificación' })).toBeTruthy();
    expect(screen.getByText('1 declarados como no certificados.')).toBeTruthy();
    expect(screen.getByText('Encuestas y respuestas persistidas', { exact: false })).toBeTruthy();
    expect(screen.getByText(/abstención no se calculan/i)).toBeTruthy();
  });

  it('does not claim persisted or certified data when the source contracts are absent', () => {
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

    expect(screen.getByText('Procedencia no informada')).toBeTruthy();
    expect(screen.getByText(/contrato de certificación no está disponible/i)).toBeTruthy();
    expect(screen.getByText('Fuente no informada', { exact: false })).toBeTruthy();
  });

  it('keeps a paginated page visibly partial even when the total is not available yet', () => {
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

    expect(screen.getByText('Instrumentos cargados')).toBeTruthy();
    expect(screen.getByText(/todavía quedan páginas pendientes/i)).toBeTruthy();
    expect(screen.getByText('1 encuestas · 0 votaciones · quedan páginas pendientes')).toBeTruthy();
  });

  it('does not confuse jurisdiction exclusions with pending pagination', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="junin"
        loadedCount={1}
        totalCount={2}
        sourceTotalCount={2}
        excludedScopeCount={1}
        confirmedConflictCount={1}
        isPartial={false}
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

    expect(screen.getByText('Instrumentos')).toBeTruthy();
    expect(screen.queryByText('Instrumentos cargados')).toBeNull();
    expect(screen.queryByText(/páginas pendientes/i)).toBeNull();
    expect(screen.getByText(/Se excluyen 1 conflictos confirmados/i)).toBeTruthy();
  });

  it('surfaces the reconciled backend jurisdiction scope and labels unverified records as provisional', () => {
    render(
      <SurveyOperationsOverview
        tenantSlug="junin"
        loadedCount={2}
        excludedScopeCount={1}
        confirmedConflictCount={1}
        unverifiedScopeCount={1}
        sourceTotalCount={3}
        executiveSummary={{
          aggregation_scope: {
            mode: 'returned_page',
            returned_items: 3,
            query_total_items: 3,
            complete_for_query: true,
          },
          jurisdiction: {
            compatible: 1,
            conflict: 1,
            unverified: 1,
          },
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
          por_tipo_instrumento: { survey: 1, voting: 0 },
          participation_denominator: { available: false, reason_code: 'not_configured' },
        }}
      />,
    );

    expect(screen.getByText('Alcance backend validado')).toBeTruthy();
    expect(
      screen.getByRole('status', { name: 'Resumen jurisdiccional de la página recibida' }),
    ).toHaveTextContent('1 conflictos confirmados');
    expect(screen.getByText(/Se excluyen 1 conflictos confirmados/i)).toBeTruthy();
    expect(screen.getByText(/1 instrumentos sin verificar se incluyen de forma provisional/i)).toBeTruthy();
    expect(screen.getByText(/registros sin verificación marcados como provisionales/i)).toBeTruthy();
  });
});
