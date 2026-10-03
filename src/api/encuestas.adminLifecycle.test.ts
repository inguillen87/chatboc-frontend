import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));

import { adminCloseSurvey, adminListSurveys } from '@/api/encuestas';

const aggregationScope = () => ({
  mode: 'returned_page',
  returned_items: 1,
  query_total_items: 1,
  complete_for_query: true,
});

const jurisdictionAggregate = () => ({
  contract_version: 'surveys.admin_jurisdiction_aggregate.v1',
  aggregation_scope: aggregationScope(),
  compatible: 1,
  conflict: 0,
  unverified: 0,
  separation_required: 0,
  review_required: 0,
  authoritative_source: 'server_owned_persisted_refs',
  title_inference_used: false,
  content_review_included: false,
});

const aggregatePolicy = () => ({
  contract_version: 'surveys.admin_aggregate_policy.v1',
  general_scope: {
    included_jurisdiction_statuses: ['compatible', 'conflict', 'unverified'],
    conflict_instruments_included: 0,
  },
  operational_scope: {
    included_jurisdiction_statuses: ['compatible', 'unverified'],
    excluded_jurisdiction_statuses: ['conflict'],
    unverified_is_compatible: false,
  },
});

const geolocationCoverage = () => ({
  available: true,
  numerator: 2,
  denominator: 8,
  percentage: 25,
  reason_code: null,
});

const operationalScope = () => ({
  contract_version: 'surveys.admin_operational_scope.v1',
  aggregation_scope: aggregationScope(),
  selection: aggregatePolicy().operational_scope,
  instruments: {
    included: 1,
    excluded_conflict: 0,
    active: 1,
    accepting_responses: 1,
    with_responses: 1,
    surveys: 1,
    votings: 0,
    governed: 0,
  },
  participation: {
    real_responses: 8,
    responses_last_24h: 3,
    eligible_population: null,
    participation_rate: null,
  },
  territorial: {
    responses_with_coordinates: 2,
    geolocation_coverage: geolocationCoverage(),
  },
});

const responseProvenance = () => ({
  contract_version: 'surveys.response_provenance.v1',
  mode: 'real',
  server_trusted_classification: true,
  contains_synthetic: false,
  real_responses_included: 8,
  synthetic_responses_included: 0,
  synthetic_responses_excluded: 0,
  synthetic_marker_contract: 'surveys.demo_seeding.v1',
});

const executiveSummary = () => ({
  contract_version: 'surveys.admin_executive_overview.v1',
  aggregation_scope: aggregationScope(),
  instruments: {
    returned: 1,
    active: 1,
    accepting_responses: 1,
    with_responses: 1,
    surveys: 1,
    votings: 0,
    governed: 0,
  },
  jurisdiction: jurisdictionAggregate(),
  aggregate_policy: aggregatePolicy(),
  operational_scope: operationalScope(),
  participation: {
    real_responses: 8,
    responses_last_24h: 3,
    eligible_population: null,
    participation_rate: null,
  },
  territorial: {
    responses_with_coordinates: 2,
    geolocation_coverage: geolocationCoverage(),
  },
  assurance: {
    regulated_election_certified: false,
    result_certified: false,
    external_verification: 'not_performed',
  },
  limitations: [{
    reason_code: 'survey_eligible_population_not_configured',
    impact: 'participation_rate_and_abstentions_unavailable',
  }],
});

