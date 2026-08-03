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

const lifecycleEnvelope = () => ({
  contract_version: 'surveys.admin_list.v2',
  tenant: { id: 12, slug: 'org-demo' },
  freshness: {
    generated_at: '2026-08-02T12:00:00Z',
    source: 'enc_encuesta_and_enc_respuesta',
    synthetic: false,
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
    expect(result.data[0].admin_lifecycle?.capabilities.can_close).toBe(true);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/admin/encuestas',
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
