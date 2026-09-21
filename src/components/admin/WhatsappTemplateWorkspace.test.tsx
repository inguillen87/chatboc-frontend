import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {apiFetch, ApiError} from '@/utils/api';
import copy from '../../../tests/fixtures/template-workspace-ui.json';
import WhatsappTemplatePacksPanel from './WhatsappTemplatePacksPanel';
import {readTemplateCatalog} from './whatsappTemplatePackContract';
import {readTemplateWorkspaceUI} from './templateWorkspaceUI';
vi.mock('@/utils/api', async original => ({...(await original<typeof import('@/utils/api')>()), apiFetch: vi.fn()}));
const api = vi.mocked(apiFetch);
const template = (name: string, body: string, state = 'local_draft') => ({name, intent: name, intent_label: name,
  materialized: false, preview: {body}, blockers: [], lifecycle: {state, production_send_allowed: state === 'approved'}});
const fixture = () => ({contract_version: 'whatsapp.template_pack.catalog.v1', catalog_version: '2026.07.30',
  tenant: {id: 1, slug: 'tenant-a'}, provider_calls_performed: false,
  capabilities: {read: true, materialize_local_draft: true},
  endpoints: {materialize_template: '/api/admin/whatsapp/template-packs/{vertical}/drafts'},
  frontend_contract: {workspace_ui: copy, copy: {title: 'Legacy'},
    lifecycle_labels: {local_draft: 'Borrador local', approved: 'Aprobada', rejected: 'Rechazada', unverified: 'Sin verificación'}},
  packs: [{vertical: 'municipio', pack_id: 'municipal-v1', pack_version: '1.0', label: 'Municipio',
    templates: [template('confirmacion', 'La gestión continúa'), template('pago', 'Revisá el pago', 'approved')]},
    {vertical: 'empresa', pack_id: 'business-v1', pack_version: '1.0', label: 'Empresa',
    templates: [template('pedido', 'Tu pedido está en preparación')]}]});
const show = () => render(<WhatsappTemplatePacksPanel tenantSlug="tenant-a"/>);
const loaded = () => screen.findByRole('searchbox', {name: copy.search_label});
beforeEach(() => api.mockReset().mockResolvedValue(fixture()));
afterEach(cleanup);

