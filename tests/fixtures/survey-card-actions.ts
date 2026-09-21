import type { SurveyAdmin, SurveyAdminLifecycle } from '@/types/encuestas';

/** Synthetic card data only; never a published survey or a provider operation. */
export function surveyCardFixture(mode: 'draft' | 'live' = 'live'): SurveyAdmin {
  const draft = mode === 'draft';
  const lifecycle: SurveyAdminLifecycle = {
    contract_version: 'surveys.admin_lifecycle.v1', instrument_kind: 'survey',
    phase: draft ? 'draft' : 'collecting', persisted_state: draft ? 'borrador' : 'publicada',
    accepts_responses: !draft,
    schedule: { opens_at: '2026-09-01T09:00:00Z', closes_at: '2026-10-01T09:00:00Z', evaluated_at: '2026-09-21T09:00:00Z' },
    participation: { responses: draft ? 0 : 12, unique_participants: draft ? 0 : 10,
      responses_last_24h: draft ? 0 : 3, last_response_at: null, eligible_population: null,
      participation_rate: null, abstentions: null,
      denominator_status: { available: false, reason_code: 'survey_eligible_population_not_configured' } },
    capabilities: { can_publish: draft, can_close: !draft, can_delete: draft,
      can_share: !draft, can_view_results: true },
    actions: {
      publish: { method: 'POST', endpoint: '/api/v2/surveys/301/publish', enabled: draft,
        disabled_reason_code: draft ? null : 'survey_not_draft' },
      close: { method: 'POST', endpoint: '/api/v2/surveys/301/close', enabled: !draft,
        confirmation_required: true, irreversible: true, disabled_reason_code: draft ? 'survey_not_published' : null },
    },
  };
  return { id: 301, slug: 'consulta-prueba', slug_publico: 'consulta-prueba',
    titulo: 'Consulta de prueba sobre servicios y atención de la organización',
    descripcion: 'Contenido sintético para comprobar la continuidad del panel.',
    tipo: 'opinion', estado: draft ? 'borrador' : 'publicada',
    inicio_at: lifecycle.schedule.opens_at, fin_at: lifecycle.schedule.closes_at,
    politica_unicidad: 'libre', preguntas: [], admin_lifecycle: lifecycle };
}
