import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace, reply } from '../../../tests/fixtures/institutional-assistant.synthetic';
import { askWorkspace, loadWorkspace, type KnowledgeAnswer, type KnowledgeWorkspace } from '@/components/knowledge/institutionalAssistantContract';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { usePanelSessionStore } from '@/stores';
import InstitutionalChannelPreview from './InstitutionalChannelPreview';

// Real component, parsers, renderer and store; the two knowledge transports and
// the verified actor/tenant below are synthetic. No provider or session is used.
const authority = vi.hoisted(() => ({
  session: { loading: false, hasVerifiedSession: true, organizationProfileVerified: true,
    user: { id: 42, tenantSlug: 'actor-home', role: 'superadmin' } },
  tenant: { currentSlug: 'qa-office', tenant: { slug: 'qa-office', nombre: 'Institución sintética' },
    isLoadingTenant: false, tenantError: null },
}));
vi.unmock('react-router-dom');
vi.mock('@/hooks/useUser', () => ({ useUser: () => authority.session }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => authority.tenant }));
vi.mock('@/components/knowledge/institutionalAssistantContract', async original => ({
  ...await original<typeof import('@/components/knowledge/institutionalAssistantContract')>(),
  loadWorkspace: vi.fn(), askWorkspace: vi.fn(),
}));
const model = (slug = 'qa-office', name = 'Institución sintética'): KnowledgeWorkspace => workspace({
  visibility: 'public', can_edit: false, tenant: { id: slug === 'qa-office' ? 701 : 702, slug, name },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  return { promise: new Promise<T>((yes, no) => { resolve = yes; reject = no; }), resolve, reject };
};
let navigate: ReturnType<typeof useNavigate>;
function RouteControls() { navigate = useNavigate(); return null; }
const view = () => <>
  <input aria-label="Control anterior" />
  <MemoryRouter initialEntries={['/t/qa-office/integracion']}>
    <RouteControls /><Routes><Route path="/t/:tenant/integracion" element={<InstitutionalChannelPreview />} /></Routes>
  </MemoryRouter>
  <p>Otra tarea no enfocable</p><input aria-label="Otra tarea" />
</>;
const loading = () => screen.getByRole('status');
const result = (mode: 'retry' | 'menu') => screen.getByRole('heading', {
  name: mode === 'retry' ? '¿Sobre qué querés consultar?' : 'Requisitos de la consulta',
});
async function begin(mode: 'retry' | 'menu', beforeActivation?: () => void) {
  const pending = mode === 'retry' ? deferred<KnowledgeWorkspace>() : deferred<KnowledgeAnswer>();
  if (mode === 'retry') vi.mocked(loadWorkspace).mockRejectedValueOnce(new Error('synthetic_failure'))
    .mockReturnValueOnce(pending.promise as Promise<KnowledgeWorkspace>);
  else vi.mocked(loadWorkspace).mockResolvedValueOnce(model());
  if (mode === 'menu') vi.mocked(askWorkspace).mockReturnValueOnce(pending.promise as Promise<KnowledgeAnswer>);
  const mounted = render(view()), user = userEvent.setup();
  const origin = await screen.findByRole('button', { name: mode === 'retry' ? 'Reintentar contenido público' : '1 Consultar requisitos' });
  origin.focus(); beforeActivation?.(); await user.keyboard('{Enter}');
  await waitFor(() => expect(loading()).toHaveFocus());
  const complete = async (outcome: 'success' | 'denial') => act(async () => {
    if (outcome === 'denial') pending.reject(new Error('synthetic_denial'));
    else if (mode === 'retry') (pending as ReturnType<typeof deferred<KnowledgeWorkspace>>).resolve(model());
    else (pending as ReturnType<typeof deferred<KnowledgeAnswer>>).resolve(reply('requirements', model()));
  });
  return { pending, mounted, user, complete };
}
const focusHandlers = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter(([type]) => type === 'focusin' || type === 'focusout');

beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(loadWorkspace).mockReset(); vi.mocked(askWorkspace).mockReset();
  authority.session = { loading: false, hasVerifiedSession: true, organizationProfileVerified: true,
    user: { id: 42, tenantSlug: 'actor-home', role: 'superadmin' } };
  authority.tenant = { currentSlug: 'qa-office', tenant: { slug: 'qa-office', nombre: 'Institución sintética' },
    isLoadingTenant: false, tenantError: null };
  usePanelSessionStore.setState({ authToken: 'synthetic-session-a', user: null });
  advanceChatbocSessionRevision();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in preview focus tests'); }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('institutional preview attempt focus ownership', () => {
  it.each([
    ['retry', 'success'], ['retry', 'denial'], ['menu', 'success'], ['menu', 'denial'],
  ] as const)('retires voluntary BODY blur during %s before %s', async (mode, outcome) => {
    const { complete } = await begin(mode);
    act(() => loading().blur()); expect(document.body).toHaveFocus();
    await complete(outcome);
    expect(outcome === 'success' ? result(mode) : screen.getByRole('alert')).toBeVisible();
    expect(document.body).toHaveFocus();
  });

  it.each([
    ['retry', 'success'], ['retry', 'denial'], ['menu', 'success'], ['menu', 'denial'],
  ] as const)('preserves local detach ownership during %s to %s', async (mode, outcome) => {
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    let existingHandlers = 0;
    const { complete } = await begin(mode, () => { existingHandlers = focusHandlers(add).length; });
    // The actual message renderer has its own focus listeners before a choice.
    // Measure only the preview attempt installed by the following activation.
    const handlers = focusHandlers(add).slice(existingHandlers);
    expect(handlers).toHaveLength(2);
    await complete(outcome);
    await waitFor(() => expect(outcome === 'success' ? result(mode) : screen.getByRole('alert')).toHaveFocus());
    for (const [type, handler] of handlers) expect(remove).toHaveBeenCalledWith(type, handler);
  });

  it.each([false, true])('does not reclaim after external focus then blur=%s', async blur => {
    const { complete } = await begin('retry'), other = screen.getByRole('textbox', { name: 'Otra tarea' });
    act(() => { other.focus(); if (blur) other.blur(); }); await complete('success');
    expect(blur ? document.body : other).toHaveFocus();
  });

  it.each(['forward', 'backward'] as const)('respects voluntary Tab %s', async direction => {
    const { complete, user } = await begin('menu');
    await user.keyboard(direction === 'forward' ? '{Tab}' : '{Shift>}{Tab}{/Shift}');
    const other = screen.getByRole('textbox', { name: direction === 'forward' ? 'Otra tarea' : 'Control anterior' });
    expect(other).toHaveFocus(); await complete('success'); expect(other).toHaveFocus();
  });

  it('does not acquire focus for an initial read or programmatic retry', async () => {
    const pending = deferred<KnowledgeWorkspace>(); vi.mocked(loadWorkspace).mockReturnValueOnce(pending.promise);
    render(view()); const other = screen.getByRole('textbox', { name: 'Otra tarea' }); other.focus();
    await act(async () => pending.reject(new Error('synthetic_failure'))); expect(other).toHaveFocus();
    const next = deferred<KnowledgeWorkspace>(); vi.mocked(loadWorkspace).mockReturnValueOnce(next.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar contenido público' })); expect(other).toHaveFocus();
    await act(async () => next.resolve(model())); expect(result('retry')).toBeVisible(); expect(other).toHaveFocus();
  });

  it.each(['actor', 'revision', 'tenant', 'token ABA'] as const)('retires an owned read across %s', async change => {
    const { pending, mounted } = await begin('retry'), next = deferred<KnowledgeWorkspace>();
    const oldGuard = vi.mocked(loadWorkspace).mock.calls[1][2]!.isCurrent!;
    const sameLoadingFocus = vi.spyOn(loading(), 'focus');
    vi.mocked(loadWorkspace).mockReturnValue(next.promise);
    await act(async () => {
      if (change === 'actor') authority.session.user = { ...authority.session.user, id: 99 };
      if (change === 'revision') advanceChatbocSessionRevision();
      if (change === 'tenant') {
        authority.tenant = { ...authority.tenant, currentSlug: 'qa-other', tenant: { slug: 'qa-other', nombre: 'Otra institución sintética' } };
        navigate('/t/qa-other/integracion');
      }
      if (change === 'token ABA') {
        usePanelSessionStore.setState({ authToken: 'synthetic-session-b' });
        usePanelSessionStore.setState({ authToken: 'synthetic-session-a' });
      }
      mounted.rerender(view());
    });
    expect(oldGuard()).toBe(false); expect(sameLoadingFocus).not.toHaveBeenCalled();
    act(() => loading().blur()); expect(document.body).toHaveFocus();
    await act(async () => (pending as ReturnType<typeof deferred<KnowledgeWorkspace>>).resolve(model('qa-office', 'Lectura retirada')));
    expect(screen.queryByText('Lectura retirada')).not.toBeInTheDocument();
    await act(async () => next.resolve(model(change === 'tenant' ? 'qa-other' : 'qa-office', 'Lectura nueva')));
    expect(screen.getByText('Lectura nueva')).toBeVisible(); expect(document.body).toHaveFocus();
  });

  it('removes attempt listeners on unmount and ignores its late answer', async () => {
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    const { mounted, complete } = await begin('menu'), handlers = focusHandlers(add);
    mounted.unmount(); for (const [type, handler] of handlers) expect(remove).toHaveBeenCalledWith(type, handler);
    await complete('success'); expect(screen.queryByRole('heading')).not.toBeInTheDocument(); expect(document.body).toHaveFocus();
  });
});
