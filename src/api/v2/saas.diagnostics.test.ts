import { describe, expect, it } from 'vitest';
import { normalizeProductionSmokeV2, normalizeTenantHealthV2 } from './saas';

const tenant = {
  id: 17,
  slug: 'organizacion-demo',
  nombre: 'Organización de demostración',
  tipo: 'municipio',
  vertical: 'government',
  subvertical: null,
  plan: 'enterprise',
  is_active: true,
};

// Shape emitted by routes/v2/saas.py::_tenant_health_payload.
const healthPayload = {
  contract_version: 'tenant.health.v1',
  tenant,
  health: {
    score: 66.67,
    status: 'warning',
    checks: {
      active: true,
      widget_configured: true,
      whatsapp_configured: false,
      team_configured: true,
      notifications_healthy: true,
      sla_healthy: false,
    },
    last_checked_at: '2026-10-13T18:00:00+00:00',
  },
  metrics: { open_tickets: 3, overdue_tickets: 1, employees: 2, notification_success_rate: 100 },
  integrations: { widget: true, whatsapp: false, payments: false, notifications: true },
  queues: { notifications_queued: 0, notifications_delayed: 0, tickets_open: 3 },
  errors_recent: { notifications_failed: 0, tickets_overdue: 1 },
  alerts: [{ severity: 'medium', reason_code: 'whatsapp_configured', message: 'Check pendiente: whatsapp_configured' }],
  recommended_actions: [{ kind: 'whatsapp_configured', priority: 'medium', message: 'Check pendiente: whatsapp_configured' }],
};

