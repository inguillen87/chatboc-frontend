import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '@/utils/api';
import WhatsappTemplatePacksPanel from './WhatsappTemplatePacksPanel';
import { DRAFT_PATH, readTemplateCatalog, displayedTemplateState } from './whatsappTemplatePackContract';
vi.mock('@/utils/api', async () => ({ ...await vi.importActual<typeof import('@/utils/api')>('@/utils/api'), apiFetch: vi.fn() }));
const api = vi.mocked(apiFetch);
const pending = () => { let resolve!: (value: any) => void; const promise = new Promise<any>((accept) => { resolve = accept; }); return { promise, resolve }; };
const pack = (vertical = 'municipio') => ({ vertical, pack_id: `${vertical}_v1`, pack_version: '1.0.0', label: vertical,
  templates: [{ name: `${vertical}_confirmation`, intent_label: 'Confirmación', materialized: false,
    lifecycle: { state: 'local_draft', production_send_allowed: false }, blockers: [], preview: { body: `Contenido ${vertical}` } }] });
const catalog = (scope = 'org-a') => ({ contract_version: 'whatsapp.template_pack.catalog.v1', catalog_version: '1',
  tenant: { id: scope === 'org-a' ? 1 : 2, slug: scope }, capabilities: { read: true, materialize_local_draft: true },
  endpoints: { materialize_template: DRAFT_PATH }, packs: [pack()],
  frontend_contract: { copy: { title: `Plantillas ${scope}`, materialize: 'Crear borradores', materialized: 'Borradores creados' },
    lifecycle_labels: { local_draft: 'Borrador', approved: 'Aprobada', unverified: 'Sin verificar' } } });
const receipt = (source = catalog()) => ({ ok: true, provider_calls_performed: false, tenant: source.tenant,
  pack: { ...source.packs[0], templates: source.packs[0].templates.map((item) => ({ ...item, materialized: true })) } });
