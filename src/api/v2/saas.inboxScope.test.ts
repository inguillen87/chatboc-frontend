import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/api/v2/client', () => ({ panelApi: mocks }));
import { getOmnichannelInboxDetailV2, getOmnichannelInboxV2, normalizeOmnichannelInboxItemV2, postOmnichannelInboxActionV2 } from './saas';
const item = { id: 'municipio:12', tenant_slug: 'org-a', title: 'Caso', status: 'nuevo' };
beforeEach(() => { mocks.get.mockReset(); mocks.post.mockReset(); mocks.patch.mockReset(); });
describe('omnichannel API identity boundary', () => {
  it('keeps a missing activity date missing', () => expect(normalizeOmnichannelInboxItemV2(item)?.lastMessageAt).toBe(''));
  it('passes explicit organization to a list read', async () => {
    mocks.get.mockResolvedValue({ tenant_slug: 'org-a', items: [item] });
    expect((await getOmnichannelInboxV2('org-a')).items[0].id).toBe(item.id);
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/api/v2/inbox/omnichannel', { tenantSlug: 'org-a' });
  });
  it.each([{ tenant_slug: 'org-b', items: [] }, { items: [{ ...item, tenant_slug: 'org-b' }] }])('rejects a foreign list or item', async raw => {
    mocks.get.mockResolvedValue(raw); await expect(getOmnichannelInboxV2('org-a')).rejects.toThrow();
  });
  it.each([{ item: { ...item, id: 'municipio:13' } }, { item: { ...item, tenant_slug: 'org-b' } }, { item: {} }])('rejects an incoherent detail', async raw => {
    mocks.get.mockResolvedValue(raw); await expect(getOmnichannelInboxDetailV2(item.id, 'org-a')).rejects.toThrow();
  });
  it.each(['https://example.test/detail', '//example.test/detail', '/private/detail'])('rejects non-API detail endpoints without fetching', async endpoint => {
    await expect(getOmnichannelInboxDetailV2(item.id, 'org-a', endpoint)).rejects.toThrow(); expect(mocks.get).not.toHaveBeenCalled();
  });
  it('uses the server detail endpoint when it is a safe internal API path', async () => {
    mocks.get.mockResolvedValue({ item }); await getOmnichannelInboxDetailV2(item.id, 'org-a', '/api/v2/inbox/omnichannel/municipio:12');
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/api/v2/inbox/omnichannel/municipio:12', { tenantSlug: 'org-a' });
  });
  it.each([{ ok: true }, { ticket: {} }, { ticket: { ...item, tenant_slug: 'org-b' } }, { ticket: { ...item, id: 'municipio:13' } }])('does not confirm a missing or foreign action receipt', async raw => {
    mocks.post.mockResolvedValue(raw);
    await expect(postOmnichannelInboxActionV2(item.id, { action: 'reply', payload: { source_model: 'MunicipioTicket', legacy_id: 12, message: 'Prueba', client_message_id: 'crm-reply:test-123456789012345' } }, 'org-a')).rejects.toThrow();
    expect(mocks.post).toHaveBeenCalledOnce();
  });
});
