import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch: mocks.fetch }));
import { commercialFollowUpApi as api } from './commercialFollowUpApi';
const identity = { tenantSlug: 'org-a', ticketType: 'municipio' as const, ticketId: '12' };
const receipt = { ok: true, ticket_id: 12, ticket_type: 'municipio' };
describe('commercial follow-up transport and receipts', () => {
  beforeEach(() => mocks.fetch.mockReset());
  it('uses explicit tenant context for the limited list', async () => {
    mocks.fetch.mockResolvedValue({ tenant_slug: 'org-a', items: [], total: 0 });
    await api.list('org-a');
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/tenants/org-a/leads?limit=100', { tenantSlug: 'org-a' });
  });
  it('writes only the canonical ID and confirms note content', async () => {
    mocks.fetch.mockResolvedValue({ ...receipt, timeline: [{ event: 'tenant_note', note: 'Visitado' }] });
    expect((await api.addNote(identity, ' Visitado '))[0].note).toBe('Visitado');
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/tenants/org-a/leads/municipio/12/timeline', { method: 'POST', body: { note: 'Visitado' }, tenantSlug: 'org-a' });
  });
  it('rejects a 200 without matching note content and does not retry', async () => {
    mocks.fetch.mockResolvedValue({ ...receipt, timeline: [{ event: 'tenant_note', note: 'Otra nota' }] });
    await expect(api.addNote(identity, 'Visitado')).rejects.toThrow();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('requires ok, target identity and the confirmed stage', async () => {
    mocks.fetch.mockResolvedValue({ ...receipt, lead_stage: 'ganado' });
    await api.changeStage(identity, 'ganado', ' Aceptado ');
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/tenants/org-a/leads/municipio/12/stage', { method: 'PATCH', body: { stage: 'ganado', note: 'Aceptado' }, tenantSlug: 'org-a' });
  });
  it.each([401, 403, 404, 409, 500])('never retries a mutation rejected with %s', async (status) => {
    mocks.fetch.mockRejectedValue({ status });
    await expect(api.addNote(identity, 'Visitado')).rejects.toEqual({ status });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a foreign list without returning rows', async () => {
    mocks.fetch.mockResolvedValue({ tenant_slug: 'org-b', items: [] });
    await expect(api.list('org-a')).rejects.toThrow();
  });
  it.each(['', ' ', 'a'.repeat(1001)])('validates the note before any write', async (note) => {
    await expect(api.addNote(identity, note)).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('validates stage and route before any write', async () => {
    await expect(api.changeStage(identity, 'invalid' as 'ganado', 'Motivo')).rejects.toThrow();
    await expect(api.timeline({ ...identity, tenantSlug: '../org-b' })).rejects.toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
