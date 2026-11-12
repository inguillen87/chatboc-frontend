import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', async importOriginal => ({ ...await importOriginal<typeof import('@/utils/api')>(), apiFetch: mocks.fetch }));
import { ApiError } from '@/utils/api';
import { applyRelocation, getRelocationPreview, getRelocationStatus, listRelocationTargets, readRelocationPreview, readRelocationReceipt } from './surveyEditorialRelocation';
import { syntheticRelocationPreview as preview, syntheticRelocationReceipt as receipt, syntheticRelocationKey as key,
  syntheticRelocationSource as source, syntheticRelocationTarget as target } from '../../tests/fixtures/survey-editorial-relocation.synthetic';
beforeEach(() => mocks.fetch.mockReset());

describe('survey editorial relocation bound transport', () => {
  it('loads the existing directory without inheriting source organization or widget authority', async () => {
    mocks.fetch.mockResolvedValueOnce({ tenants: [{ ...target, is_active: true }, { id: 90, slug: 'inactive', nombre: 'Inactiva', is_active: false }], total: 130 });
    const current = vi.fn(() => true), result = await listRelocationTargets(1, current);
    expect(result).toEqual({ items: [{ ...target, is_active: true }], hasMore: true });
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/tenants?page=1&per_page=100', expect.objectContaining({ omitTenant: true,
      omitEntityToken: true, omitChatSessionId: true, isWidgetRequest: false, singleAttempt: true, isCurrent: current }));
  });
  it('binds preview to every selected source ID and the canonical destination', async () => {
    mocks.fetch.mockResolvedValueOnce(preview()); const current = vi.fn(() => true);
    await expect(getRelocationPreview(source, target, [705, 701, 704, 702, 703], current)).resolves.toEqual(preview());
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/v2/surveys/editorial-relocations/preview?survey_ids=701%2C702%2C703%2C704%2C705&target_tenant_slug=organization-b&target_tenant_id=72',
      expect.objectContaining({ tenantSlug: source.slug, singleAttempt: true, isCurrent: current, persistTenantSlug: false }));
  });
  it.each(['target', 'source', 'omitted selection', 'duplicate selection', 'missing all-time count', 'negative count', 'unbound revision'] as const)('rejects a %s preview', kind => {
    const raw = preview();
    if (kind === 'target') raw.target_tenant = source;
    if (kind === 'source') raw.source_tenant = target;
    if (kind === 'omitted selection') raw.items.pop();
    if (kind === 'duplicate selection') raw.items[4] = raw.items[0];
    if (kind === 'missing all-time count') delete (raw.items[0] as Partial<typeof raw.items[number]>).response_count_all_time;
    if (kind === 'negative count') raw.items[0].response_count_all_time = -1;
    if (kind === 'unbound revision') raw.items[0].editorial_sha256 = '';
    expect(() => readRelocationPreview(raw, source, target, [701, 702, 703, 704, 705])).toThrow();
  });
  it('sends exactly one POST with a stable key in both transports and fresh state/content/count preconditions', async () => {
    mocks.fetch.mockResolvedValueOnce(receipt()); const current = vi.fn(() => true);
    await expect(applyRelocation(preview(), key, current)).resolves.toEqual(receipt());
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/v2/surveys/editorial-relocations', expect.objectContaining({ method: 'POST',
      tenantSlug: source.slug, singleAttempt: true, allowStartupRecovery: false, isCurrent: current,
      headers: { 'Idempotency-Key': key }, body: { source_tenant_id: 31, target_tenant_id: 72, target_tenant_slug: target.slug,
        confirmation: 'archive_originals_create_drafts', idempotency_key: key,
        surveys: preview().items.map(item => ({ survey_id: item.survey_id, expected_state: item.state, expected_structure_revision: item.structure_revision,
          expected_editorial_sha256: item.editorial_sha256, expected_response_count_all_time: item.response_count_all_time })) } }));
  });
  it.each([404, 409, 503])('never retries or falls back after POST HTTP %s', async status => {
    mocks.fetch.mockRejectedValueOnce(new ApiError('synthetic failure', status));
    await expect(applyRelocation(preview(), key, () => true)).rejects.toThrow(); expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it.each(['key', 'target', 'omitted original', 'repeated destination', 'lost historical response', 'copied response', 'published copy', 'unarchived source', 'changed editorial content'] as const)('rejects a %s receipt instead of claiming completion', kind => {
    const raw = receipt();
    if (kind === 'key') raw.idempotency_key = 'foreign-operation';
    if (kind === 'target') raw.target_tenant = source;
    if (kind === 'omitted original') raw.items.pop();
    if (kind === 'repeated destination') raw.items[4].destination_survey_id = raw.items[0].destination_survey_id;
    if (kind === 'lost historical response') raw.items[0].source_response_count_all_time -= 1;
    if (kind === 'copied response') Object.assign(raw.items[0], { destination_response_count_all_time: 1 });
    if (kind === 'published copy') Object.assign(raw.items[0], { destination_state: 'publicada' });
    if (kind === 'unarchived source') Object.assign(raw.items[0], { source_state: 'publicada' });
    if (kind === 'changed editorial content') raw.items[0].source_editorial_sha256 = 'f'.repeat(64);
    expect(() => readRelocationReceipt(raw, preview(), key)).toThrow();
  });
  it('resolves an uncertain intent through a GET for that same key only', async () => {
    mocks.fetch.mockResolvedValueOnce(receipt()); const current = vi.fn(() => true);
    await expect(getRelocationStatus(preview(), key, current)).resolves.toEqual(receipt());
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(`/api/v2/surveys/editorial-relocations/status?idempotency_key=${key}`,
      expect.objectContaining({ tenantSlug: source.slug, singleAttempt: true, isCurrent: current }));
  });
});
