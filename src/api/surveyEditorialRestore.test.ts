import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', async importOriginal => ({ ...await importOriginal<typeof import('@/utils/api')>(), apiFetch: mocks.fetch }));
import { ApiError } from '@/utils/api';
import { applyRestore, getRestorePreview, getRestoreStatus, readRestorePreview, readRestoreReceipt } from './surveyEditorialRelocation';
import { syntheticRestorePreview as preview, syntheticRestoreReceipt as receipt, syntheticRestoreKey as key,
  syntheticRelocationSource as source, syntheticArchive as archive } from '../../tests/fixtures/survey-editorial-relocation.synthetic';
beforeEach(() => mocks.fetch.mockReset());
describe('original survey restoration without publication', () => {
  it('reads the full archive batch with its original operation and source selector', async () => {
    mocks.fetch.mockResolvedValueOnce(preview()); const current = vi.fn(() => true);
    await expect(getRestorePreview(source, archive, current)).resolves.toEqual(preview());
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(`/api/v2/surveys/editorial-relocations/restore-preview?idempotency_key=${archive.archive_idempotency_key}`,
      expect.objectContaining({ tenantSlug: source.slug, isCurrent: current, singleAttempt: true }));
  });
  it.each(['tenant', 'archive key', 'archive operation', 'published', 'duplicate', 'negative count', 'missing revision'] as const)('rejects a %s preview', kind => {
    const raw = preview();
    if (kind === 'tenant') raw.source_tenant = { ...source, id: 999 };
    if (kind === 'archive key') raw.archive_idempotency_key = key;
    if (kind === 'archive operation') raw.archive_operation_id = 'foreign-operation';
    if (kind === 'published') Object.assign(raw.items[0], { restore_state: 'publicada' });
    if (kind === 'duplicate') raw.items[4] = raw.items[0];
    if (kind === 'negative count') raw.items[0].response_count_all_time = -1;
    if (kind === 'missing revision') raw.items[0].structure_revision = 0;
    expect(() => readRestorePreview(raw, source, archive)).toThrow();
  });
  it('binds all four CAS facts and a separate stable restore key in one POST', async () => {
    mocks.fetch.mockResolvedValueOnce(receipt()); const current = vi.fn(() => true);
    await expect(applyRestore(preview(), key, current)).resolves.toEqual(receipt());
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/v2/surveys/editorial-relocations/restore', expect.objectContaining({ method: 'POST',
      singleAttempt: true, allowStartupRecovery: false, tenantSlug: source.slug, headers: { 'Idempotency-Key': key }, body: {
        source_tenant_id: source.id, archive_idempotency_key: archive.archive_idempotency_key, idempotency_key: key, confirmation: 'restore_originals_without_publishing',
        surveys: preview().items.map(item => ({ survey_id: item.survey_id, expected_state: 'archivada', expected_structure_revision: item.structure_revision,
          expected_editorial_sha256: item.editorial_sha256, expected_response_count_all_time: item.response_count_all_time })) } }));
  });
  it('refuses reuse of the archive key and a blocked preview before any network call', async () => {
    await expect(applyRestore(preview(), archive.archive_idempotency_key, () => true)).rejects.toThrow();
    await expect(applyRestore({ ...preview(), can_apply: false }, key, () => true)).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([409, 503])('does not retry or fall back after HTTP %s', async status => {
    mocks.fetch.mockRejectedValueOnce(new ApiError('synthetic failure', status)); await expect(applyRestore(preview(), key, () => true)).rejects.toThrow(); expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it.each(['published', 'lost response', 'changed destination', 'changed content', 'archive operation', 'archive key', 'omitted original', 'duplicate original', 'key'] as const)('refuses a %s receipt', kind => {
    const raw = receipt();
    if (kind === 'published') Object.assign(raw.items[0], { source_state: 'publicada' });
    if (kind === 'lost response') raw.items[0].source_response_count_all_time -= 1;
    if (kind === 'changed destination') Object.assign(raw, { destination_drafts_unchanged: false });
    if (kind === 'changed content') raw.items[0].source_editorial_sha256 = 'f'.repeat(64);
    if (kind === 'archive operation') raw.archive_operation_id = 'foreign-operation';
    if (kind === 'archive key') raw.archive_idempotency_key = key;
    if (kind === 'omitted original') raw.items.pop();
    if (kind === 'duplicate original') raw.items[4] = raw.items[0];
    if (kind === 'key') raw.idempotency_key = archive.archive_idempotency_key;
    expect(() => readRestoreReceipt(raw, preview(), key)).toThrow();
  });
  it('reads status only for the same restore key', async () => {
    mocks.fetch.mockResolvedValueOnce(receipt()); await expect(getRestoreStatus(preview(), key, () => true)).resolves.toEqual(receipt());
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(`/api/v2/surveys/editorial-relocations/status?idempotency_key=${key}`, expect.objectContaining({ tenantSlug: source.slug, singleAttempt: true }));
  });
});
