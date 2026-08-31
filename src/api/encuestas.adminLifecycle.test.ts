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