const lifecycleEnvelope = () => ({
  contract_version: 'surveys.admin_list.v2',
  tenant: { id: 12, slug: 'org-demo' },
  freshness: {
    generated_at: '2026-08-02T12:00:00Z',
    source: 'enc_encuesta_and_enc_respuesta',
    synthetic: false,
  },
  data_provenance: responseProvenance(),
  executive_summary: executiveSummary(),
  data_quality: {
    contract_version: 'surveys.admin_data_quality.v1',
    aggregation_scope: aggregationScope(),
    geolocation_coverage: geolocationCoverage(),
    jurisdiction: jurisdictionAggregate(),
    response_provenance: responseProvenance(),
    limitations: executiveSummary().limitations,
  },
  encuestas: [
    {
      id: 41,
      tenant_id: 12,
      slug: 'consulta-demo',
      titulo: 'Consulta demo',
      tipo: 'opinion',
      estado: 'publicada',
      inicio_at: '2026-08-01T12:00:00Z',
      fin_at: '2026-08-20T12:00:00Z',
      politica_unicidad: 'libre',
      preguntas: [],
      esta_activa: true,
      jurisdiction: {
        contract_version: 'surveys.jurisdiction_guard.v1',
        readiness_included: false,
        jurisdiction_ref: 'ar:ba:junin',
        scope_status: 'compatible',
        scope_reason_code: 'survey_jurisdiction_compatible',
        tenant_verified_ref: 'ar:ba:junin',
        content_review_included: false,
      },
      admin_scope: {
        contract_version: 'surveys.admin_scope.v1',
        jurisdiction: {
          contract_version: 'surveys.admin_jurisdiction_scope.v1',
          status: 'compatible',
          compatible: true,
          reason_code: 'survey_jurisdiction_compatible',
          action_hint: null,
          tenant_verified_ref: 'ar:ba:junin',
          survey_ref: 'ar:ba:junin',
          authoritative_source: 'server_owned_persisted_refs',
          content_review_included: false,
        },
        separation: { required: false, reason_code: null },
      },
      metricas: {
        total_respuestas: 8,
        respuestas_ultimas_24h: 3,
        respuestas_con_coordenadas: 2,
        participantes_unicos: 7,
        ultima_respuesta_at: '2026-08-02T11:30:00Z',
      },
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: 'survey',
        phase: 'collecting',
        persisted_state: 'publicada',
        accepts_responses: true,
        operational_block: null,
        jurisdiction: {
          status: 'compatible',
          reason_code: 'survey_jurisdiction_compatible',
          content_review_included: false,
        },
        schedule: {
          opens_at: '2026-08-01T12:00:00Z',
          closes_at: '2026-08-20T12:00:00Z',
          evaluated_at: '2026-08-02T12:00:00Z',
        },
        participation: {
          responses: 8,
          unique_participants: 7,
          responses_last_24h: 3,
          last_response_at: '2026-08-02T11:30:00Z',
          eligible_population: null,
          participation_rate: null,
          abstentions: null,
          denominator_status: {
            available: false,
            reason_code: 'survey_eligible_population_not_configured',
          },
        },
        capabilities: {
          can_publish: false,
          can_close: true,
          can_delete: false,
          can_share: true,
          can_view_results: true,
        },
        actions: {
          publish: {
            method: 'POST',
            endpoint: '/api/v2/surveys/41/publish',
            enabled: false,
            disabled_reason_code: 'survey_not_draft',
          },
          close: {
            method: 'POST',
            endpoint: '/api/v2/surveys/41/close',
            enabled: true,
            disabled_reason_code: null,
            confirmation_required: true,
            irreversible: true,
            required_capabilities: ['survey.close'],
          },
        },
      },
    },
  ],
  resumen: {
    total: 1,
    por_estado: { publicada: 1 },
    activas: 1,
    con_respuestas: 1,
    total_respuestas: 8,
    respuestas_con_coordenadas: 2,
    respuestas_ultimas_24h: 3,
    accepting_responses: 1,
    por_tipo_instrumento: { survey: 1, voting: 0 },
    participation_denominator: {
      available: false,
      reason_code: 'survey_eligible_population_not_configured',
    },
    jurisdiccion: jurisdictionAggregate(),
    politica_agregacion: aggregatePolicy(),
    alcance_operativo: operationalScope(),
  },
  pagination: {
    contract_version: 'surveys.pagination.v1',
    limit: 50,
    page: 1 as number | null,
    cursor: null as string | null,
    next_cursor: null as string | null,
    next_page: null as number | null,
    has_more: false,
    returned: 1,
    total_items: 1,
    ordering: 'id_desc',
  },
  seed_demo: { defaults: {}, profiles: [] },
});

const cloneEnvelope = () => structuredClone(lifecycleEnvelope());

const publicAccess = (allowed: boolean) => ({
  contract_version: 'surveys.public_access.v1',
  allowed,
  reason_code: allowed ? null : 'survey_tenant_jurisdiction_unverified',
  next_action: allowed ? null : 'configure_verified_tenant_jurisdiction',
});

