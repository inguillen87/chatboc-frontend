import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantProvider, useTenant } from '@/context/TenantContext';
import { ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { TenantShell } from './TenantShell';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), navigation: vi.fn(), followed: vi.fn(), anon: vi.fn() }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/api/tenant', () => ({
  getTenantPublicInfoFlexible: mocks.profile,
  getTenantPublicNavigation: mocks.navigation,
  listFollowedTenants: mocks.followed,
  followTenant: vi.fn(),
  unfollowTenant: vi.fn(),
}));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: mocks.anon }));
vi.mock('./TenantSwitcher', () => ({ TenantSwitcher: () => null }));

const neutralTitle = 'No pudimos cargar este espacio en este momento.';
const failure = (status = 500, message = 'Internal server error', requestId = 'qa-request-a') =>
  new ApiError(message, status, null, requestId);
const profile = (slug = 'qa-a') => ({ slug, nombre: `Espacio ${slug}`, tipo: 'municipio' });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const retries = () => screen.getAllByRole('button', { name: 'Reintentar', exact: true });
const retry = () => retries()[0];

function Page() {
  const { currentSlug } = useTenant();
  return <TenantShell><p>Contenido publicado {currentSlug}</p></TenantShell>;
}
function Controls() {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate('/t/qa-a')}>Ver espacio A</button>
    <button onClick={() => navigate('/t/qa-b')}>Ver espacio B</button>
    <label>Editor externo<textarea /></label>
  </>;
}
function mountPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/t/qa-a']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TenantProvider><Controls /><Page /></TenantProvider>
    </MemoryRouter>
  </QueryClientProvider>);
  return { ...view, client };
}

beforeEach(() => {
  safeLocalStorage.clear();
  useTenantStore.getState().clearTenant();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  mocks.profile.mockReset().mockRejectedValue(failure());
  mocks.navigation.mockReset().mockResolvedValue({ contract_version: 'tenant.public_navigation.v1', items: [] });
  mocks.followed.mockReset().mockResolvedValue([]);
  mocks.anon.mockReset().mockResolvedValue('qa-synthetic-visitor');
  window.history.replaceState({}, '', '/t/qa-a');
});
afterEach(() => {
  cleanup();
  safeLocalStorage.clear();
  useTenantStore.getState().clearTenant();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  window.history.replaceState({}, '', '/');
});

