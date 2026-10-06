import { ApiError, apiFetch } from '@/utils/api';
import { panelReadOptions } from '@/utils/panelReadOptions';

export interface Rehearsal {
  contract_version: 'surveys.production_rehearsal.v1'; mode: 'technical_rehearsal'; tenant_slug: string; run_id: string;
  instrument_sha256: string; expires_at: string; max_responses: 20; authentication_required: true; one_account_per_run: true;
  official: false; unique_person_certified: false; result_certified: false; seeded_responses: 0; persisted: true; response_origin: 'interactive_demo';
  branding: { tenant_slug: string; display_name: string };
  question: { id: 'technical_form_v1'; type: 'single'; label: string; options: Array<{ id: 'yes' | 'no'; label: string }> };
  ui: Record<string, string>; metrics: { total_responses: number; options: Array<{ option_id: 'yes' | 'no'; count: number }> };
  links: { metadata_api: string; respond_api: string; results_api: string }; result_version: string;
  refresh: { polling_enabled: true; interval_ms: 5000; socket_delivery_proven: false };
}
export interface RehearsalList {
  contract_version: 'surveys.production_rehearsal.v1'; official: false; source_tenant: { slug: string; display_name: string; canonical: true };
  items: Rehearsal[]; max_active_runs: 3; ui: Record<string, string>;
  create_action: { contract_version: 'surveys.production_rehearsal.create_action.v1'; can_create: boolean; requires_strict_mfa: true;
    method: 'POST'; api_path: string; blocked_reason_code: string | null; ui: Record<string, string> };
}
export interface RehearsalResponse {
  contract_version: 'surveys.production_rehearsal.response.v1'; run_id: string; tenant_slug: string; persisted: true; replayed: boolean;
  receipt: { submission_id: string; option_id: 'yes' | 'no'; instrument_sha256: string; verified_current_account: true; run_id: string; tenant_slug: string; payload_sha256: string };
  response_origin: 'interactive_demo'; official: false; unique_person_certified: false; ui: Record<string, string>;
}
export interface RehearsalAccountStatus { contract_version: 'surveys.production_rehearsal.account_status.v1'; tenant_slug: string; run_id: string;
  verified_current_account: true; participated: boolean; official: false; unique_person_certified: false; ui: Record<string, string> }
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export const validRehearsalTenant = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value);
export const validRehearsalRun = (value: unknown): value is string => typeof value === 'string' && /^rehearsal_[a-f0-9]{32}$/.test(value);
export const validRehearsalKey = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 20;
const invalid = () => new ApiError('No pudimos verificar el alcance o el resultado de esta prueba técnica.', 502);
const base = (tenant: string) => `/api/v2/tenants/${tenant}/survey-rehearsals`;
const publicBase = (tenant: string, run: string) => `/api/v2/public/tenants/${tenant}/survey-rehearsals/${run}`;
export const rehearsalPagePath = (tenant: string, run: string) => {
  if (!validRehearsalTenant(tenant) || !validRehearsalRun(run)) throw invalid();
  return `/pruebas/encuestas/${tenant}/${run}`;
};
export const readRehearsal = (value: unknown, tenant: string, expectedRun?: string): Rehearsal => {
  const raw = record(value), branding = record(raw.branding), question = record(raw.question), metrics = record(raw.metrics), ui = record(raw.ui), links = record(raw.links), refresh = record(raw.refresh);
  if (!validRehearsalTenant(tenant) || raw.contract_version !== 'surveys.production_rehearsal.v1' || raw.mode !== 'technical_rehearsal' ||
      raw.tenant_slug !== tenant || !validRehearsalRun(raw.run_id) || (expectedRun !== undefined && raw.run_id !== expectedRun) || !sha(raw.instrument_sha256) ||
      !text(raw.expires_at) || !Number.isFinite(Date.parse(raw.expires_at)) || raw.max_responses !== 20 || raw.authentication_required !== true || raw.one_account_per_run !== true ||
      raw.official !== false || raw.unique_person_certified !== false || raw.result_certified !== false || raw.seeded_responses !== 0 || raw.persisted !== true || raw.response_origin !== 'interactive_demo' ||
      branding.tenant_slug !== tenant || !text(branding.display_name) || question.id !== 'technical_form_v1' || question.type !== 'single' || !text(question.label) ||
      !Array.isArray(question.options) || question.options.length !== 2 || !Array.isArray(metrics.options) || metrics.options.length !== 2 || !count(metrics.total_responses) ||
      !['title', 'label', 'warning', 'description', 'submit_label', 'login_label', 'refresh_label', 'results_label', 'total_label', 'expires_label', 'limit_label', 'read_at_label', 'check_status_label', 'uncertain_message', 'error_message'].every(name => text(ui[name])) ||
      refresh.polling_enabled !== true || refresh.interval_ms !== 5000 || refresh.socket_delivery_proven !== false || !sha(raw.result_version)) throw invalid();
  const ids = question.options.map(value => { const option = record(value); if (!['yes', 'no'].includes(String(option.id)) || !text(option.label)) throw invalid(); return option.id; });
  const totals = metrics.options.map(value => { const option = record(value); if (!['yes', 'no'].includes(String(option.option_id)) || !count(option.count)) throw invalid(); return { id: option.option_id, count: option.count }; });
  const canonicalBase = publicBase(tenant, raw.run_id);
  if (new Set(ids).size !== 2 || new Set(totals.map(option => option.id)).size !== 2 || totals.reduce((total, option) => total + option.count, 0) !== metrics.total_responses ||
      links.metadata_api !== canonicalBase || links.respond_api !== canonicalBase + '/respond' || links.results_api !== canonicalBase + '/results') throw invalid();
  return raw as unknown as Rehearsal;
};
export const readRehearsalList = (value: unknown, tenant: string): RehearsalList => {
  const raw = record(value), source = record(raw.source_tenant), action = record(raw.create_action), ui = record(raw.ui), actionUi = record(action.ui);
  if (!validRehearsalTenant(tenant) || raw.contract_version !== 'surveys.production_rehearsal.v1' || raw.official !== false || source.slug !== tenant || !text(source.display_name) || source.canonical !== true ||
      raw.max_active_runs !== 3 || !Array.isArray(raw.items) || raw.items.length > 3 || action.contract_version !== 'surveys.production_rehearsal.create_action.v1' ||
      typeof action.can_create !== 'boolean' || action.requires_strict_mfa !== true || action.method !== 'POST' || action.api_path !== base(tenant) ||
      !(action.blocked_reason_code === null || text(action.blocked_reason_code)) || (action.can_create && action.blocked_reason_code !== null) ||
      !['label', 'description'].every(name => text(actionUi[name])) || !['title', 'warning', 'refresh_label', 'open_label', 'check_status_label', 'uncertain_message', 'error_message'].every(name => text(ui[name]))) throw invalid();
  const items = raw.items.map(value => readRehearsal(value, tenant));
  if (new Set(items.map(item => item.run_id)).size !== items.length || (action.can_create && items.length >= 3)) throw invalid();
  return { ...raw, items } as unknown as RehearsalList;
};
export const readRehearsalResponse = (value: unknown, rehearsal: Rehearsal, submissionId: string, optionId: 'yes' | 'no'): RehearsalResponse => {
  const raw = record(value), ui = record(raw.ui), receipt = record(raw.receipt);
  if (raw.contract_version !== 'surveys.production_rehearsal.response.v1' || raw.run_id !== rehearsal.run_id || raw.tenant_slug !== rehearsal.tenant_slug ||
      receipt.submission_id !== submissionId || receipt.option_id !== optionId || receipt.instrument_sha256 !== rehearsal.instrument_sha256 || receipt.verified_current_account !== true ||
      receipt.run_id !== rehearsal.run_id || receipt.tenant_slug !== rehearsal.tenant_slug || !sha(receipt.payload_sha256) ||
      raw.persisted !== true || typeof raw.replayed !== 'boolean' || raw.response_origin !== 'interactive_demo' || raw.official !== false || raw.unique_person_certified !== false ||
      !text(ui.label) || !text(ui.warning)) throw invalid();
  return raw as unknown as RehearsalResponse;
};
const publicOptions = (isCurrent: () => boolean) => ({ omitCredentials: true, omitTenant: true, persistTenantSlug: false,
  omitEntityToken: true, omitChatSessionId: true, isWidgetRequest: false, singleAttempt: true, allowStartupRecovery: false, isCurrent });