describe('tenant health diagnostics contract', () => {
  it('reads the producer nesting, scope, timestamp and explicit false/zero values', () => {
    const response = { data: healthPayload };
    const normalized = normalizeTenantHealthV2(response);

    expect(normalized).toMatchObject({
      contract_version: 'tenant.health.v1',
      tenant,
      score: 66.67,
      status: 'warning',
      last_checked_at: healthPayload.health.last_checked_at,
      metrics: healthPayload.metrics,
    });
    expect(normalized.health_score).toBeCloseTo(0.6667);
    expect(normalized.checks).toHaveLength(6);
    expect(normalized.checks.find((check) => check.id === 'whatsapp_configured')?.value).toBe(false);
    expect(normalized.integrations.find((check) => check.id === 'payments')?.value).toBe(false);
    expect(normalized.queues.find((check) => check.id === 'notifications_queued')?.value).toBe(0);
    expect(normalized.recent_errors.map(({ id, value }) => ({ id, value }))).toEqual([
      { id: 'notifications_failed', value: 0 },
      { id: 'tickets_overdue', value: 1 },
    ]);
    expect(normalized.recommended_actions[0]).not.toHaveProperty('href', expect.anything());
    expect(normalized.recommended_actions[0]).not.toHaveProperty('endpoint', expect.anything());
    expect(normalized.raw).toBe(response);
  });

  it.each([0, 0.5, 1, 85, 100])('converts %s points to a ratio exactly once', (score) => {
    const normalized = normalizeTenantHealthV2({ health: { score } });
    expect(normalized.score).toBe(score);
    expect(normalized.health_score).toBe(score / 100);
    expect(normalized.status).toBeUndefined();
  });

  it.each([undefined, null, '', '1', 'invalid', -1, 101, Infinity, NaN, true, {}, []])(
    'leaves malformed or absent score %j unavailable',
    (score) => {
      const normalized = normalizeTenantHealthV2({ health: { score, status: { healthy: true } } });
      expect(normalized.score).toBeUndefined();
      expect(normalized.health_score).toBeUndefined();
      expect(normalized.status).toBeUndefined();
    },
  );

  it('prefers the canonical health and error fields over conflicting legacy fields', () => {
    const normalized = normalizeTenantHealthV2({
      ...healthPayload,
      score: 100,
      status: 'healthy',
      checks: { active: false },
      recent_errors: { notifications_failed: 9 },
    });
    expect(normalized.score).toBe(66.67);
    expect(normalized.status).toBe('warning');
    expect(normalized.checks.find((check) => check.id === 'active')?.value).toBe(true);
    expect(normalized.recent_errors.find((check) => check.id === 'notifications_failed')?.value).toBe(0);
  });

  it.each([null, [], 'invalid', 42, {}])('does not replace malformed nested health %j with a legacy result', (health) => {
    const normalized = normalizeTenantHealthV2({ health, score: 100, status: 'healthy', checks: { active: true } });
    expect(normalized.score).toBeUndefined();
    expect(normalized.health_score).toBeUndefined();
    expect(normalized.status).toBeUndefined();
    expect(normalized.checks).toEqual([]);
  });

  it.each(['score', 'health_score', 'healthScore'])('retains the prior convention for unversioned flat score alias %s', (alias) => {
    const normalized = normalizeTenantHealthV2({
      [alias]: 1,
      state: 'critical',
      checks: [{ id: 'active', label: 'Organización', enabled: false }],
      integraciones: { widget: false },
      colas: { notifications_queued: 0 },
      errores_recientes: { notifications_failed: 0 },
      lastCheckedAt: healthPayload.health.last_checked_at,
    });
    expect(normalized.score).toBe(1);
    expect(normalized.health_score).toBe(1);
    expect(normalized.status).toBe('critical');
    expect(normalized.checks[0].value).toBe(false);
    expect(normalized.integrations[0].value).toBe(false);
    expect(normalized.queues[0].value).toBe(0);
    expect(normalized.recent_errors[0].value).toBe(0);
    expect(normalized.last_checked_at).toBe(healthPayload.health.last_checked_at);
  });

  it.each([
    ['health_score', 0.75], ['health_score', 1], ['healthScore', 0.75], ['healthScore', 1],
  ])('preserves already normalized legacy %s ratio %s', (alias, score) => {
    expect(normalizeTenantHealthV2({ [alias]: score }).health_score).toBe(score);
  });

  it.each([0.5, 1])('uses %s points when the flat payload explicitly declares tenant.health.v1', (score) => {
    const normalized = normalizeTenantHealthV2({ contract_version: 'tenant.health.v1', score });
    expect(normalized.score).toBe(score);
    expect(normalized.health_score).toBe(score / 100);
  });

  it('preserves numeric legacy score parsing', () => {
    expect(normalizeTenantHealthV2({ health_score: '37.5' }).health_score).toBe(0.375);
  });

  it('retains unknown observed status and values without inventing a classification or count', () => {
    const normalized = normalizeTenantHealthV2({
      contract_version: 'tenant.health.future',
      health: { status: 'future_state', checks: { unknown_check: null } },
      errors_recent: { notifications_failed: null },
    });
    expect(normalized.contract_version).toBe('tenant.health.future');
    expect(normalized.status).toBe('future_state');
    expect(normalized.score).toBeUndefined();
    expect(normalized.checks[0].value).toBeUndefined();
    expect(normalized.recent_errors[0].value).toBeUndefined();
  });

  it.each([undefined, null, [], true])('keeps missing or incompatible response %j neutral', (response) => {
    const normalized = normalizeTenantHealthV2(response);
    expect(normalized.score).toBeUndefined();
    expect(normalized.health_score).toBeUndefined();
    expect(normalized.status).toBeUndefined();
    expect(normalized.tenant).toBeUndefined();
    expect(normalized.last_checked_at).toBeUndefined();
    expect(normalized.checks).toEqual([]);
    expect(normalized.recent_errors).toEqual([]);
  });
});

