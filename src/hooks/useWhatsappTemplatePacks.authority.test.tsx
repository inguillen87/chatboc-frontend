import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '@/utils/api';
import { useWhatsappTemplatePacks } from './useWhatsappTemplatePacks';
import { DRAFT_PATH, type TemplatePackCatalog } from '@/components/admin/whatsappTemplatePackContract';

vi.mock('@/utils/api', async () => ({
  ...await vi.importActual<typeof import('@/utils/api')>('@/utils/api'), apiFetch: vi.fn(),
}));
const api = vi.mocked(apiFetch);
const source = (): TemplatePackCatalog => ({
  contract_version: 'whatsapp.template_pack.catalog.v1', catalog_version: '1',
  tenant: { id: 1, slug: 'org-a' },
  capabilities: { read: true, materialize_local_draft: true },
  endpoints: { materialize_template: DRAFT_PATH },
  packs: [{ vertical: 'municipio', pack_id: 'local-pack', pack_version: '1',
    templates: [{ name: 'local-confirmation', materialized: false, preview: { body: 'Test only' } }] }],
});
const receipt = (catalog: TemplatePackCatalog) => ({
  ok: true, provider_calls_performed: false, tenant: catalog.tenant,
  pack: { ...catalog.packs[0], templates: catalog.packs[0].templates.map(t => ({ ...t, materialized: true })) },
});
const posts = () => api.mock.calls.filter(([, options]) => options?.method === 'POST');
const mount = async (catalog = source()) => {
  api.mockResolvedValueOnce(catalog);
  const hook = renderHook(() => useWhatsappTemplatePacks('org-a'));
  await waitFor(() => expect(hook.result.current.canMaterialize).toBe(true));
  return { ...hook, catalog };
};
beforeEach(() => { api.mockReset(); });
afterEach(() => { cleanup(); });

describe('synchronous authority for WhatsApp draft operations', () => {
  it('blocks a retained writer immediately after an uncertain POST settles', async () => {
    const { result, catalog } = await mount();
    const retained = result.current.materialize;
    const selected = result.current.catalog!.packs[0];
    expect(result.current.catalog).toBe(catalog);
    expect(result.current.error).toBeNull();
    let reject!: (reason: Error) => void;
    api.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    let first!: Promise<void>;
    act(() => { first = retained(selected); });
    expect(posts(), result.current.error || 'The authorized first POST must start').toHaveLength(1);
    await act(async () => {
      reject(new Error('lost response'));
      await first;
      await retained(selected);
    });
    expect(posts()).toHaveLength(1);
    expect(result.current.canMaterialize).toBe(false);
  });
  it('does not create a second operation after a verified receipt using the retained callback', async () => {
    const { result, catalog } = await mount();
    const retained = result.current.materialize;
    const selected = result.current.catalog!.packs[0];
    expect(result.current.catalog).toBe(catalog);
    expect(result.current.error).toBeNull();
    let resolve!: (value: unknown) => void;
    api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    let first!: Promise<void>;
    act(() => { first = retained(selected); });
    expect(posts(), result.current.error || 'The authorized first POST must start').toHaveLength(1);
    await act(async () => {
      resolve(receipt(catalog));
      await first;
      await retained(selected);
    });
    expect(posts()).toHaveLength(1);
    expect(result.current.catalog?.packs[0].templates[0].materialized).toBe(true);
  });
  it('blocks a retained writer when a refresh failed without removing the stale preview', async () => {
    const { result, catalog } = await mount();
    const retained = result.current.materialize;
    api.mockRejectedValueOnce(new Error('read unavailable'));
    await act(async () => { await result.current.refresh(); });
    await act(async () => { await retained(catalog.packs[0]); });
    expect(posts()).toHaveLength(0);
    expect(result.current.catalog).toBe(catalog);
    expect(result.current.error).not.toBeNull();
  });
  it('requires the currently displayed pack after a newer catalogue with the same version', async () => {
    const { result, catalog } = await mount();
    const latest = structuredClone(catalog);
    latest.packs[0].templates[0].preview = { body: 'Changed backend definition' };
    api.mockResolvedValueOnce(latest);
    await act(async () => { await result.current.refresh(); });
    await act(async () => { await result.current.materialize(catalog.packs[0]); });
    expect(posts()).toHaveLength(0);
    api.mockResolvedValueOnce(receipt(latest));
    await act(async () => { await result.current.materialize(result.current.catalog!.packs[0]); });
    expect(posts()).toHaveLength(1);
  });
  it('keeps the uncertain operation key after fresh authorized reading and explicit retry', async () => {
    const { result, catalog } = await mount();
    api.mockRejectedValueOnce(new Error('write response lost'));
    await act(async () => { await result.current.materialize(catalog.packs[0]); });
    const latest = structuredClone(catalog);
    api.mockResolvedValueOnce(latest);
    await act(async () => { await result.current.refresh(); });
    expect(posts()).toHaveLength(1);
    api.mockResolvedValueOnce(receipt(latest));
    await act(async () => { await result.current.materialize(result.current.catalog!.packs[0]); });
    expect(posts()).toHaveLength(2);
    expect(posts()[1][1]?.headers?.['Idempotency-Key']).toBe(posts()[0][1]?.headers?.['Idempotency-Key']);
  });
  it('does not let an old refresh callback start a request after unmount', async () => {
    const { result, unmount } = await mount();
    const retained = result.current.refresh; unmount();
    await act(async () => { await retained(); });
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('does not let a writer kept by an old screen run after unmount', async () => {
    const { result, unmount, catalog } = await mount();
    const retained = result.current.materialize; unmount();
    await act(async () => { await retained(catalog.packs[0]); });
    expect(posts()).toHaveLength(0);
  });
  it('keeps explicit tenant scope without persisting the panel as global tenant selection', async () => {
    const { result, catalog } = await mount();
    api.mockResolvedValueOnce(receipt(catalog));
    await act(async () => { await result.current.materialize(catalog.packs[0]); });
    for (const [, options] of api.mock.calls) {
      expect(options).toEqual(expect.objectContaining({ tenantSlug: 'org-a', persistTenantSlug: false }));
    }
  });
  it('withdraws authority and private preview after access is revoked', async () => {
    const { result, catalog } = await mount();
    const retained = result.current.materialize;
    api.mockRejectedValueOnce(new ApiError('Denied', 403));
    await act(async () => { await result.current.refresh(); });
    await act(async () => { await retained(catalog.packs[0]); });
    expect(result.current.catalog).toBeNull(); expect(posts()).toHaveLength(0);
  });
  it('does not resurrect an old pack after a malformed receipt', async () => {
    const { result, catalog } = await mount();
    const retained = result.current.materialize; api.mockResolvedValueOnce({ ok: true });
    await act(async () => { await retained(catalog.packs[0]); await retained(catalog.packs[0]); });
    expect(posts()).toHaveLength(1); expect(result.current.catalog).toBeNull(); expect(result.current.notice).toBeNull();
  });
});