const open = async () => { render(<WhatsappTemplatePacksPanel tenantSlug="org-a" />); return screen.findByRole('button', { name: 'Crear borradores' }); };
beforeEach(() => api.mockReset());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('template workspace authority and recovery', () => {
  it('does not infer an organization or request global data', () => {
    render(<WhatsappTemplatePacksPanel />);
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText(/Elegí una organización autorizada/)).toBeVisible();
  });
  it.each(['other-tenant', 'missing-tenant', 'external-endpoint'])('rejects %s before showing content', async (scenario) => {
    const response: any = catalog();
    if (scenario === 'other-tenant') response.tenant.slug = 'org-b';
    if (scenario === 'missing-tenant') delete response.tenant;
    if (scenario === 'external-endpoint') response.endpoints.materialize_template = 'https://untrusted.invalid/{vertical}';
    api.mockResolvedValueOnce(response);
    render(<WhatsappTemplatePacksPanel tenantSlug="org-a" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos verificar/);
    expect(screen.queryByText('Contenido municipio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear borradores' })).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('removes previous previews and controls after a 403', async () => {
    api.mockResolvedValueOnce(catalog()).mockRejectedValueOnce(new ApiError('Acceso revocado', 403));
    await open(); fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso revocado');
    expect(screen.queryByText('Contenido municipio')).not.toBeInTheDocument();
    expect(screen.queryByText('No hay packs disponibles.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear borradores' })).not.toBeInTheDocument();
  });
  it('retains a clearly stale preview, never stale write authority, on a transient failure', async () => {
    api.mockResolvedValueOnce(catalog()).mockRejectedValueOnce(new Error('connection lost'));
    await open(); fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByRole('alert');
    expect(screen.getByText('Contenido municipio')).toBeVisible();
    expect(screen.getByText(/Vista anterior/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Crear borradores' })).toBeDisabled();
  });
  it('ignores an old write even after the same organization is selected again', async () => {
    const oldWrite = pending();
    api.mockResolvedValueOnce(catalog()).mockReturnValueOnce(oldWrite.promise)
      .mockResolvedValueOnce(catalog('org-b')).mockResolvedValueOnce(catalog());
    const { rerender } = render(<WhatsappTemplatePacksPanel tenantSlug="org-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear borradores' }));
    rerender(<WhatsappTemplatePacksPanel tenantSlug="org-b" />);
    await screen.findByText('Plantillas org-b');
    rerender(<WhatsappTemplatePacksPanel tenantSlug="org-a" />);
    await screen.findByText('Plantillas org-a');
    await act(async () => { oldWrite.resolve(receipt()); await oldWrite.promise; });
    expect(screen.queryByRole('button', { name: 'Borradores creados' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear borradores' })).toBeEnabled();
    expect(screen.queryByText(/Borradores confirmados/)).not.toBeInTheDocument();
  });
  it('reuses the idempotency key after an ambiguous write and fresh verification', async () => {
    api.mockResolvedValueOnce(catalog()).mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(catalog()).mockResolvedValueOnce(receipt());
    fireEvent.click(await open()); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear borradores' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Crear borradores' }));
    await screen.findByRole('button', { name: 'Borradores creados' });
    const posts = api.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0][1]?.headers?.['Idempotency-Key']).toBe(posts[1][1]?.headers?.['Idempotency-Key']);
    expect(screen.getByRole('status')).toHaveTextContent('no envía mensajes');
  });
  it.each(['tenant-id', 'version', 'provider'])('does not accept a mismatched %s receipt', async (scenario) => {
    const response = receipt();
    if (scenario === 'tenant-id') response.tenant = { id: 99, slug: 'org-a' };
    if (scenario === 'version') response.pack.pack_version = '2.0.0';
    if (scenario === 'provider') response.provider_calls_performed = true;
    api.mockResolvedValueOnce(catalog()).mockResolvedValueOnce(response);
    fireEvent.click(await open()); await screen.findByRole('alert');
    expect(screen.queryByText(/Borradores confirmados/)).not.toBeInTheDocument();
    expect(screen.queryByText('Contenido municipio')).not.toBeInTheDocument();
  });
  it('prevents double submit and a competing refresh while a write is unresolved', async () => {
    const writing = pending(); api.mockResolvedValueOnce(catalog()).mockReturnValueOnce(writing.promise);
    const button = await open(); fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled();
    expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    await act(async () => { writing.resolve(receipt()); });
    expect(await screen.findByRole('button', { name: 'Borradores creados' })).toBeDisabled();
  });
  it('shows only the selected pack and filters by verified lifecycle', async () => {
    const value = catalog(); value.packs.push(pack('empresa'));
    api.mockResolvedValueOnce(value); await open();
    expect(screen.queryByText('Contenido empresa')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Conjunto de plantillas'), { target: { value: 'empresa' } });
    expect(screen.getByText('Contenido empresa')).toBeVisible();
    expect(screen.queryByText('Contenido municipio')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado de plantilla'), { target: { value: 'local_draft' } });
    expect(screen.getByText('Contenido empresa')).toBeVisible();
  });
  it('ends the local wait without claiming that a slow server operation was cancelled', async () => {
    vi.useFakeTimers(); const response = pending(); api.mockReturnValueOnce(response.promise);
    render(<WhatsappTemplatePacksPanel tenantSlug="org-a" />);
    await act(async () => { vi.advanceTimersByTime(30001); });
    expect(screen.getByRole('alert')).toHaveTextContent(/tardó demasiado/);
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    await act(async () => { response.resolve(catalog()); });
    expect(screen.queryByText('Contenido municipio')).not.toBeInTheDocument();
  });
});

describe('template contract validation', () => {
  it('rejects a duplicate vertical and missing read permission', () => {
    const duplicate = catalog(); duplicate.packs.push(pack());
    expect(() => readTemplateCatalog(duplicate, 'org-a')).toThrow();
    const denied = catalog(); denied.capabilities.read = false;
    expect(() => readTemplateCatalog(denied, 'org-a')).toThrow();
  });
  it('does not show approved when blockers contradict an approved label', () => {
    expect(displayedTemplateState({ name: 'test', lifecycle: { state: 'approved', production_send_allowed: true }, blockers: ['stale'] })).toBe('unverified');
    expect(displayedTemplateState({ name: 'test', lifecycle: { state: 'approved', production_send_allowed: true }, blockers: [] })).toBe('approved');
  });
});