export const getRehearsal = async (tenant: string, run: string, isCurrent: () => boolean, results = false) => {
  if (!validRehearsalTenant(tenant) || !validRehearsalRun(run)) throw invalid();
  return readRehearsal(await apiFetch<unknown>(publicBase(tenant, run) + (results ? '/results' : ''), publicOptions(isCurrent)), tenant, run);
};
export const listRehearsals = async (tenant: string, isCurrent: () => boolean) => {
  if (!validRehearsalTenant(tenant)) throw invalid();
  return readRehearsalList(await apiFetch<unknown>(base(tenant), { ...panelReadOptions(tenant), isCurrent }), tenant);
};
export const createRehearsal = async (list: RehearsalList, submissionId: string, isCurrent: () => boolean) => {
  const checked = readRehearsalList(list, list.source_tenant.slug);
  if (!checked.create_action.can_create || !validRehearsalKey(submissionId)) throw invalid();
  const raw = record(await apiFetch<unknown>(base(checked.source_tenant.slug), { ...panelReadOptions(checked.source_tenant.slug), method: 'POST', allowStartupRecovery: false,
    isCurrent, headers: { 'Idempotency-Key': submissionId }, body: {} }));
  if (raw.submission_id !== submissionId || typeof raw.replayed !== 'boolean') throw invalid();
  return readRehearsal(raw, checked.source_tenant.slug);
};
export const getRehearsalCreationStatus = async (tenant: string, submissionId: string, isCurrent: () => boolean) => {
  if (!validRehearsalTenant(tenant) || !validRehearsalKey(submissionId)) throw invalid();
  const raw = record(await apiFetch<unknown>(base(tenant) + `/status?${new URLSearchParams({ submission_id: submissionId })}`, { ...panelReadOptions(tenant), isCurrent }));
  if (raw.submission_id !== submissionId || typeof raw.replayed !== 'boolean') throw invalid();
  return readRehearsal(raw, tenant);
};
export const respondToRehearsal = async (rehearsal: Rehearsal, submissionId: string, optionId: 'yes' | 'no', isCurrent: () => boolean) => {
  const checked = readRehearsal(rehearsal, rehearsal.tenant_slug, rehearsal.run_id);
  if (!validRehearsalKey(submissionId) || !checked.question.options.some(option => option.id === optionId)) throw invalid();
  const raw = await apiFetch<unknown>(publicBase(checked.tenant_slug, checked.run_id) + '/respond', { ...panelReadOptions(checked.tenant_slug), method: 'POST', allowStartupRecovery: false,
    isCurrent, headers: { 'Idempotency-Key': submissionId }, body: { submission_id: submissionId, option_id: optionId } });
  return readRehearsalResponse(raw, checked, submissionId, optionId);
};
export const getRehearsalResponseStatus = async (rehearsal: Rehearsal, submissionId: string, optionId: 'yes' | 'no', isCurrent: () => boolean) => {
  if (!validRehearsalKey(submissionId)) throw invalid();
  const raw = await apiFetch<unknown>(publicBase(rehearsal.tenant_slug, rehearsal.run_id) + `/respond/status?${new URLSearchParams({ submission_id: submissionId })}`, { ...panelReadOptions(rehearsal.tenant_slug), isCurrent });
  return readRehearsalResponse(raw, rehearsal, submissionId, optionId);
};
export const getRehearsalAccountStatus = async (rehearsal: Rehearsal, isCurrent: () => boolean): Promise<RehearsalAccountStatus> => {
  const checked = readRehearsal(rehearsal, rehearsal.tenant_slug, rehearsal.run_id);
  const raw = record(await apiFetch<unknown>(publicBase(checked.tenant_slug, checked.run_id) + '/respond/status', { ...panelReadOptions(checked.tenant_slug), isCurrent })), ui = record(raw.ui);
  if (raw.contract_version !== 'surveys.production_rehearsal.account_status.v1' || raw.tenant_slug !== checked.tenant_slug || raw.run_id !== checked.run_id ||
      raw.verified_current_account !== true || typeof raw.participated !== 'boolean' || raw.official !== false || raw.unique_person_certified !== false || !text(ui.label)) throw invalid();
  return raw as unknown as RehearsalAccountStatus;
};
