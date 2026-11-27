import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelActivationContract } from '@/api/v2/channelActivation';
import { usePanelSessionStore } from '@/stores/panelSessionStore';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), clerkStatus: 'disabled', profile: { user: { id: 5, rol: 'super_admin', tenant_slug: 'junin' },
  hasVerifiedSession: true, organizationProfileVerified: true, loading: false } }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.profile }));
vi.mock('@/components/access/SessionAuthorityContext', () => ({ useSessionAuthority: () => ({ clerkStatus: mocks.clerkStatus }) }));
vi.mock('@/api/v2/channelActivation', async importOriginal => ({
  ...await importOriginal<typeof import('@/api/v2/channelActivation')>(), fetchTenantChannelActivation: mocks.fetch,
}));
import ChannelActivationChecklist from './ChannelActivationChecklist';

// Synthetic descriptors only; no provider or nominal credentials.
const payload = (slug = 'tierra-del-fuego', href = '/perfil?section=general&source=channels&draft=kept#datos'): ChannelActivationContract => ({
  contract_version: 'tenant.channel_activation.v1', tenant: { id: 46, slug },
  summary: { primary_next_action: { id: 'identity', label: 'Continuar identidad', href, kind: 'link' } },
  channels: [{ id: 'identity_auth', label: 'Identidad institucional', status: 'pending',
    actions: [{ id: 'identity', label: 'Configurar identidad', href, primary: true, kind: 'link' }] }],
});
const deferred = () => {
  let resolve!: (value: ChannelActivationContract) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<ChannelActivationContract>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const view = (slug = 'tierra-del-fuego', session = 'context-a') => (
  <ChannelActivationChecklist tenantSlug={slug} privateGuideSessionKey={session}
    returnTo={`/perfil?section=channels&tenant_slug=${slug}&tab=setup&draft=kept#canales`} />
);
const assertLinks = (slug: string) => {
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  for (const link of links) {
    const url = new URL(link.getAttribute('href')!, 'https://synthetic.invalid');
    expect(url.pathname).toBe('/perfil');
    expect(url.searchParams.get('tenant_slug')).toBe(slug);
    expect(url.searchParams.get('section')).toBe('general');
    expect(url.searchParams.get('source')).toBe('channels');
    expect(url.searchParams.get('draft')).toBe('kept');
    expect(url.hash).toBe('#datos');
    expect(url.searchParams.get('return_to')).toBe(`/perfil?section=channels&tenant_slug=${slug}&tab=setup&draft=kept#canales`);
  }
};
beforeEach(() => {
  mocks.fetch.mockReset(); mocks.clerkStatus = 'disabled'; localStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-panel-a', user: { id: '5', email: '', rol: 'super_admin', tenant_slug: 'junin' } });
  mocks.profile = { user: { id: 5, rol: 'super_admin', tenant_slug: 'junin' }, hasVerifiedSession: true, organizationProfileVerified: true, loading: false };
});
afterEach(() => { cleanup(); usePanelSessionStore.setState({ authToken: null, user: null }); localStorage.clear(); });

describe('channel navigation with current verified activation', () => {
  it.each(['session-unverified', 'profile-unverified', 'profile-loading', 'clerk-loading', 'clerk-syncing'])('does not dispatch or publish initial links when %s', async state => {
    if (state === 'session-unverified') mocks.profile.hasVerifiedSession = false;
    if (state === 'profile-unverified') mocks.profile.organizationProfileVerified = false;
    if (state === 'profile-loading') mocks.profile.loading = true;
    if (state === 'clerk-loading') mocks.clerkStatus = 'loading';
    if (state === 'clerk-syncing') mocks.clerkStatus = 'syncing';
    mocks.fetch.mockResolvedValue(payload());
    const rendered = render(<ChannelActivationChecklist tenantSlug="tierra-del-fuego" initialData={payload()} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(mocks.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled();
    mocks.profile = { ...mocks.profile, hasVerifiedSession: true, organizationProfileVerified: true, loading: false };
    mocks.clerkStatus = 'ready'; rendered.rerender(<ChannelActivationChecklist tenantSlug="tierra-del-fuego" initialData={payload()} />);
    await screen.findByRole('link', { name: 'Continuar identidad' }); expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it('rejects the pending transport 200 if profile authority becomes unverified', async () => {
    const pending = deferred(); mocks.fetch.mockReturnValue(pending.promise);
    const rendered = render(view()); await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    mocks.profile.organizationProfileVerified = false; rendered.rerender(view());
    await act(async () => { pending.resolve(payload()); await pending.promise; });
    expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it.each(['disabled', 'signed_out', 'ready'])('preserves a verified panel session with Clerk status %s', async status => {
    mocks.clerkStatus = status; mocks.fetch.mockResolvedValue(payload()); render(view());
    await screen.findByRole('link', { name: 'Continuar identidad' }); assertLinks('tierra-del-fuego');
  });

  it('does not dispatch an overlong selection even when the descriptor matches it', () => {
    const slug = 'a'.repeat(81); render(<ChannelActivationChecklist tenantSlug={slug} initialData={payload(slug)} />);
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each(['municipio', 'pyme', 'tenant', 'default'])('does not dispatch generic or placeholder selection %s', slug => {
    render(<ChannelActivationChecklist tenantSlug={slug} initialData={payload(slug)} />);
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each(['tierra-del-fuego', 'medico_general'])('binds summary and grid to selected %s while actor belongs to Junin', async slug => {
    mocks.fetch.mockResolvedValue(payload(slug)); render(view(slug));
    await screen.findByRole('link', { name: 'Continuar identidad' }); assertLinks(slug);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledWith(slug, { isCurrent: expect.any(Function) });
  });

  it('does not treat profile initialData as verified navigation authority', async () => {
    const pending = deferred(); mocks.fetch.mockReturnValue(pending.promise);
    render(<ChannelActivationChecklist tenantSlug="tierra-del-fuego" initialData={payload()} />);
    expect(screen.getByText('Identidad institucional')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await act(async () => { pending.resolve(payload()); await pending.promise; });
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('does not fall back to actor or descriptor tenant when selection is missing', () => {
    render(<ChannelActivationChecklist initialData={payload('junin')} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(['/t/junin/integracion', '/perfil?tenant_slug=tierra-del-fuego&tenant=junin',
    '/perfil?endpoint=junin', 'https://foreign.invalid/perfil', '//foreign.invalid/perfil',
    '/perfil?tenant_slug=tierra-del-fuego&tenant_slug=junin'])('blocks foreign or conflicting action %s', async href => {
    mocks.fetch.mockResolvedValue(payload('tierra-del-fuego', href)); render(view());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each(['foreign', 'missing', 'invalid'])('blocks a %s activation envelope even after transport success', async kind => {
    const response = payload();
    if (kind === 'foreign') response.tenant!.slug = 'junin';
    if (kind === 'missing') delete response.tenant;
    if (kind === 'invalid') (response as any).contract_version = 'unknown';
    mocks.fetch.mockResolvedValue(response); render(view());
    await screen.findByText(/no pudimos sincronizar los canales ahora/i);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('retires loaded links on session generation without a parent rerender', async () => {
    const fresh = deferred(); mocks.fetch.mockResolvedValueOnce(payload()).mockReturnValueOnce(fresh.promise);
    render(view()); await screen.findByRole('link', { name: 'Continuar identidad' });
    act(() => { advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    await act(async () => { fresh.resolve(payload()); await fresh.promise; }); assertLinks('tierra-del-fuego');
  });

  it('rejects a pending actor A response after batched A to B to A credential changes', async () => {
    const old = deferred(), fresh = deferred(); mocks.fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    render(view()); await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    const oldCurrent = mocks.fetch.mock.calls[0][1].isCurrent;
    act(() => {
      usePanelSessionStore.setState({ authToken: 'synthetic-panel-b', user: { id: '6', email: '', rol: 'admin', tenant_slug: 'other' } });
      usePanelSessionStore.setState({ authToken: 'synthetic-panel-a', user: { id: '5', email: '', rol: 'super_admin', tenant_slug: 'junin' } });
    });
    expect(oldCurrent()).toBe(false);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    await act(async () => { old.resolve(payload()); await old.promise; });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await act(async () => { fresh.resolve(payload()); await fresh.promise; }); assertLinks('tierra-del-fuego');
  });

  it('rejects pending tenant A after A to B to A and requires the third read', async () => {
    const first = deferred(), second = deferred(), third = deferred();
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    const rendered = render(view()); await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    rendered.rerender(view('medico_general')); await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    rendered.rerender(view()); await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3));
    await act(async () => { first.resolve(payload()); second.resolve(payload('medico_general')); await Promise.all([first.promise, second.promise]); });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await act(async () => { third.resolve(payload()); await third.promise; }); assertLinks('tierra-del-fuego');
  });

  it('retires a loaded descriptor on actor context change even with the same selected tenant', async () => {
    const fresh = deferred(); mocks.fetch.mockResolvedValueOnce(payload()).mockReturnValueOnce(fresh.promise);
    const rendered = render(view()); await screen.findByRole('link', { name: 'Continuar identidad' });
    mocks.profile = { ...mocks.profile, user: { id: 6, rol: 'super_admin', tenant_slug: 'junin' } };
    rendered.rerender(view()); expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  });

  it('retires a loaded descriptor on private context change and does not restore it on failure', async () => {
    const fresh = deferred(); mocks.fetch.mockResolvedValueOnce(payload()).mockReturnValueOnce(fresh.promise);
    const rendered = render(view()); await screen.findByRole('link', { name: 'Continuar identidad' });
    rendered.rerender(view('tierra-del-fuego', 'context-b')); expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await act(async () => { fresh.reject(new Error('synthetic denied')); await fresh.promise.catch(() => {}); });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('prevents an already rendered link click if credential storage changed before a storage event', async () => {
    mocks.fetch.mockResolvedValue(payload()); render(view());
    const link = await screen.findByRole('link', { name: 'Continuar identidad' });
    localStorage.setItem('authProvider', 'clerk');
    expect(fireEvent.click(link)).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it('retires a pending read at unmount and never starts a follow-up', async () => {
    const pending = deferred(); mocks.fetch.mockReturnValue(pending.promise);
    const rendered = render(view()); await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    const isCurrent = mocks.fetch.mock.calls[0][1].isCurrent; rendered.unmount(); expect(isCurrent()).toBe(false);
    await act(async () => { pending.resolve(payload()); await pending.promise; }); expect(mocks.fetch).toHaveBeenCalledOnce();
  });
});