describe('TenantShell profile availability', () => {
  it.each([
    [500, 'Internal server error', 'qa-500'],
    [404, 'Not found', 'qa-404'],
    [404, 'tenant_resolution_failed', 'qa-resolution'],
  ])('presents a neutral recovery for status %s and preserves its diagnostic %s', async (status, message, requestId) => {
    mocks.profile.mockRejectedValue(failure(status as number, message as string, requestId as string));
    mountPage();
    await screen.findByText(`${message} (Req ID: ${requestId})`);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: neutralTitle })).toBeInTheDocument();
    expect(screen.queryByText('No encontramos informacion para este espacio.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(retries()).toHaveLength(1);
    expect(screen.queryByText('Contenido publicado qa-a')).not.toBeInTheDocument();
    expect(mocks.navigation).not.toHaveBeenCalled();
  });

  it('announces initial loading without inventing an absent or failed profile', async () => {
    mocks.profile.mockReturnValue(new Promise(() => {}));
    await act(async () => { mountPage(); });
    expect(screen.getByRole('status', { name: 'Cargando espacio' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(neutralTitle)).not.toBeInTheDocument();
    expect(screen.queryByText('No encontramos informacion para este espacio.')).not.toBeInTheDocument();
  });

  it('keeps a successfully loaded public profile and its content unchanged', async () => {
    mocks.profile.mockResolvedValue(profile());
    mountPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Espacio qa-a' })).toBeInTheDocument();
    expect(screen.getByText('Contenido publicado qa-a')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the keyboard retry focused while pending, blocks duplicates and recovers through another error to success', async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    mocks.profile.mockRejectedValueOnce(failure()).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(profile());
    mountPage();
    await screen.findByText('Internal server error (Req ID: qa-request-a)');
    const button = retry();
    const user = userEvent.setup();
    act(() => button.focus());
    await user.keyboard('{Enter}');
    expect(retries()).toHaveLength(1);
    expect(retry()).toBe(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando espacio');
    expect(screen.queryByText('Contenido publicado qa-a')).not.toBeInTheDocument();
    await user.keyboard('{Enter} ');
    fireEvent.click(button);
    expect(mocks.profile).toHaveBeenCalledTimes(2);
    await act(async () => { pending.reject(failure(500, 'Servicio temporalmente no disponible', 'qa-retry')); });
    expect(await screen.findByText('Servicio temporalmente no disponible (Req ID: qa-retry)')).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await user.keyboard(' ');
    const title = await screen.findByRole('heading', { level: 1, name: 'Espacio qa-a' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByText('Contenido publicado qa-a')).toBeInTheDocument();
    expect(mocks.profile).toHaveBeenCalledTimes(3);
  });

  it('starts only one refresh for a same-tick burst of retry activation', async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    mocks.profile.mockRejectedValueOnce(failure()).mockReturnValueOnce(pending.promise);
    mountPage();
    await screen.findByText('Internal server error (Req ID: qa-request-a)');
    const button = retry();
    act(() => { fireEvent.click(button); fireEvent.click(button); fireEvent.click(button); });
    expect(mocks.profile).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(profile()); });
    expect(await screen.findByRole('heading', { level: 1, name: 'Espacio qa-a' })).toBeInTheDocument();
  });

  it('preserves an external editor and its selection when focus leaves the pending retry', async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    mocks.profile.mockRejectedValueOnce(failure()).mockReturnValueOnce(pending.promise);
    mountPage();
    await screen.findByText('Internal server error (Req ID: qa-request-a)');
    const user = userEvent.setup();
    act(() => retry().focus()); await user.keyboard('{Enter}');
    const editor = screen.getByRole('textbox', { name: 'Editor externo' }) as HTMLTextAreaElement;
    act(() => { editor.focus(); }); fireEvent.change(editor, { target: { value: 'Borrador que sigue editándose' } });
    editor.setSelectionRange(3, 9);
    await act(async () => { pending.resolve(profile()); });
    await screen.findByRole('heading', { level: 1, name: 'Espacio qa-a' });
    expect(editor).toHaveFocus();
    expect(editor).toHaveValue('Borrador que sigue editándose');
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([3, 9]);
  });

  it('does not capture external focus when retry is invoked programmatically', async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    mocks.profile.mockRejectedValueOnce(failure()).mockReturnValueOnce(pending.promise);
    mountPage();
    await screen.findByText('Internal server error (Req ID: qa-request-a)');
    const editor = screen.getByRole('textbox', { name: 'Editor externo' });
    act(() => editor.focus());
    fireEvent.click(retry());
    await act(async () => { pending.resolve(profile()); });
    await screen.findByRole('heading', { level: 1, name: 'Espacio qa-a' });
    expect(editor).toHaveFocus();
  });

  it.each(['error', 'success'] as const)('respects deliberate blur to the page during a pending retry that ends in %s', async result => {
    const pending = deferred<ReturnType<typeof profile>>();
    mocks.profile.mockRejectedValueOnce(failure()).mockReturnValueOnce(pending.promise);
    mountPage();
    await screen.findByText('Internal server error (Req ID: qa-request-a)');
    await userEvent.setup().click(retry());
    const button = retry();
    expect(button).toHaveFocus();
    act(() => button.blur());
    expect(document.body).toHaveFocus();
    await act(async () => {
      if (result === 'success') pending.resolve(profile());
      else pending.reject(failure(500, 'Reintento no disponible', 'qa-blur'));
    });
    if (result === 'success') await screen.findByRole('heading', { level: 1, name: 'Espacio qa-a' });
    else await screen.findByText('Reintento no disponible (Req ID: qa-blur)');
    expect(document.body).toHaveFocus();
  });

  it('retires retry ownership through A to B to A so late completions cannot unlock or focus the current attempt', async () => {
    const oldA = deferred<ReturnType<typeof profile>>();
    const oldB = deferred<ReturnType<typeof profile>>();
    const newA = deferred<ReturnType<typeof profile>>();
    const reads = { 'qa-a': 0, 'qa-b': 0 };
    mocks.profile.mockImplementation((slug: 'qa-a' | 'qa-b') => {
      reads[slug] += 1;
      if (slug === 'qa-a' && reads[slug] === 2) return oldA.promise;
      if (slug === 'qa-b' && reads[slug] === 2) return oldB.promise;
      if (slug === 'qa-a' && reads[slug] === 4) return newA.promise;
      return Promise.reject(failure(500, `Perfil ${slug} no disponible`, `qa-${slug}-${reads[slug]}`));
    });
    mountPage();
    const user = userEvent.setup();
    await screen.findByText('Perfil qa-a no disponible (Req ID: qa-qa-a-1)');
    await user.click(retry());
    await user.click(screen.getByRole('button', { name: 'Ver espacio B' }));
    await screen.findByText('Perfil qa-b no disponible (Req ID: qa-qa-b-1)');
    expect(retry()).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(retry());
    await user.click(screen.getByRole('button', { name: 'Ver espacio A' }));
    await screen.findByText('Perfil qa-a no disponible (Req ID: qa-qa-a-3)');
    await user.click(retry());
    const currentButton = retry();
    await act(async () => { oldA.resolve(profile('qa-a')); oldB.resolve(profile('qa-b')); });
    expect(currentButton).toHaveAttribute('aria-disabled', 'true');
    expect(currentButton).toHaveFocus();
    expect(screen.queryByRole('heading', { level: 1, name: /Espacio qa-/ })).not.toBeInTheDocument();
    expect(reads).toEqual({ 'qa-a': 4, 'qa-b': 2 });
    await act(async () => { newA.reject(failure(500, 'Todavía no disponible', 'qa-new-a')); });
    expect(await screen.findByText('Todavía no disponible (Req ID: qa-new-a)')).toBeInTheDocument();
    expect(currentButton).not.toHaveAttribute('aria-disabled', 'true');
    expect(currentButton).toHaveFocus();
  });

  it('does not restore focus after unmount or replay a pending refresh', async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    mocks.profile.mockRejectedValueOnce(failure()).mockReturnValueOnce(pending.promise);
    const view = mountPage();
    await screen.findByText('Internal server error (Req ID: qa-request-a)');
    await userEvent.setup().click(retry());
    view.unmount();
    const outside = document.createElement('button'); document.body.appendChild(outside); outside.focus();
    try {
      await act(async () => { pending.resolve(profile()); });
      expect(outside).toHaveFocus();
      expect(mocks.profile).toHaveBeenCalledTimes(2);
    } finally { outside.remove(); }
  });
});
