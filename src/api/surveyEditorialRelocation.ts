import { ApiError, apiFetch } from '@/utils/api';
import { panelReadOptions } from '@/utils/panelReadOptions';

export interface RelocationTenant { id: number; slug: string; nombre: string }
export interface RelocationSurvey {
  survey_id: number;
  title: string;
  state: 'borrador' | 'publicada' | 'cerrada' | 'archivada';
  structure_revision: number;
  editorial_sha256: string;
  response_count_all_time: number;
}
export interface RelocationPreview {
  contract_version: 'surveys.editorial_relocation_preview.v1';
  source_tenant: RelocationTenant;
  target_tenant: RelocationTenant;
  can_apply: boolean;
  items: RelocationSurvey[];
  ui: Record<string, string>;
}
export interface RelocationReceipt {
  contract_version: 'surveys.editorial_relocation_receipt.v1';
  state: 'originals_archived_destination_drafts_created';
  operation_id: string;
  idempotency_key: string;
  source_tenant: RelocationTenant;
  target_tenant: RelocationTenant;
  copied_responses: false;
  items: Array<{
    source_survey_id: number;
    destination_survey_id: number;
    original_previous_state: RelocationSurvey['state'];
    source_state: 'archivada';
    destination_state: 'borrador';
    source_response_count_all_time: number;
    destination_response_count_all_time: 0;
    source_editorial_sha256: string;
  }>;
}
export interface RelocationAction {
  contract_version: 'surveys.editorial_relocation_action.v1';
  can_preview: true;
  label: string;
  description: string;
  max_surveys: number;
  ui: Record<string, string>;
}
export interface ArchivedRelocation { archive_idempotency_key: string; archive_operation_id: string; source_editorial_sha256: string }
export interface RestorePreview {
  contract_version: 'surveys.editorial_restore_preview.v1';
  source_tenant: RelocationTenant; archive_idempotency_key: string; archive_operation_id: string;
  items: Array<RelocationSurvey & { restore_state: 'borrador' | 'cerrada'; can_restore: boolean }>;
  can_apply: boolean; published: false; preserved_responses: true; ui: Record<string, string>;
}
export interface RestoreReceipt {
  contract_version: 'surveys.editorial_restore_receipt.v1'; state: 'originals_restored_without_publishing';
  operation_id: string; idempotency_key: string; archive_idempotency_key: string; archive_operation_id: string;
  source_tenant: RelocationTenant; preserved_responses: true; published: false; destination_drafts_unchanged: true;
  items: Array<{ source_survey_id: number; source_state: 'borrador' | 'cerrada'; source_response_count_all_time: number; source_editorial_sha256: string }>;
}
const BASE = '/api/v2/surveys/editorial-relocations';
const asRecord = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const id = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const slug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const key = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const knownState = (value: unknown) => ['borrador', 'publicada', 'cerrada', 'archivada'].includes(String(value));
const invalid = () => new ApiError('No pudimos verificar el alcance o el resultado de la reubicación.', 502);
const sameTenant = (value: unknown, expected: RelocationTenant) => {
  const row = asRecord(value);
  return row.id === expected.id && row.slug === expected.slug && text(row.nombre);
};
export const readRelocationAction = (value: unknown): RelocationAction | null => {
  const raw = asRecord(value), ui = asRecord(raw.ui);
  if (raw.contract_version !== 'surveys.editorial_relocation_action.v1' || raw.can_preview !== true ||
      !text(raw.label) || !text(raw.description) || !id(raw.max_surveys) || raw.max_surveys > 5 ||
      !['selection_label', 'target_label', 'preview_label', 'cancel_label', 'loading_label', 'history_label', 'check_status_label', 'uncertain_message', 'conflict_message', 'preview_error'].every(name => text(ui[name]))) return null;
  return raw as unknown as RelocationAction;
};
export const readRelocationPreview = (value: unknown, source: RelocationTenant, target: RelocationTenant, surveyIds: number[]): RelocationPreview => {
  const raw = asRecord(value), ui = asRecord(raw.ui);
  const expected = [...surveyIds].sort((a, b) => a - b);
  if (!id(source.id) || !slug(source.slug) || !id(target.id) || !slug(target.slug) ||
      !expected.length || expected.length > 5 || expected.some(value => !id(value)) || new Set(expected).size !== expected.length ||
      raw.contract_version !== 'surveys.editorial_relocation_preview.v1' || !sameTenant(raw.source_tenant, source) ||
      !sameTenant(raw.target_tenant, target) || source.id === target.id || source.slug === target.slug ||
      typeof raw.can_apply !== 'boolean' || !Array.isArray(raw.items) || raw.items.length !== expected.length ||
      !['confirm_label', 'preservation_notice', 'draft_notice', 'published_warning', 'response_count_label'].every(name => text(ui[name]))) throw invalid();
  const items = raw.items.map(value => {
    const row = asRecord(value);
    if (!id(row.survey_id) || !text(row.title) || !knownState(row.state) || !id(row.structure_revision) ||
        !sha(row.editorial_sha256) || !count(row.response_count_all_time)) throw invalid();
    return row as unknown as RelocationSurvey;
  }).sort((a, b) => a.survey_id - b.survey_id);
  if (items.some((item, index) => item.survey_id !== expected[index]) ||
      (raw.can_apply && items.some(item => item.state === 'archivada'))) throw invalid();
  return { ...raw, items } as unknown as RelocationPreview;
};
export const readRelocationReceipt = (value: unknown, preview: RelocationPreview, requestKey: string): RelocationReceipt => {
  const raw = asRecord(value);
  if (raw.contract_version !== 'surveys.editorial_relocation_receipt.v1' || raw.state !== 'originals_archived_destination_drafts_created' ||
      !text(raw.operation_id) || raw.idempotency_key !== requestKey || !sameTenant(raw.source_tenant, preview.source_tenant) ||
      !sameTenant(raw.target_tenant, preview.target_tenant) || raw.copied_responses !== false || !Array.isArray(raw.items) ||
      raw.items.length !== preview.items.length) throw invalid();
  const bySource = new Map(preview.items.map(item => [item.survey_id, item]));
  const items = raw.items.map(value => {
    const row = asRecord(value), previous = bySource.get(row.source_survey_id as number);
    if (!previous || !id(row.destination_survey_id) || bySource.has(row.destination_survey_id) ||
        row.original_previous_state !== previous.state || row.source_state !== 'archivada' || row.destination_state !== 'borrador' ||
        row.source_editorial_sha256 !== previous.editorial_sha256 ||
        !count(row.source_response_count_all_time) || row.source_response_count_all_time !== previous.response_count_all_time ||
        row.destination_response_count_all_time !== 0) throw invalid();
    return row as unknown as RelocationReceipt['items'][number];
  });
  if (new Set(items.map(item => item.source_survey_id)).size !== items.length ||
      new Set(items.map(item => item.destination_survey_id)).size !== items.length) throw invalid();
  return { ...raw, items } as unknown as RelocationReceipt;
};
export const listRelocationTargets = async (page: number, isCurrent: () => boolean) => {
  if (!id(page)) throw invalid();
  const raw = asRecord(await apiFetch<unknown>(`/api/admin/tenants?page=${page}&per_page=100`, { ...panelReadOptions(), isCurrent }));
  if (!Array.isArray(raw.tenants) || !count(raw.total) || raw.tenants.length > 100) throw invalid();
  const rows = raw.tenants.map(value => {
    const row = asRecord(value);
    if (!id(row.id) || !slug(row.slug) || !text(row.nombre) || typeof row.is_active !== 'boolean') throw invalid();
    return { id: row.id, slug: row.slug, nombre: row.nombre, is_active: row.is_active };
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length || new Set(rows.map(row => row.slug)).size !== rows.length) throw invalid();
  return { items: rows.filter(row => row.is_active), hasMore: page * 100 < raw.total };
};
export const getRelocationPreview = async (source: RelocationTenant, target: RelocationTenant, surveyIds: number[], isCurrent: () => boolean) => {
  if (!id(source.id) || !slug(source.slug) || !id(target.id) || !slug(target.slug) ||
      !surveyIds.length || surveyIds.length > 5 || surveyIds.some(value => !id(value)) || new Set(surveyIds).size !== surveyIds.length) throw invalid();
  const params = new URLSearchParams({ survey_ids: [...surveyIds].sort((a, b) => a - b).join(','), target_tenant_slug: target.slug, target_tenant_id: String(target.id) });
  const raw = await apiFetch<unknown>(`${BASE}/preview?${params}`, { ...panelReadOptions(source.slug), isCurrent });
  return readRelocationPreview(raw, source, target, surveyIds);
};
export const applyRelocation = async (preview: RelocationPreview, requestKey: string, isCurrent: () => boolean) => {
  const checked = readRelocationPreview(preview, preview.source_tenant, preview.target_tenant, preview.items.map(item => item.survey_id));
  if (!checked.can_apply || !key(requestKey)) throw invalid();
  const raw = await apiFetch<unknown>(BASE, {
    ...panelReadOptions(checked.source_tenant.slug), allowStartupRecovery: false, method: 'POST', isCurrent,
    headers: { 'Idempotency-Key': requestKey },
    body: { source_tenant_id: checked.source_tenant.id, target_tenant_id: checked.target_tenant.id, target_tenant_slug: checked.target_tenant.slug,
      surveys: checked.items.map(item => ({ survey_id: item.survey_id, expected_state: item.state,
        expected_structure_revision: item.structure_revision, expected_editorial_sha256: item.editorial_sha256,
        expected_response_count_all_time: item.response_count_all_time })),
      idempotency_key: requestKey, confirmation: 'archive_originals_create_drafts' },
  });
  return readRelocationReceipt(raw, checked, requestKey);
};
export const getRelocationStatus = async (preview: RelocationPreview, requestKey: string, isCurrent: () => boolean) => {
  if (!key(requestKey)) throw invalid();
  const params = new URLSearchParams({ idempotency_key: requestKey });
  const raw = await apiFetch<unknown>(`${BASE}/status?${params}`, { ...panelReadOptions(preview.source_tenant.slug), isCurrent });
  return readRelocationReceipt(raw, preview, requestKey);
};
export const readArchivedRelocations = (value: unknown): Record<string, ArchivedRelocation> => {
  const raw = asRecord(value), result: Record<string, ArchivedRelocation> = {};
  for (const [surveyId, value] of Object.entries(raw)) {
    const row = asRecord(value);
    if (/^[1-9][0-9]*$/.test(surveyId) && id(Number(surveyId)) && key(row.archive_idempotency_key) && text(row.archive_operation_id) && sha(row.source_editorial_sha256)) result[surveyId] = row as unknown as ArchivedRelocation;
  }
  return result;
};
export const readRestorePreview = (value: unknown, source: RelocationTenant, archive: ArchivedRelocation): RestorePreview => {
  const raw = asRecord(value), ui = asRecord(raw.ui);
  if (!id(source.id) || !slug(source.slug) || !key(archive.archive_idempotency_key) ||
      raw.contract_version !== 'surveys.editorial_restore_preview.v1' || !sameTenant(raw.source_tenant, source) ||
      raw.archive_idempotency_key !== archive.archive_idempotency_key || raw.archive_operation_id !== archive.archive_operation_id ||
      raw.published !== false || raw.preserved_responses !== true || typeof raw.can_apply !== 'boolean' ||
      !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 5 ||
      !['restore_label', 'restore_confirm_label', 'restore_notice', 'response_count_label'].every(name => text(ui[name]))) throw invalid();
  const items = raw.items.map(value => {
    const row = asRecord(value);
    if (!id(row.survey_id) || !text(row.title) || !knownState(row.state) || !id(row.structure_revision) || !sha(row.editorial_sha256) ||
        !count(row.response_count_all_time) || !['borrador', 'cerrada'].includes(String(row.restore_state)) || typeof row.can_restore !== 'boolean' ||
        (raw.can_apply && (row.state !== 'archivada' || !row.can_restore))) throw invalid();
    return row as unknown as RestorePreview['items'][number];
  }).sort((a, b) => a.survey_id - b.survey_id);
  if (new Set(items.map(item => item.survey_id)).size !== items.length) throw invalid();
  return { ...raw, items } as unknown as RestorePreview;
};
export const readRestoreReceipt = (value: unknown, preview: RestorePreview, requestKey: string): RestoreReceipt => {
  const raw = asRecord(value);
  if (raw.contract_version !== 'surveys.editorial_restore_receipt.v1' || raw.state !== 'originals_restored_without_publishing' ||
      !text(raw.operation_id) || raw.idempotency_key !== requestKey || raw.archive_idempotency_key !== preview.archive_idempotency_key ||
      raw.archive_operation_id !== preview.archive_operation_id || !sameTenant(raw.source_tenant, preview.source_tenant) ||
      raw.preserved_responses !== true || raw.published !== false || raw.destination_drafts_unchanged !== true ||
      !Array.isArray(raw.items) || raw.items.length !== preview.items.length) throw invalid();
  const byId = new Map(preview.items.map(item => [item.survey_id, item]));
  const items = raw.items.map(value => {
    const row = asRecord(value), previous = byId.get(row.source_survey_id as number);
    if (!previous || row.source_state !== previous.restore_state || row.source_response_count_all_time !== previous.response_count_all_time || row.source_editorial_sha256 !== previous.editorial_sha256) throw invalid();
    return row as unknown as RestoreReceipt['items'][number];
  });
  if (new Set(items.map(item => item.source_survey_id)).size !== items.length) throw invalid();
  return { ...raw, items } as unknown as RestoreReceipt;
};
export const getRestorePreview = async (source: RelocationTenant, archive: ArchivedRelocation, isCurrent: () => boolean) => {
  if (!id(source.id) || !slug(source.slug) || !key(archive.archive_idempotency_key)) throw invalid();
  const raw = await apiFetch<unknown>(`${BASE}/restore-preview?${new URLSearchParams({ idempotency_key: archive.archive_idempotency_key })}`, { ...panelReadOptions(source.slug), isCurrent });
  return readRestorePreview(raw, source, archive);
};
export const applyRestore = async (preview: RestorePreview, requestKey: string, isCurrent: () => boolean) => {
  const checked = readRestorePreview(preview, preview.source_tenant, { ...preview, source_editorial_sha256: preview.items[0]?.editorial_sha256 });
  if (!checked.can_apply || !key(requestKey) || requestKey === checked.archive_idempotency_key) throw invalid();
  const raw = await apiFetch<unknown>(`${BASE}/restore`, { ...panelReadOptions(checked.source_tenant.slug), allowStartupRecovery: false,
    method: 'POST', isCurrent, headers: { 'Idempotency-Key': requestKey }, body: {
      source_tenant_id: checked.source_tenant.id, archive_idempotency_key: checked.archive_idempotency_key, idempotency_key: requestKey,
      confirmation: 'restore_originals_without_publishing', surveys: checked.items.map(item => ({ survey_id: item.survey_id, expected_state: item.state,
        expected_structure_revision: item.structure_revision, expected_editorial_sha256: item.editorial_sha256, expected_response_count_all_time: item.response_count_all_time })) } });
  return readRestoreReceipt(raw, checked, requestKey);
};
export const getRestoreStatus = async (preview: RestorePreview, requestKey: string, isCurrent: () => boolean) => {
  if (!key(requestKey)) throw invalid();
  const raw = await apiFetch<unknown>(`${BASE}/status?${new URLSearchParams({ idempotency_key: requestKey })}`, { ...panelReadOptions(preview.source_tenant.slug), isCurrent });
  return readRestoreReceipt(raw, preview, requestKey);
};
