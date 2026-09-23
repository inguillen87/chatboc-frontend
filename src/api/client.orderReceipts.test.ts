import { beforeEach, describe, expect, it, vi } from 'vitest';
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/utils/api', () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args), ApiError: class extends Error {} }));
import { apiClient } from './client';
const id = 'market:42';
const receipt = () => ({ id, status: 'confirmed', items: [], total: 0 });
beforeEach(() => apiFetchMock.mockReset());
describe('raw administrative order receipt boundary', () => {
  it.each([{}, null, { id }, { source_id: id, status: 'confirmed' }, { id, status: ' ' }])('rejects incomplete raw reads before normalization: %j', async (raw) => {
    apiFetchMock.mockResolvedValue(raw);
    await expect(apiClient.adminGetOrder('qa-order', id)).rejects.toThrow();
    expect(apiFetchMock).toHaveBeenCalledOnce();
  });
  it.each([{}, { id }, { id, status: 'confirmed' }, { id: 'conversational:42', status: 'shipped' }])('rejects unconfirmed raw writes: %j', async (raw) => {
    apiFetchMock.mockResolvedValue(raw);
    await expect(apiClient.adminUpdateOrder('qa-order', id, { status: 'shipped' })).rejects.toThrow();
    expect(apiFetchMock).toHaveBeenCalledOnce();
  });
  it('does not turn a catalog association response without status into a new order', async () => {
    apiFetchMock.mockResolvedValue({ id, items: [] });
    await expect(apiClient.adminUpdateOrder('qa-order', id, { catalog_resolutions: [] })).rejects.toThrow();
  });
  it.each(['read', 'write'])('rejects a foreign organization during %s', async (operation) => {
    apiFetchMock.mockResolvedValue({ ...receipt(), tenant_slug: 'other' });
    await expect(operation === 'read' ? apiClient.adminGetOrder('qa-order', id) : apiClient.adminUpdateOrder('qa-order', id, { status: 'confirmed' })).rejects.toThrow();
  });
  it('accepts a canonical receipt, keeps zero and does not invent a creation date', async () => {
    apiFetchMock.mockResolvedValue(receipt());
    const value = await apiClient.adminGetOrder('qa-order', id);
    expect(value).toMatchObject({ id, status: 'confirmed', total: 0, created_at: '' });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/tenants/qa-order/orders/market%3A42', { tenantSlug: 'qa-order' });
  });
  it('accepts only the status acknowledged by the raw mutation response', async () => {
    apiFetchMock.mockResolvedValue({ ...receipt(), status: 'shipped' });
    expect(await apiClient.adminUpdateOrder('qa-order', id, { status: 'shipped' })).toMatchObject({ id, status: 'shipped' });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/tenants/qa-order/orders/market%3A42', { method: 'PATCH', tenantSlug: 'qa-order', body: { status: 'shipped' } });
  });
  it('preserves an explicit future state without reclassifying it as new', async () => {
    apiFetchMock.mockResolvedValue({ ...receipt(), status: 'future_state' });
    expect((await apiClient.adminGetOrder('qa-order', id)).status).toBe('future_state');
  });
  it('does not fabricate list status or recency when the backend omits them', async () => {
    apiFetchMock.mockResolvedValue({ orders: [{ id, items: [], total: 0 }] });
    const list = await apiClient.adminListOrders('qa-order');
    expect(list[0]).toMatchObject({ status: '', created_at: '' });
  });
  it('preserves explicit creation timestamps and independent provider status', async () => {
    apiFetchMock.mockResolvedValue({ ...receipt(), created_at: '2026-09-23T12:00:00Z', metadata: { payment: { mp_status: 'approved' } } });
    expect(await apiClient.adminGetOrder('qa-order', id)).toMatchObject({ created_at: '2026-09-23T12:00:00Z', metadata: { payment: { mp_status: 'approved' } } });
  });
});