const blockedParticipationEnvelope = () => {
  const payload = cloneEnvelope();
  Object.assign(payload.encuestas[0], { public_access: publicAccess(false), esta_activa: false });
  payload.encuestas[0].admin_lifecycle.accepts_responses = false;
  payload.encuestas[0].admin_lifecycle.capabilities.can_share = false;
  Object.assign(payload.resumen, { activas: 0, accepting_responses: 0 });
  for (const instruments of [payload.executive_summary.instruments,
    payload.resumen.alcance_operativo.instruments, payload.executive_summary.operational_scope.instruments]) {
    Object.assign(instruments, { active: 0, accepting_responses: 0 });
  }
  return payload;
};

// Safe structural projection of the native e4aa/594 failure: no titles,
// credentials, contacts or raw response body are needed for this regression.
const blockedJuninLegacyEnvelope = () => {
  const payload = blockedParticipationEnvelope();
  const observedRows = [
    { id: 635, state: 'publicada', phase: 'collecting', kind: 'survey', responses: 0 },
    { id: 634, state: 'publicada', phase: 'live_voting', kind: 'voting', responses: 0 },
    { id: 633, state: 'publicada', phase: 'collecting', kind: 'survey', responses: 0 },
    { id: 632, state: 'borrador', phase: 'draft', kind: 'voting', responses: 0 },
    { id: 631, state: 'cerrada', phase: 'closed', kind: 'voting', responses: 1 },
  ];
  payload.tenant = { id: 22, slug: 'junin' };
  payload.encuestas = observedRows.map((row) => {
    const item = structuredClone(payload.encuestas[0]);
    Object.assign(item, { id: row.id, tenant_id: 22, estado: row.state, slug: `legacy-${row.id}` });
    Object.assign(item.jurisdiction, {
      jurisdiction_ref: null, scope_status: 'unverified',
      scope_reason_code: 'survey_tenant_jurisdiction_unverified', tenant_verified_ref: null,
    });
    Object.assign(item.admin_scope.jurisdiction, {
      status: 'unverified', compatible: null, reason_code: 'survey_tenant_jurisdiction_unverified',
      action_hint: 'configure_verified_tenant_jurisdiction', tenant_verified_ref: null, survey_ref: null,
    });
    Object.assign(item.admin_lifecycle, {
      persisted_state: row.state, phase: row.phase, instrument_kind: row.kind,
      jurisdiction: { status: 'unverified', reason_code: 'survey_tenant_jurisdiction_unverified', content_review_included: false },
      government_survey_evidence_gate: { required: true, ready: false,
        contract_version: 'surveys.government_evidence_gate.v1',
        reason_code: 'survey_tenant_jurisdiction_unverified', next_action: 'configure_verified_tenant_jurisdiction' },
    });
    Object.assign(item.admin_lifecycle.capabilities, {
      can_close: row.state === 'publicada', can_delete: row.state === 'borrador',
      can_view_results: row.responses > 0,
    });
    Object.assign(item.admin_lifecycle.actions.publish, {
      endpoint: `/api/v2/surveys/${row.id}/publish`,
      disabled_reason_code: 'survey_tenant_jurisdiction_unverified',
    });
    Object.assign(item.admin_lifecycle.actions.close, {
      endpoint: `/api/v2/surveys/${row.id}/close`, enabled: row.state === 'publicada',
      disabled_reason_code: row.state === 'publicada' ? null : 'survey_not_published',
    });
    Object.assign(item.metricas, {
      total_respuestas: row.responses, participantes_unicos: row.responses,
      respuestas_ultimas_24h: 0, respuestas_con_coordenadas: 0, ultima_respuesta_at: null,
    });
    Object.assign(item.admin_lifecycle.participation, {
      responses: row.responses, unique_participants: row.responses, responses_last_24h: 0,
      last_response_at: null,
    });
    return item;
  });
  Object.assign(payload.pagination, { returned: 5, total_items: 5 });
  const scope = { ...aggregationScope(), returned_items: 5, query_total_items: 5 };
  const jurisdiction = { ...jurisdictionAggregate(), aggregation_scope: scope,
    compatible: 0, unverified: 5, review_required: 5 };
  const coverage = { ...geolocationCoverage(), numerator: 0, denominator: 1, percentage: 0 };
  Object.assign(payload.resumen, {
    total: 5, por_estado: { publicada: 3, borrador: 1, cerrada: 1 }, con_respuestas: 1,
    total_respuestas: 1, respuestas_con_coordenadas: 0, respuestas_ultimas_24h: 0,
    por_tipo_instrumento: { survey: 2, voting: 3 }, jurisdiccion: jurisdiction,
    synthetic_responses_excluded: 400, unverified_responses_excluded: 100,
  });
  Object.assign(payload.executive_summary, { aggregation_scope: scope, jurisdiction });
  Object.assign(payload.executive_summary.instruments, { returned: 5, surveys: 2, votings: 3 });
  for (const operational of [payload.resumen.alcance_operativo, payload.executive_summary.operational_scope]) {
    operational.aggregation_scope = scope;
    Object.assign(operational.instruments, { included: 5, surveys: 2, votings: 3 });
    Object.assign(operational.participation, { real_responses: 1, responses_last_24h: 0 });
    Object.assign(operational.territorial, { responses_with_coordinates: 0, geolocation_coverage: coverage });
  }
  Object.assign(payload.executive_summary.participation, { real_responses: 1, responses_last_24h: 0 });
  Object.assign(payload.executive_summary.territorial, { responses_with_coordinates: 0, geolocation_coverage: coverage });
  Object.assign(payload.data_quality, { aggregation_scope: scope, jurisdiction, geolocation_coverage: coverage });
  for (const provenance of [payload.data_provenance, payload.data_quality.response_provenance]) {
    Object.assign(provenance, { real_responses_included: 1, synthetic_responses_excluded: 400,
      unverified_responses_excluded: 100 });
  }
  return payload;
};

