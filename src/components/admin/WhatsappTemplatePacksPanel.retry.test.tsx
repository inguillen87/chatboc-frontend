import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '@/utils/api';
import WhatsappTemplatePacksPanel from './WhatsappTemplatePacksPanel';
import { DRAFT_PATH, type TemplatePack, type TemplatePackCatalog } from './whatsappTemplatePackContract';

vi.mock('@/utils/api', async () => ({
  ...await vi.importActual<typeof import('@/utils/api')>('@/utils/api'),
  apiFetch: vi.fn(),
}));
const api = vi.mocked(apiFetch);
const pack = (overrides: Partial<TemplatePack> = {}): TemplatePack => ({
  vertical: 'municipio', pack_id: 'municipio_v1', pack_version: '1.0.0', label: 'Municipio',
  templates: [{ name: 'municipio_confirmation', materialized: false,
    lifecycle: { state: 'local_draft', production_send_allowed: false }, blockers: [],
    preview: { body: 'Contenido municipio' } }],
  ...overrides,
});
const catalog = (packs: TemplatePack[] = [pack()]): TemplatePackCatalog => ({
  contract_version: 'whatsapp.template_pack.catalog.v1', catalog_version: '1',
  tenant: { id: 1, slug: 'org-a' }, capabilities: { read: true, materialize_local_draft: true },
  endpoints: { materialize_template: DRAFT_PATH }, packs,
  frontend_contract: {
    copy: { title: 'Plantillas org-a', materialize: 'Crear borradores', materialized: 'Borradores creados' },
    lifecycle_labels: { local_draft: 'Borrador', approved: 'Aprobada', unverified: 'Sin verificar' },
  },
});
const receipt = (source: TemplatePackCatalog, selected: TemplatePack = source.packs[0]) => ({
  ok: true, provider_calls_performed: false, tenant: source.tenant,
  pack: { ...selected, templates: selected.templates.map((item) => ({ ...item, materialized: true })) },
});
const posts = () => api.mock.calls.filter(([, options]) => options?.method === 'POST');
const open = async () => {
  render(<WhatsappTemplatePacksPanel tenantSlug="org-a" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Crear borradores' }));
};
const refresh = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Crear borradores' })).toBeEnabled());
};
const confirmRetry = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Crear borradores' }));
  await screen.findByRole('button', { name: 'Borradores creados' });
};
const expectSameKey = () => {
  const writes = posts();
  expect(writes).toHaveLength(2);
  const originalKey = writes[0][1]?.headers?.['Idempotency-Key'];
  expect(originalKey).toEqual(expect.any(String));
  expect(writes[1][1]?.headers?.['Idempotency-Key']).toBe(originalKey);
};
const expectDifferentKeys = () => {
  const writes = posts();
  expect(writes).toHaveLength(2);
  const originalKey = writes[0][1]?.headers?.['Idempotency-Key'];
  const nextKey = writes[1][1]?.headers?.['Idempotency-Key'];
  expect(originalKey).toEqual(expect.any(String));
  expect(nextKey).toEqual(expect.any(String));
  expect(nextKey).not.toBe(originalKey);
};
beforeEach(() => api.mockReset());
afterEach(() => cleanup());

describe('draft recovery keeps operation identity, never stale write authority', () => {
  it.each([400, 401, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504])(
    'retains the key after HTTP %i and requires refresh plus an explicit retry', async (status) => {
      const source = catalog();
      api.mockResolvedValueOnce(source).mockRejectedValueOnce(new ApiError('Request failed', status))
        .mockResolvedValueOnce(source).mockResolvedValueOnce(receipt(source));
      await open(); await screen.findByRole('alert');
      expect(posts()).toHaveLength(1);
      const create = screen.queryByRole('button', { name: 'Crear borradores' });
      if (create) expect(create).toBeDisabled();
      await refresh();
      expect(posts()).toHaveLength(1);
      await confirmRetry();
      expectSameKey();
      expect(screen.getByRole('status')).toHaveTextContent('no envía mensajes');
    },
  );

  it('keeps an uncertain write identity across a denied read without exposing its old data', async () => {
    const source = catalog();
    api.mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('response lost'))
      .mockRejectedValueOnce(new ApiError('Acceso revocado', 403))
      .mockResolvedValueOnce(source).mockResolvedValueOnce(receipt(source));
    await open(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Acceso revocado'));
    expect(screen.queryByText('Contenido municipio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear borradores' })).not.toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    await refresh(); await confirmRetry(); expectSameKey();
  });

  it('keeps an uncertain key across a mismatched catalogue while rejecting foreign content', async () => {
    const source = catalog();
    const foreign = { ...source, tenant: { id: 2, slug: 'org-b' } };
    api.mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(foreign).mockResolvedValueOnce(source).mockResolvedValueOnce(receipt(source));
    await open(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No pudimos verificar'));
    expect(screen.queryByText('Contenido municipio')).not.toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    await refresh(); await confirmRetry(); expectSameKey();
  });

  it('does not share a key between two vertical endpoints with the same pack metadata', async () => {
    const first = pack({ pack_id: 'shared', pack_version: '1' });
    const second = pack({ vertical: 'empresa', label: 'Empresa', pack_id: 'shared', pack_version: '1',
      templates: [{ name: 'empresa_confirmation', materialized: false, preview: { body: 'Contenido empresa' } }] });
    const source = catalog([first, second]);
    api.mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(source).mockResolvedValueOnce(receipt(source, second));
    await open(); await screen.findByRole('alert'); await refresh();
    fireEvent.change(screen.getByLabelText('Conjunto de plantillas'), { target: { value: 'empresa' } });
    await confirmRetry(); expectDifferentKeys();
    expect(posts()[1][1]?.headers?.['Idempotency-Key']).toMatch(/^template-pack:empresa:/);
  });

  it('cannot collide when a colon moves between pack ID and version', async () => {
    const original = catalog([pack({ pack_id: 'shared:part', pack_version: '1' })]);
    const replacement = catalog([pack({ pack_id: 'shared', pack_version: 'part:1' })]);
    api.mockResolvedValueOnce(original).mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(replacement).mockResolvedValueOnce(receipt(replacement));
    await open(); await screen.findByRole('alert');
    await refresh(); await confirmRetry(); expectDifferentKeys();
  });

  it('normalizes number/string representations of the same verified tenant ID', async () => {
    const source = catalog();
    const refreshed = { ...source, tenant: { id: '1', slug: 'org-a' } };
    api.mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(refreshed).mockResolvedValueOnce(receipt(refreshed));
    await open(); await screen.findByRole('alert');
    await refresh(); await confirmRetry(); expectSameKey();
  });

  it('does not transfer an uncertain key to a different verified tenant ID', async () => {
    const source = catalog();
    const replacement = { ...source, tenant: { id: 2, slug: 'org-a' } };
    api.mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(replacement).mockResolvedValueOnce(receipt(replacement));
    await open(); await screen.findByRole('alert');
    await refresh(); await confirmRetry(); expectDifferentKeys();
  });

  it('releases a key only after a matching receipt before a new server-verified operation', async () => {
    const source = catalog();
    api.mockResolvedValueOnce(source).mockResolvedValueOnce(receipt(source))
      .mockResolvedValueOnce(source).mockResolvedValueOnce(receipt(source));
    await open(); await screen.findByRole('button', { name: 'Borradores creados' });
    await refresh(); await confirmRetry(); expectDifferentKeys();
  });
});