describe('template workspace for operators', () => {
  it('searches content and names without accent or case sensitivity and without requests', async () => {
    show(); const input = await loaded(); fireEvent.change(input, {target: {value: 'GESTION'}});
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('1 de 2 plantillas')).toBeVisible();
    fireEvent.change(input, {target: {value: 'pago'}});
    expect(screen.getByText('Revisá el pago')).toBeVisible(); expect(api).toHaveBeenCalledTimes(1);
  });
  it('keeps a zero-result lifecycle filter after a refresh changes the last matching item', async () => {
    show(); await loaded(); fireEvent.change(screen.getByLabelText(copy.state_label), {target: {value: 'approved'}});
    const next = fixture(); next.packs[0].templates[1].lifecycle = {state: 'rejected', production_send_allowed: false};
    api.mockResolvedValueOnce(next); fireEvent.click(screen.getByRole('button', {name: copy.refresh}));
    await screen.findByText(copy.no_results);
    expect(screen.getByLabelText(copy.state_label)).toHaveValue('approved');
    expect(screen.getByText('0 de 2 plantillas')).toBeVisible();
    expect(screen.queryByRole('article')).toBeNull();
  });
  it('clears query and lifecycle together without fetching another catalog', async () => {
    show(); const input = await loaded(); fireEvent.change(input, {target: {value: 'missing'}});
    fireEvent.change(screen.getByLabelText(copy.state_label), {target: {value: 'approved'}});
    fireEvent.click(screen.getByRole('button', {name: copy.clear_filters}));
    expect(input).toHaveValue(''); expect(screen.getByLabelText(copy.state_label)).toHaveValue('');
    expect(screen.getAllByRole('article')).toHaveLength(2); expect(api).toHaveBeenCalledTimes(1);
  });
  it('requires confirmation for the entire pack even when only one template is visible', async () => {
    show(); const input = await loaded(); fireEvent.change(input, {target: {value: 'pago'}});
    fireEvent.click(screen.getByRole('button', {name: copy.create}));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(copy.confirm_description); expect(dialog).toHaveTextContent('tenant-a');
    expect(api).toHaveBeenCalledTimes(1);
    const catalog = fixture(); api.mockResolvedValueOnce({ok: true, provider_calls_performed: false, tenant: catalog.tenant,
      pack: {...catalog.packs[0], templates: catalog.packs[0].templates.map(item => ({...item, materialized: true}))}});
    fireEvent.click(within(dialog).getByRole('button', {name: copy.confirm_action}));
    await screen.findByRole('button', {name: copy.created});
    expect(api.mock.calls[1][0]).toBe('/api/admin/whatsapp/template-packs/municipio/drafts');
    expect(api.mock.calls[1][1]?.body).toEqual({pack_version: '1.0'});
    expect(api.mock.calls[1][1]?.headers).toHaveProperty('Idempotency-Key');
    expect(screen.getByRole('button', {name: copy.created})).toBeDisabled();
  });
  it('cancels confirmation without creating or requesting anything', async () => {
    show(); await loaded(); fireEvent.click(screen.getByRole('button', {name: copy.create}));
    fireEvent.click(screen.getByRole('button', {name: copy.cancel}));
    expect(screen.queryByRole('alertdialog')).toBeNull(); expect(api).toHaveBeenCalledTimes(1);
  });
  it('never grants mutation from presentation copy or a canManage prop', async () => {
    const data = fixture(); data.capabilities.materialize_local_draft = false; api.mockResolvedValueOnce(data);
    render(<WhatsappTemplatePacksPanel tenantSlug="tenant-a" canManage/>); await loaded();
    expect(screen.queryByRole('button', {name: copy.create})).toBeNull();
  });
  it('counts an unsupported approval as unverified, not as approved', async () => {
    const data = fixture(); data.packs[0].templates[1].lifecycle.production_send_allowed = false; api.mockResolvedValueOnce(data);
    show(); await loaded();
    expect(screen.getByRole('option', {name: 'Aprobada (0)'})).toBeInTheDocument();
    expect(within(screen.getAllByRole('article')[1]).getByText(copy.unverified)).toBeVisible();
  });
  it('keeps read-only stale previews while disabling creation until a verified refresh', async () => {
    show(); await loaded(); api.mockRejectedValueOnce(new Error('temporary'));
    fireEvent.click(screen.getByRole('button', {name: copy.refresh})); await screen.findByRole('alert');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('button', {name: copy.create})).toBeDisabled();
    expect(screen.getByText(copy.stale)).toBeVisible();
  });
  it('resets filter, query and pending confirmation when moving to another organization', async () => {
    const view = show(); const input = await loaded(); fireEvent.change(input, {target: {value: 'pago'}});
    fireEvent.click(screen.getByRole('button', {name: copy.create}));
    const next = fixture(); next.tenant = {id: 2, slug: 'tenant-b'}; api.mockResolvedValueOnce(next);
    view.rerender(<WhatsappTemplatePacksPanel tenantSlug="tenant-b"/>);
    expect(await loaded()).toHaveValue(''); expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(2); expect(api).toHaveBeenCalledTimes(2);
  });
  it('rejects a malformed published workspace instead of falling back to unconfirmed creation', () => {
    const data = fixture(); data.frontend_contract.workspace_ui = {...copy, confirm_description: ''};
    expect(() => readTemplateCatalog(data, 'tenant-a')).toThrow();
  });
  it('accepts old catalogs without opting them into the new UI', () => {
    const data = fixture(); delete (data.frontend_contract as {workspace_ui?: unknown}).workspace_ui;
    expect(readTemplateCatalog(data, 'tenant-a').frontend_contract?.workspace_ui).toBeUndefined();
  });
  it('validates message placeholders and rejects Unicode control characters', () => {
    expect(readTemplateWorkspaceUI(copy)?.title).toBe(copy.title);
    for (const change of [{results: '{total}'}, {results: '{visible} {total} {extra}'}, {title: '\u0000invalid'}, {contract_version: 'unknown'}])
      expect(readTemplateWorkspaceUI({...copy, ...change})).toBeNull();
  });
});
