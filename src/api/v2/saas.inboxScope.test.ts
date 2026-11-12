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
  const municipalEndpoint = '/api/v2/inbox/omnichannel/407?source_model=MunicipioTicket';
  const municipalDetail = {
    contract_version: 'inbox.omnichannel.detail.v1', tenant: { slug: 'org-a', id: 22 },
    item: { id: 'municipio:407', legacy_id: 407, ticket_id: 407,
      source_model: 'MunicipioTicket', legacy_kind: 'claim',
      detail_endpoint: municipalEndpoint, reply_contract: { contract_version: 'inbox.reply_contract.v1' } },
  };
  it('accepts the exact namespaced municipal claim returned for its numeric legacy detail route', async () => {
    mocks.get.mockResolvedValue(municipalDetail);
    const result = await getOmnichannelInboxDetailV2(407, 'org-a', municipalEndpoint);
    expect(result.item.id).toBe('municipio:407');
    expect(result.item.ticket_id).toBe('407');
    expect(result.item.reply_contract?.contract_version).toBe('inbox.reply_contract.v1');
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(municipalEndpoint, { tenantSlug: 'org-a' });
  });
  it.each([
    ['canonical id', { id: 'municipio:408' }], ['legacy id', { legacy_id: 408 }],
    ['ticket id', { ticket_id: 408 }], ['source', { source_model: 'TenantTicket' }],
    ['kind', { legacy_kind: 'order' }], ['tenant', { tenant_slug: 'org-b' }],
    ['missing legacy id', { legacy_id: undefined }],
    ['detail route', { detail_endpoint: '/api/v2/inbox/omnichannel/408?source_model=MunicipioTicket' }],
  ])('rejects a municipal alias whose %s differs', async (_field, change) => {
    mocks.get.mockResolvedValue({ ...municipalDetail, item: { ...municipalDetail.item, ...change } });
    await expect(getOmnichannelInboxDetailV2(407, 'org-a', municipalEndpoint)).rejects.toThrow();
  });
  it.each([
    ['/api/v2/inbox/omnichannel/407', 'org-a'],
    ['/api/v2/inbox/omnichannel/407?source_model=TenantTicket', 'org-a'],
    [municipalEndpoint, undefined],
  ])('does not infer a municipal alias without the exact route and organization', async (endpoint, scope) => {
    mocks.get.mockResolvedValue(municipalDetail);
    await expect(getOmnichannelInboxDetailV2(407, scope, endpoint)).rejects.toThrow();
  });
  it('rejects a foreign envelope even if the municipal item matches the selected organization', async () => {
    mocks.get.mockResolvedValue({ ...municipalDetail, tenant: { slug: 'org-b', id: 23 } });
    await expect(getOmnichannelInboxDetailV2(407, 'org-a', municipalEndpoint)).rejects.toThrow();
  });
  it('rejects a municipal alias without the authoritative organization envelope', async () => {
    mocks.get.mockResolvedValue({ ...municipalDetail, tenant: undefined });
    await expect(getOmnichannelInboxDetailV2(407, 'org-a', municipalEndpoint)).rejects.toThrow();
  });
  it('does not accept the municipal alias from an unknown contract version', async () => {
    mocks.get.mockResolvedValue({ ...municipalDetail, contract_version: 'future.detail.v2' });
    await expect(getOmnichannelInboxDetailV2(407, 'org-a', municipalEndpoint)).rejects.toThrow();
  });
  it.each([{ ok: true }, { ticket: {} }, { ticket: { ...item, tenant_slug: 'org-b' } }, { ticket: { ...item, id: 'municipio:13' } }])('does not confirm a missing or foreign action receipt', async raw => {
    mocks.post.mockResolvedValue(raw);
    await expect(postOmnichannelInboxActionV2(item.id, { action: 'reply', payload: { source_model: 'MunicipioTicket', legacy_id: 12, message: 'Prueba', client_message_id: 'crm-reply:test-123456789012345' } }, 'org-a')).rejects.toThrow();
    expect(mocks.post).toHaveBeenCalledOnce();
  });
});
