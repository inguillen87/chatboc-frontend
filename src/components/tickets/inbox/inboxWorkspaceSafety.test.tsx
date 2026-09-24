import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmnichannelInboxItem } from '@/api/v2/saas';
const mocks = vi.hoisted(() => ({ tenant: 'org-a' as string | null, list: vi.fn(), detail: vi.fn(), post: vi.fn(), legacy: vi.fn() }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: mocks.tenant }) }));
vi.mock('@/services/ticketService', () => ({ getTickets: mocks.legacy }));
vi.mock('@/api/v2/saas', async () => ({ ...await vi.importActual<typeof import('@/api/v2/saas')>('@/api/v2/saas'), getOmnichannelInboxV2: mocks.list, getOmnichannelInboxDetailV2: mocks.detail, postOmnichannelInboxActionV2: mocks.post, createOmnichannelReplyClientMessageId: () => 'crm-reply:qa-inbox-00000001' }));
import { ApiError } from '@/utils/api';
import { TicketInboxPage } from './TicketInboxPage';
import { TicketConversationPane } from './TicketConversationPane';
const ticket = (id = 'municipio:12', extra: Partial<OmnichannelInboxItem> = {}): OmnichannelInboxItem => ({ id, tenant_slug: 'org-a', title: 'José luminaria', status: 'nuevo', channel: 'whatsapp', lastMessageAt: '2026-09-23T12:00:00Z', unreadCount: 2, attachments: [], presence: [], timeline: [], actions: [], allowed_actions: [{ id: 'reply', label: 'Responder', requires: ['message'] }], next_steps: [], agent_copilot_suggestions: [], raw: { id, assignee: null }, ...extra });
const second = () => ticket('municipio:13', { title: 'Beatriz árbol', channel: 'web', unreadCount: 0 });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };
const mount = (child: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{child}</QueryClientProvider>) };
};
const pane = () => <TicketConversationPane ticketId={ticket().id} ticket={ticket()} tenantSlug={mocks.tenant} />;
const editor = () => screen.findByRole('textbox', { name: 'Respuesta al contacto' });
beforeEach(() => {
  mocks.tenant = 'org-a'; window.localStorage.clear(); Object.values(mocks).forEach(value => { if (typeof value === 'function' && 'mockReset' in value) value.mockReset(); });
  mocks.list.mockResolvedValue({ items: [ticket(), second()], summary: {}, raw: { tenant_slug: 'org-a' } });
  mocks.detail.mockImplementation((id: string, tenant: string) => Promise.resolve({ item: { ...(id === 'municipio:13' ? second() : ticket()), tenant_slug: tenant }, raw: { tenant_slug: tenant } }));
});
afterEach(cleanup);
describe('inbox workspace and reply safety', () => {
  it('does not query any organization when context is unresolved', () => {
    mocks.tenant = null; mount(<TicketInboxPage />);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.legacy).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it('requires shared admin context to match the displayed organization', () => {
    mount(<TicketInboxPage expectedTenantSlug="org-b" />); expect(mocks.list).not.toHaveBeenCalled();
  });
  it('searches with accents and filters locally without requesting or sending again', async () => {
    mount(<TicketInboxPage />); await screen.findByRole('button', { name: 'Abrir conversación: José luminaria' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'jose' } });
    fireEvent.change(screen.getByLabelText('Canal'), { target: { value: 'whatsapp' } });
    expect(screen.queryByRole('button', { name: 'Abrir conversación: Beatriz árbol' })).not.toBeInTheDocument();
    expect(screen.getByText('1 resultados de 2 conversaciones cargadas.')).toBeVisible();
    expect(mocks.list).toHaveBeenCalledOnce(); expect(mocks.post).not.toHaveBeenCalled();
  });
  it('removes previous conversations after denied refresh rather than falling back', async () => {
    mount(<TicketInboxPage />); await screen.findByRole('button', { name: 'Abrir conversación: José luminaria' });
    mocks.list.mockRejectedValue(new ApiError('Acceso denegado', 403)); fireEvent.click(screen.getByRole('button', { name: 'Actualizar bandeja' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Abrir conversación: José luminaria' })).not.toBeInTheDocument());
    expect(mocks.legacy).not.toHaveBeenCalled(); expect(screen.queryByRole('textbox', { name: 'Respuesta al contacto' })).not.toBeInTheDocument();
  });
  it('does not make an unavailable detail writable using a list snapshot', async () => {
    mocks.detail.mockRejectedValue(new ApiError('Denegado', 403)); mount(pane());
    await screen.findByText('Conversación no disponible'); expect(screen.queryByRole('textbox')).not.toBeInTheDocument(); expect(mocks.post).not.toHaveBeenCalled();
  });
  it.each([{ allowed_actions: [] }, { allowed_actions: [{ id: 'reply', label: 'Responder', disabled: true }] }])('requires an enabled reply action from the server', async ({ allowed_actions }) => {
    mocks.detail.mockResolvedValue({ item: ticket('municipio:12', { allowed_actions }), raw: null }); mount(pane());
    fireEvent.change(await editor(), { target: { value: 'Texto que no debe enviarse' } });
    expect(screen.getByRole('button', { name: /Enviar mensaje/ })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/ })); expect(mocks.post).not.toHaveBeenCalled();
  });
  it('retains a manual draft when the server refreshes its suggestion', async () => {
    const view = mount(pane()); fireEvent.change(await editor(), { target: { value: 'Borrador manual' } });
    mocks.detail.mockResolvedValue({ item: ticket('municipio:12', { suggested_reply: 'Sugerencia nueva' }), raw: null });
    await act(async () => { await view.client.invalidateQueries({ queryKey: ['inbox-omnichannel-v2-detail'] }); });
    expect(await editor()).toHaveValue('Borrador manual');
  });
  it('blocks a rapid duplicate send and waits for the confirmed receipt', async () => {
    const pending = deferred<{ ticket: OmnichannelInboxItem; raw: null }>(); mocks.post.mockReturnValue(pending.promise); mount(pane());
    fireEvent.change(await editor(), { target: { value: 'Respuesta de prueba' } });
    const send = screen.getByRole('button', { name: /Enviar mensaje/ }); fireEvent.click(send); fireEvent.click(send);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce()); expect(await editor()).toHaveValue('Respuesta de prueba'); expect(await editor()).toBeDisabled();
    await act(async () => { pending.resolve({ ticket: ticket(), raw: null }); });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Respuesta al contacto' })).toHaveValue(''));
  });
  it('asks before losing a draft, and cancellation never sends a message', async () => {
    mount(<TicketInboxPage />); fireEvent.change(await editor(), { target: { value: 'Mi borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversación: Beatriz árbol' }));
    const confirmation = await screen.findByRole('alertdialog'); fireEvent.click(within(confirmation).getByRole('button', { name: 'Seguir editando' }));
    expect(await editor()).toHaveValue('Mi borrador'); expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversación: Beatriz árbol' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Descartar borrador' }));
    await waitFor(() => expect(mocks.detail).toHaveBeenCalledWith('municipio:13', 'org-a', undefined)); expect(await editor()).toHaveValue('');
  });
  it('rejects an explicitly foreign detail even when the numeric part matches', async () => {
    mocks.detail.mockResolvedValue({ item: ticket('municipio:12', { tenant_slug: 'org-b' }), raw: null }); mount(pane());
    await screen.findByText('Conversación no disponible'); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('does not query a detail with missing organization context', () => { mocks.tenant = null; mount(pane()); expect(mocks.detail).not.toHaveBeenCalled(); });
});