describe('production smoke diagnostics contract', () => {
  it('preserves reported textual guidance without promoting malformed values or object IDs to instructions', () => {
    const normalized = normalizeProductionSmokeV2({ e2e_flow_readiness: { flows: [
      { id: 'first', manual_test_steps: [12, null, { id: 'private-record' }, '  Paso recibido  ', false], acceptance_criteria: [12, { label: 'unexpected-object' }, 'Criterio recibido'] },
      { id: 'second', manual_steps: ' Paso anterior ', criteria: 9 },
    ] } });
    expect(normalized.e2e_flow_readiness?.flows[0]).toMatchObject({ manual_test_steps: ['Paso recibido'], acceptance_criteria: ['Criterio recibido'] });
    expect(normalized.e2e_flow_readiness?.flows[1]).toMatchObject({ manual_test_steps: ['Paso anterior'], acceptance_criteria: [] });
  });
  it('preserves producer labels, severity, resolved tenant and generated time without adding delivery claims', () => {
    const response = {
      data: {
        contract_version: 'platform.production_smoke.v1',
        tenant,
        generated_at: '2026-10-13T18:05:00+00:00',
        status: 'pass',
        summary: { total: 2, passed: 2, failed: 0, critical_failed: 0, e2e_flows_total: 1, e2e_flows_ready: 1 },
        checks: [
          {
            id: 'whatsapp_operations', label: 'WhatsApp Operations Hub', severity: 'critical',
            ok: true, status: 'pass', endpoint: '/api/v2/whatsapp/operations',
            details: { channel_enabled: false, contract_version: 'whatsapp.operations.v1' },
          },
          {
            id: 'inbox_360', label: 'Inbox 360 drawer contract', severity: 'high',
            ok: true, status: 'pass', endpoint: '/api/v2/inbox/omnichannel', details: { ticket_id: null },
          },
        ],
        e2e_flow_readiness: {
          contract_version: 'platform.e2e_flow_readiness.v1', status: 'ready', summary: { total: 1, ready: 1 },
          flows: [{
            id: 'gov_claim_text_to_tracking', label: 'Municipio: reclamo por WhatsApp hasta seguimiento publico',
            ready: true, status: 'ready', surface: 'municipios_gobiernos', meta_flow_ready: null,
            evidence: { tickets_recent: 0 }, manual_test_steps: ['Crear un reclamo por WhatsApp'],
            acceptance_criteria: ['El ticket aparece en CRM'],
            automation: { uses_real_whatsapp: false, live_side_effects: false },
            next_action: 'run_whatsapp_claim_text_to_tracking_and_open_public_status',
          }],
          frontend_contract: { render_as: 'e2e_flow_readiness_grid' },
        },
        frontend_contract: { render_as: 'production_smoke_report', recommended_refresh_seconds: 120 },
      },
    };
    const normalized = normalizeProductionSmokeV2(response);

    expect(normalized.tenant).toEqual(tenant);
    expect(normalized.generated_at).toBe(response.data.generated_at);
    expect(normalized.status).toBe('pass');
    expect(normalized.checks[0]).toMatchObject({
      label: 'WhatsApp Operations Hub', severity: 'critical', ok: true, details: { channel_enabled: false },
    });
    expect(normalized.checks[1]).toMatchObject({ label: 'Inbox 360 drawer contract', severity: 'high', details: { ticket_id: null } });
    expect(normalized.e2e_flow_readiness?.flows[0]).toMatchObject({
      label: response.data.e2e_flow_readiness.flows[0].label,
      ready: true, meta_flow_ready: null, evidence: { tickets_recent: 0 },
      manual_test_steps: ['Crear un reclamo por WhatsApp'], acceptance_criteria: ['El ticket aparece en CRM'],
      automation: { uses_real_whatsapp: false, live_side_effects: false },
    });
    expect(normalized.raw).toBe(response);
  });

  it('keeps explicit negative controls and readiness separate from missing results', () => {
    const normalized = normalizeProductionSmokeV2({
      checks: [{ id: 'known', ok: false, status: 'fail' }, { id: 'unknown' }],
      e2e_flow_readiness: { flows: [{ id: 'known', ready: false }, { id: 'unknown' }] },
    });
    expect(normalized.checks.map(({ ok }) => ok)).toEqual([false, undefined]);
    expect(normalized.e2e_flow_readiness?.flows.map(({ ready }) => ready)).toEqual([false, undefined]);
    expect(normalized.checks[1].label).toBeUndefined();
    expect(normalized.e2e_flow_readiness?.flows[1].label).toBeUndefined();
  });

  it.each([undefined, null, 'true', 1, {}, []])('does not infer boolean outcomes from malformed flag %j or status', (flag) => {
    const normalized = normalizeProductionSmokeV2({
      checks: [{ id: 'check', ok: flag, status: 'pass', label: 42, severity: { critical: true } }],
      e2e_flow_readiness: { flows: [{ id: 'flow', ready: flag, status: 'ready', label: {}, meta_flow_ready: flag }] },
    });
    expect(normalized.checks[0].ok).toBeUndefined();
    expect(normalized.checks[0].label).toBeUndefined();
    expect(normalized.checks[0].severity).toBeUndefined();
    expect(normalized.e2e_flow_readiness?.flows[0].ready).toBeUndefined();
    expect(normalized.e2e_flow_readiness?.flows[0].label).toBeUndefined();
    expect(normalized.e2e_flow_readiness?.flows[0].meta_flow_ready).toBe(flag === null ? null : undefined);
  });

  it('retains valid legacy check and flow aliases', () => {
    const normalized = normalizeProductionSmokeV2({
      state: 'warning',
      checks: [{ key: 'legacy_check', title: 'Control recibido', passed: false, state: 'fail' }],
      e2e_flow_readiness: { state: 'needs_attention', flows: [{ key: 'legacy_flow', title: 'Recorrido recibido', ok: false }] },
    });
    expect(normalized.status).toBe('warning');
    expect(normalized.checks[0]).toMatchObject({ id: 'legacy_check', label: 'Control recibido', ok: false, status: 'fail' });
    expect(normalized.e2e_flow_readiness?.flows[0]).toMatchObject({ id: 'legacy_flow', label: 'Recorrido recibido', ready: false });
  });

  it('preserves no tenant as null and unknown contract/status without assuming platform-wide success', () => {
    const normalized = normalizeProductionSmokeV2({
      contract_version: 'platform.production_smoke.future', status: 'future_state', tenant: null,
    });
    expect(normalized.contract_version).toBe('platform.production_smoke.future');
    expect(normalized.status).toBe('future_state');
    expect(normalized.tenant).toBeNull();
    expect(normalized.generated_at).toBeUndefined();
    expect(normalized.summary).toEqual({});
    expect(normalized.checks).toEqual([]);
  });

  it('rejects malformed scope, timestamp, status and list members without synthesizing results', () => {
    const normalized = normalizeProductionSmokeV2({
      tenant: ['global'], generated_at: 123, status: true, checks: [null, true, 'pass'],
      e2e_flow_readiness: { status: 123, flows: [null, false, 'ready'] },
    });
    expect(normalized.tenant).toBeUndefined();
    expect(normalized.generated_at).toBeUndefined();
    expect(normalized.status).toBe('unknown');
    expect(normalized.checks).toEqual([]);
    expect(normalized.e2e_flow_readiness?.status).toBe('unknown');
    expect(normalized.e2e_flow_readiness?.flows).toEqual([]);
  });

  it.each([undefined, null, [], true])('keeps missing or incompatible smoke response %j neutral', (response) => {
    const normalized = normalizeProductionSmokeV2(response);
    expect(normalized.status).toBe('unknown');
    expect(normalized.summary).toEqual({});
    expect(normalized.checks).toEqual([]);
    expect(normalized.tenant).toBeUndefined();
    expect(normalized.generated_at).toBeUndefined();
    expect(normalized.e2e_flow_readiness).toBeUndefined();
  });
});