describe('admin survey lifecycle contract', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('requires an explicit tenant before issuing the list request', async () => {
    await expect(adminListSurveys()).rejects.toThrow('survey_admin_tenant_required');
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('accepts a reconciled tenant-scoped v2 envelope', async () => {
    apiFetchMock.mockResolvedValueOnce(lifecycleEnvelope());

    const result = await adminListSurveys(undefined, { tenantSlug: 'org-demo' });

    expect(result.contract_version).toBe('surveys.admin_list.v2');
    expect(result.tenant?.slug).toBe('org-demo');
    expect(result.overview?.total_respuestas).toBe(8);
    expect(result.executive_summary?.jurisdiction.compatible).toBe(1);
    expect(result.data_quality?.geolocation_coverage.percentage).toBe(25);
    expect(result.pagination).toMatchObject({ returned: 1, total_items: 1, has_more: false });
    expect(result.data[0].admin_lifecycle?.capabilities.can_close).toBe(true);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/admin/encuestas',
      expect.objectContaining({ tenantSlug: 'org-demo' }),
    );
  });

  it('accepts explicit public access without changing the active lifecycle', async () => {
    const payload = cloneEnvelope();
    Object.assign(payload.encuestas[0], { public_access: publicAccess(true) });
    apiFetchMock.mockResolvedValueOnce(payload);

    const result = await adminListSurveys(undefined, { tenantSlug: 'org-demo' });

    expect(result.data[0].admin_lifecycle?.accepts_responses).toBe(true);
    expect(result.data[0].public_access?.allowed).toBe(true);
  });

  it.each(['collecting', 'live_voting'])('accepts %s when the public guard blocks participation', async (phase) => {
    const payload = blockedParticipationEnvelope();
    payload.encuestas[0].admin_lifecycle.phase = phase;
    if (phase === 'live_voting') {
      payload.encuestas[0].tipo = 'votacion';
      payload.encuestas[0].admin_lifecycle.instrument_kind = 'voting';
      Object.assign(payload.resumen.por_tipo_instrumento, { survey: 0, voting: 1 });
      for (const instruments of [payload.executive_summary.instruments,
        payload.resumen.alcance_operativo.instruments, payload.executive_summary.operational_scope.instruments]) {
        Object.assign(instruments, { surveys: 0, votings: 1 });
      }
    }
    apiFetchMock.mockResolvedValueOnce(payload);

    const result = await adminListSurveys(undefined, { tenantSlug: 'org-demo' });

    expect(result.overview?.activas).toBe(0);
    expect(result.overview?.accepting_responses).toBe(0);
    expect(result.data[0].admin_lifecycle?.capabilities.can_share).toBe(false);
  });

  it('accepts the five nested legacy Junin rows with three published and zero receiving', async () => {
    apiFetchMock.mockResolvedValueOnce(blockedJuninLegacyEnvelope());

    const result = await adminListSurveys(undefined, { tenantSlug: 'junin' });

    expect(result.data.map((item) => item.id)).toEqual([635, 634, 633, 632, 631]);
    expect(result.overview).toMatchObject({ activas: 0, accepting_responses: 0,
      por_estado: { publicada: 3, borrador: 1, cerrada: 1 }, total_respuestas: 1 });
    expect(result.executive_summary?.instruments).toMatchObject({ active: 0, accepting_responses: 0 });
    expect(result.data.every((item) => item.public_access?.allowed === false &&
      item.admin_lifecycle?.accepts_responses === false && item.admin_lifecycle.capabilities.can_share === false)).toBe(true);
    expect(result.data[4].admin_lifecycle).toMatchObject({ phase: 'closed',
      capabilities: { can_view_results: true }, participation: { responses: 1 } });
  });

  it.each([
    ['null', null],
    ['unknown version', { ...publicAccess(true), contract_version: 'surveys.public_access.v999' }],
    ['nonboolean allowed', { ...publicAccess(true), allowed: 'false' }],
    ['missing allowed', { contract_version: 'surveys.public_access.v1', reason_code: null, next_action: null }],
    ['invalid reason', { ...publicAccess(true), reason_code: 1 }],
    ['missing reason', { contract_version: 'surveys.public_access.v1', allowed: true, next_action: null }],
    ['invalid action', { ...publicAccess(true), next_action: [] }],
    ['missing action', { contract_version: 'surveys.public_access.v1', allowed: true, reason_code: null }],
  ])('rejects a malformed public access contract: %s', async (_label, access) => {
    const payload = cloneEnvelope();
    Object.assign(payload.encuestas[0], { public_access: access });
    apiFetchMock.mockResolvedValueOnce(payload);

    await expect(adminListSurveys(undefined, { tenantSlug: 'org-demo' })).rejects.toThrow('survey_admin_list_contract_invalid');
  });

  it.each(['accepts_responses', 'can_share'])('rejects %s enabled despite a public access veto', async (capability) => {
    const payload = blockedParticipationEnvelope();
    if (capability === 'accepts_responses') payload.encuestas[0].admin_lifecycle.accepts_responses = true;
    else payload.encuestas[0].admin_lifecycle.capabilities.can_share = true;
    apiFetchMock.mockResolvedValueOnce(payload);

    await expect(adminListSurveys(undefined, { tenantSlug: 'org-demo' })).rejects.toThrow('survey_admin_list_contract_invalid');
  });

  it('rejects a blocked active lifecycle when public access explicitly allows participation', async () => {
    const payload = blockedParticipationEnvelope();
    Object.assign(payload.encuestas[0], { public_access: publicAccess(true) });
    apiFetchMock.mockResolvedValueOnce(payload);

    await expect(adminListSurveys(undefined, { tenantSlug: 'org-demo' })).rejects.toThrow('survey_admin_list_contract_invalid');
  });

  it('accepts a collecting conflict only when responses are blocked by the exact operational contract', async () => {
    const payload = cloneEnvelope();
    const item = payload.encuestas[0];
    Object.assign(item.jurisdiction, {
      jurisdiction_ref: 'ar:tf:ushuaia',
      scope_status: 'conflict',
      scope_reason_code: 'survey_jurisdiction_binding_conflict',
    });
    Object.assign(item.admin_scope.jurisdiction, {
      status: 'conflict',
      compatible: false,
      reason_code: 'survey_jurisdiction_binding_conflict',
      action_hint: 'duplicate_and_review_for_verified_jurisdiction',
      survey_ref: 'ar:tf:ushuaia',
    });
    Object.assign(item.admin_scope.separation, {
      required: true,
      reason_code: 'survey_jurisdiction_binding_conflict',
    });
    Object.assign(item.admin_lifecycle, {
      accepts_responses: false,
      operational_block: {
        reason_code: 'survey_jurisdiction_binding_conflict',
        action_hint: 'separate_and_review_foreign_jurisdiction_instrument',
      },
      jurisdiction: {
        status: 'conflict',
        reason_code: 'survey_jurisdiction_binding_conflict',
        content_review_included: false,
      },
    });
    item.admin_lifecycle.capabilities.can_share = false;
    item.admin_lifecycle.actions.publish.disabled_reason_code = 'survey_jurisdiction_binding_conflict';
    payload.resumen.accepting_responses = 0;
    payload.executive_summary.instruments.accepting_responses = 0;

    const conflictAggregate = {
      ...jurisdictionAggregate(),
      compatible: 0,
      conflict: 1,
      unverified: 0,
      separation_required: 1,
      review_required: 1,
    };
    payload.executive_summary.jurisdiction = structuredClone(conflictAggregate);
    payload.data_quality.jurisdiction = structuredClone(conflictAggregate);
    payload.resumen.jurisdiccion = structuredClone(conflictAggregate);
    payload.executive_summary.aggregate_policy.general_scope.conflict_instruments_included = 1;
    payload.resumen.politica_agregacion.general_scope.conflict_instruments_included = 1;

    const emptyOperational = {
      ...operationalScope(),
      instruments: {
        included: 0,
        excluded_conflict: 1,
        active: 0,
        accepting_responses: 0,
        with_responses: 0,
        surveys: 0,
        votings: 0,
        governed: 0,
      },
      participation: {
        real_responses: 0,
        responses_last_24h: 0,
        eligible_population: null,
        participation_rate: null,
      },
      territorial: {
        responses_with_coordinates: 0,
        geolocation_coverage: {
          available: false,
          numerator: 0,
          denominator: null,
          percentage: null,
          reason_code: 'survey_response_denominator_empty',
        },
      },
    };
    Object.assign(payload.executive_summary, { operational_scope: structuredClone(emptyOperational) });
    Object.assign(payload.resumen, { alcance_operativo: structuredClone(emptyOperational) });
    apiFetchMock.mockResolvedValueOnce(payload);

    const result = await adminListSurveys(undefined, { tenantSlug: 'org-demo' });

    expect(result.data[0].admin_lifecycle).toMatchObject({
      phase: 'collecting',
      accepts_responses: false,
      operational_block: {
        reason_code: 'survey_jurisdiction_binding_conflict',
        action_hint: 'separate_and_review_foreign_jurisdiction_instrument',
      },
    });
    expect(result.executive_summary?.operational_scope.instruments).toMatchObject({
      included: 0,
      excluded_conflict: 1,
    });
  });

  it('accepts the backend Python rounding rule for territorial coverage', async () => {
    const payload = cloneEnvelope();
    payload.encuestas[0].metricas.total_respuestas = 32;
    payload.encuestas[0].metricas.respuestas_con_coordenadas = 1;
    payload.encuestas[0].admin_lifecycle.participation.responses = 32;
    payload.resumen.total_respuestas = 32;
    payload.resumen.respuestas_con_coordenadas = 1;
    payload.resumen.alcance_operativo.participation.real_responses = 32;
    payload.resumen.alcance_operativo.territorial.responses_with_coordinates = 1;
    payload.resumen.alcance_operativo.territorial.geolocation_coverage = {
      available: true,
      numerator: 1,
      denominator: 32,
      percentage: 3.12,
      reason_code: null,
    };
    payload.executive_summary.participation.real_responses = 32;
    payload.executive_summary.territorial.responses_with_coordinates = 1;
    payload.executive_summary.territorial.geolocation_coverage = {
      available: true,
      numerator: 1,
      denominator: 32,
      percentage: 3.12,
      reason_code: null,
    };
    payload.executive_summary.operational_scope.participation.real_responses = 32;
    payload.executive_summary.operational_scope.territorial.responses_with_coordinates = 1;
    payload.executive_summary.operational_scope.territorial.geolocation_coverage = {
      available: true,
      numerator: 1,
      denominator: 32,
      percentage: 3.12,
      reason_code: null,
    };
    payload.data_quality.geolocation_coverage = {
      available: true,
      numerator: 1,
      denominator: 32,
      percentage: 3.12,
      reason_code: null,
    };
    payload.data_provenance.real_responses_included = 32;
    payload.data_quality.response_provenance.real_responses_included = 32;
    apiFetchMock.mockResolvedValueOnce(payload);

    const result = await adminListSurveys(undefined, { tenantSlug: 'org-demo' });

    expect(result.executive_summary?.territorial.geolocation_coverage.percentage).toBe(3.12);
  });

  it('forwards the opaque cursor and bounded limit to the tenant-scoped endpoint', async () => {
    const payload = cloneEnvelope();
    payload.pagination.page = null;
    payload.pagination.cursor = 'cursor_opaque-41';
    payload.executive_summary.aggregation_scope.complete_for_query = false;
    payload.executive_summary.jurisdiction.aggregation_scope.complete_for_query = false;
    payload.executive_summary.operational_scope.aggregation_scope.complete_for_query = false;
    payload.data_quality.aggregation_scope.complete_for_query = false;
    payload.data_quality.jurisdiction.aggregation_scope.complete_for_query = false;
    payload.resumen.jurisdiccion.aggregation_scope.complete_for_query = false;
    payload.resumen.alcance_operativo.aggregation_scope.complete_for_query = false;
    apiFetchMock.mockResolvedValueOnce(payload);

    await adminListSurveys(
      { limit: 50, cursor: 'cursor_opaque-41' },
      { tenantSlug: 'org-demo' },
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/admin/encuestas?limit=50&cursor=cursor_opaque-41',
      expect.objectContaining({ tenantSlug: 'org-demo' }),
    );
  });

  it('rejects a response scoped to a different tenant', async () => {
    apiFetchMock.mockResolvedValueOnce(lifecycleEnvelope());

    await expect(adminListSurveys(undefined, { tenantSlug: 'otra-org' })).rejects.toThrow(
      'survey_admin_tenant_mismatch',
    );
  });

  it('does not reinterpret unknown contract versions as legacy arrays', async () => {
    const payload = cloneEnvelope();
    payload.contract_version = 'surveys.admin_list.v999';
    apiFetchMock.mockResolvedValueOnce(payload);

    await expect(adminListSurveys(undefined, { tenantSlug: 'org-demo' })).rejects.toThrow(
      'survey_admin_list_contract_unsupported',
    );
  });

  it.each([
    ['fractional response count', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.encuestas[0].metricas.total_respuestas = 8.5;
      payload.encuestas[0].admin_lifecycle.participation.responses = 8.5;
      payload.resumen.total_respuestas = 8.5;
    }],
    ['unknown phase', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.encuestas[0].admin_lifecycle.phase = 'invented';
    }],
    ['fabricated abstention', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.encuestas[0].admin_lifecycle.participation.abstentions = 2;
    }],
    ['mismatched action capability', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.encuestas[0].admin_lifecycle.actions.close.enabled = false;
    }],
    ['unsafe action endpoint', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.encuestas[0].admin_lifecycle.actions.close.endpoint = '/api/v2/surveys/99/close';
    }],
    ['missing irreversible confirmation', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.encuestas[0].admin_lifecycle.actions.close.irreversible = false;
    }],
    ['unreconciled overview', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.resumen.total_respuestas = 9;
    }],
    ['contradictory pagination', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.pagination.has_more = true;
    }],
    ['pagination count mismatch', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.pagination.returned = 0;
    }],
    ['unreconciled jurisdiction aggregate', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.executive_summary.jurisdiction.compatible = 0;
    }],
    ['contradictory authoritative item scope', (payload: ReturnType<typeof lifecycleEnvelope>) => {
      payload.encuestas[0].admin_scope.jurisdiction.survey_ref = 'ar:tf:ushuaia';
    }],
  ])('rejects %s', async (_label, mutate) => {
    const payload = cloneEnvelope();
    mutate(payload);
    apiFetchMock.mockResolvedValueOnce(payload);

    await expect(adminListSurveys(undefined, { tenantSlug: 'org-demo' })).rejects.toThrow(
      'survey_admin_list_contract_invalid',
    );
  });

  it('keeps legacy envelopes compatible only when they are unversioned', async () => {
    apiFetchMock.mockResolvedValueOnce({ encuestas: lifecycleEnvelope().encuestas });

    const result = await adminListSurveys(undefined, { tenantSlug: 'org-demo' });

    expect(result.data).toHaveLength(1);
    expect(result.contract_version).toBeUndefined();
  });

  it('uses the tenant-scoped v2 close mutation and refuses an unscoped close', async () => {
    apiFetchMock.mockResolvedValueOnce(lifecycleEnvelope().encuestas[0]);

    await adminCloseSurvey(41, { tenantSlug: 'org-demo' });
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/surveys/41/close',
      expect.objectContaining({ method: 'POST', tenantSlug: 'org-demo' }),
    );

    apiFetchMock.mockClear();
    await expect(adminCloseSurvey(41)).rejects.toThrow('survey_admin_tenant_required');
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
