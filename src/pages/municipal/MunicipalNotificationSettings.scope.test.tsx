import React from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MunicipalNotificationSettings from './MunicipalNotificationSettings';
import { ApiError } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

// Real component, scoped hook, API adapter, DTO/ACK validation and UI controls.
// Tenant/session producer and apiFetch are synthetic. No private access,
// persistence, dispatch, external provider or municipal acceptance is certified.
vi.unmock('react-router-dom');
const identity = vi.hoisted(() => ({ actor: 42, verified: true, profile: true, loading: false,
  publishedId: 0, tenantLoading: false, tenantError: null as string | null }));
vi.mock('@/context/TenantContext', async () => {
  const { useParams } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { useTenant: () => { const slug = useParams().tenant ?? 'qa-a'; return { currentSlug: slug,
    isLoadingTenant: identity.tenantLoading, tenantError: identity.tenantError,
    tenant: { slug, publishedIdentity: { tenantId: identity.publishedId || (slug === 'qa-a' ? 701 : 702), tenantSlug: slug } } }; } };
});
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: { id: identity.actor }, loading: identity.loading,
  hasVerifiedSession: identity.verified, organizationProfileVerified: identity.profile }) }));
const transport = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/utils/api', () => ({ apiFetch: (...args: unknown[]) => transport(...args),
  ApiError: class ApiError extends Error { constructor(message: string, public status: number) { super(message); } } }));
const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const dto = (slug = 'qa-a', extra: Record<string, unknown> = {}) => ({ contract_version: 'notifications.hooks.v1',
  tenant: { id: slug === 'qa-a' ? 701 : 702, slug }, triggers: [],
  preferences: { email: slug === 'qa-a', telegram: false, whatsapp: false, digest: { hour: 8 } },
  delivery: { owner_phone: `synthetic-phone-${slug}`, telegram_chat_id: `synthetic-chat-${slug}` }, ...extra });
const ack = (options: any) => ({ ...dto(options.tenantSlug),
  preferences: { ...dto(options.tenantSlug).preferences, ...options.body.preferences },
  delivery: { ...dto(options.tenantSlug).delivery, ...options.body.delivery } });
function Page() { const navigate = useNavigate(); return <><output data-testid="active-tenant">{useParams().tenant}</output>
  <button onClick={() => navigate('/t/qa-a/notificaciones')}>Cambiar a A</button>
  <button onClick={() => navigate('/t/qa-b/notificaciones')}>Cambiar a B</button><MunicipalNotificationSettings /></>; }
const fixture = (path = '/t/qa-a/notificaciones') => <MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/t/:tenant/notificaciones" element={<Page />} /></Routes></MemoryRouter>;
const phone = () => screen.getByLabelText('Teléfono de Guardia (WhatsApp)');
const telegram = () => screen.getByLabelText('Telegram Chat ID');
const email = () => screen.getByRole('switch', { name: 'Email', exact: true });
const save = () => screen.getByRole('button', { name: 'Guardar Cambios', exact: true });
const reads = () => transport.mock.calls.filter(([, options]) => options.method !== 'POST');
const writes = () => transport.mock.calls.filter(([, options]) => options.method === 'POST');
const success = () => screen.queryByText('Configuración guardada correctamente.');
const ready = () => waitFor(() => expect(phone()).toBeEnabled());
beforeEach(() => { vi.clearAllMocks(); Object.assign(identity, { actor: 42, verified: true, profile: true,
  loading: false, publishedId: 0, tenantLoading: false, tenantError: null });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in scoped municipal tests'); }));
  transport.mockImplementation(async (_path, options) => options.method === 'POST' ? ack(options) : dto(options.tenantSlug)); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('municipal notification authority and delayed results', () => {
  it('ignores delayed A GET after B loaded and sends only the B edit', async () => {
    const a = deferred<any>(); transport.mockImplementation(async (_path, options) => options.method === 'POST' ? ack(options)
      : options.tenantSlug === 'qa-a' ? a.promise : dto('qa-b'));
    const user = userEvent.setup(); render(fixture()); await waitFor(() => expect(reads()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready();
    await act(async () => { a.resolve(dto('qa-a')); await a.promise; });
    expect(phone()).toHaveValue('synthetic-phone-qa-b'); expect(email()).toHaveAttribute('aria-checked', 'false');
    await user.click(email()); await user.click(save()); await waitFor(() => expect(success()).toBeVisible());
    expect(writes()).toEqual([['/api/v2/notifications/hooks', expect.objectContaining({ tenantSlug: 'qa-b', body: { preferences: { email: true } } })]]);
  });
  it('ignores a late old read error after B loaded', async () => {
    const a = deferred<any>(); transport.mockImplementation(async (_path, options) => options.tenantSlug === 'qa-a' ? a.promise : dto('qa-b'));
    const user = userEvent.setup(); render(fixture()); await waitFor(() => expect(reads()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready();
    await act(async () => { a.reject(new ApiError('synthetic old denied', 403)); });
    expect(phone()).toHaveValue('synthetic-phone-qa-b'); expect(phone()).toBeEnabled(); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('does not revive an old A request across A to B to A', async () => {
    const oldA = deferred<any>(), newA = deferred<any>(); let aReads = 0;
    transport.mockImplementation(async (_path, options) => options.tenantSlug === 'qa-a' ? (++aReads === 1 ? oldA.promise : newA.promise) : dto('qa-b'));
    const user = userEvent.setup(); render(fixture()); await waitFor(() => expect(reads()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready();
    await user.click(screen.getByRole('button', { name: 'Cambiar a A' }));
    await act(async () => { oldA.resolve(dto('qa-a')); await oldA.promise; });
    expect(phone()).toBeDisabled(); expect(phone()).toHaveValue(''); expect(save()).toBeDisabled();
    await act(async () => { newA.resolve(dto('qa-a', { delivery: { owner_phone: 'synthetic-fresh-A', telegram_chat_id: null } })); await newA.promise; });
    expect(phone()).toHaveValue('synthetic-fresh-A'); expect(phone()).toBeEnabled(); expect(writes()).toHaveLength(0);
  });
  it.each([401, 403])('clears the old draft on B GET%s and requires a valid explicit retry', async status => {
    const b = deferred<any>(); transport.mockImplementation(async (_path, options) => options.tenantSlug === 'qa-a' ? dto() : b.promise);
    const user = userEvent.setup(); render(fixture()); await ready();
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); expect(phone()).toHaveValue(''); expect(phone()).toBeDisabled();
    await act(async () => { b.reject(new ApiError('synthetic access withdrawn', status)); });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos confirmar tu acceso');
    expect(phone()).toHaveValue(''); expect(save()).toBeDisabled(); await user.click(save()); expect(writes()).toHaveLength(0);
    transport.mockResolvedValue(dto('qa-b')); await user.click(screen.getByRole('button', { name: 'Reintentar preferencias' }));
    await ready(); expect(phone()).toHaveValue('synthetic-phone-qa-b');
  });
  it('blocks saving after an initial malformed 200 GET and exposes a retry', async () => {
    transport.mockResolvedValueOnce({ error: 'synthetic secret' }); const user = userEvent.setup(); render(fixture());
    await screen.findByRole('alert'); expect(save()).toBeDisabled(); expect(phone()).toBeDisabled();
    expect(screen.getByRole('alert')).not.toHaveTextContent('synthetic secret'); await user.click(save()); expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Reintentar preferencias' })); await ready();
  });
  it.each(['success', 'failure'] as const)('retires a delayed A save %s while B is active', async outcome => {
    const a = deferred<any>(); let submitted: any;
    transport.mockImplementation(async (_path, options) => { if (options.method === 'POST') { submitted = options; return a.promise; } return dto(options.tenantSlug); });
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready();
    await act(async () => { if (outcome === 'success') a.resolve(ack(submitted)); else a.reject(new ApiError('synthetic old denied', 403)); });
    expect(phone()).toHaveValue('synthetic-phone-qa-b'); expect(phone()).toBeEnabled(); expect(success()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull(); expect(toast.success).not.toHaveBeenCalled(); expect(toast.error).not.toHaveBeenCalled();
  });
  it('does not let an old save completion release a pending B save', async () => {
    const a = deferred<any>(), b = deferred<any>(); const submitted: any[] = [];
    transport.mockImplementation(async (_path, options) => { if (options.method === 'POST') { submitted.push(options); return options.tenantSlug === 'qa-a' ? a.promise : b.promise; } return dto(options.tenantSlug); });
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready(); await user.click(email()); await user.click(save());
    await act(async () => { a.resolve(ack(submitted[0])); await a.promise; });
    expect(save()).toBeDisabled(); expect(phone()).toBeDisabled(); expect(success()).toBeNull();
    await act(async () => { b.resolve(ack(submitted[1])); await b.promise; }); expect(success()).toBeVisible(); expect(phone()).toBeEnabled();
  });
  it.each([404, 405, 501])('does not start a legacy PUT after canonical POST%s belongs to a retired route', async status => {
    const pending = deferred<any>();
    transport.mockImplementation(async (_path, options) => {
      if (options.method === 'POST') return pending.promise;
      if (options.method === 'PUT') return { status: 'ok' };
      return dto(options.tenantSlug);
    });
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready();
    await act(async () => { pending.reject(new ApiError('synthetic unsupported route', status)); });
    const legacyWrites = transport.mock.calls.filter(([, options]) => options.method === 'PUT');
    if (legacyWrites.length) console.log('MUNICIPAL_RETIRED_LEGACY_PUT ' + JSON.stringify(legacyWrites));
    expect(legacyWrites).toHaveLength(0); expect(success()).toBeNull(); expect(phone()).toHaveValue('synthetic-phone-qa-b');
  });
  it.each(['unmount', 'ABA', 'revision', 'actor'] as const)('does not start a legacy PUT after its initiating %s retires', async retirement => {
    const pending = deferred<any>();
    transport.mockImplementation(async (_path, options) => options.method === 'POST' ? pending.promise : options.method === 'PUT' ? { status: 'ok' } : dto(options.tenantSlug));
    const user = userEvent.setup(), view = render(fixture()); await ready(); await user.click(email()); await user.click(save());
    const postOptions = writes()[0][1];
    if (retirement === 'unmount') view.unmount();
    else if (retirement === 'ABA') { await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready();
      await user.click(screen.getByRole('button', { name: 'Cambiar a A' })); await ready(); }
    else if (retirement === 'revision') act(() => { advanceChatbocSessionRevision(); });
    else act(() => { identity.actor = 99; view.rerender(fixture()); });
    await act(async () => { pending.reject(new ApiError('synthetic unsupported route', 404)); });
    expect(transport.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(0);
    expect(postOptions.isCurrent()).toBe(false); expect(toast.success).not.toHaveBeenCalled(); expect(toast.error).not.toHaveBeenCalled();
  });
  it('does not start a legacy GET after the canonical read scope retires', async () => {
    const a = deferred<any>(); transport.mockImplementation(async (path, options) => path === '/api/v2/notifications/hooks' && options.tenantSlug === 'qa-a' ? a.promise : dto(options.tenantSlug));
    const user = userEvent.setup(); render(fixture()); await waitFor(() => expect(reads()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' })); await ready();
    await act(async () => { a.reject(new ApiError('synthetic unsupported read route', 404)); });
    expect(transport.mock.calls.some(([path]) => path.includes('/api/admin/tenants/qa-a/notifications'))).toBe(false);
    expect(phone()).toHaveValue('synthetic-phone-qa-b');
  });
  it('retires reads when session authority is withdrawn and refreshes after same-actor restoration', async () => {
    const old = deferred<any>(); transport.mockReturnValueOnce(old.promise); const view = render(fixture());
    await waitFor(() => expect(reads()).toHaveLength(1));
    act(() => { identity.verified = false; advanceChatbocSessionRevision(); });
    await act(async () => { old.resolve(dto()); await old.promise; }); expect(phone()).toHaveValue(''); expect(phone()).toBeDisabled();
    act(() => { identity.verified = true; advanceChatbocSessionRevision(); view.rerender(fixture()); });
    await ready(); expect(reads()).toHaveLength(2); expect(phone()).toHaveValue('synthetic-phone-qa-a');
  });
  it('retires an old save ACK after same-actor session revision advances', async () => {
    const old = deferred<any>(); let submitted: any;
    transport.mockImplementation(async (_path, options) => { if (options.method === 'POST') { submitted = options; return old.promise; } return dto(options.tenantSlug); });
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    act(() => { advanceChatbocSessionRevision(); }); await ready();
    await act(async () => { old.resolve(ack(submitted)); await old.promise; });
    expect(success()).toBeNull(); expect(email()).toHaveAttribute('aria-checked', 'true'); expect(save()).toBeDisabled(); expect(reads()).toHaveLength(2);
  });
  it.each(['actor', 'publishedId'] as const)('requires a fresh GET after the same slug changes %s', async field => {
    const fresh = deferred<any>(); const view = render(fixture()); await ready(); transport.mockReturnValueOnce(fresh.promise);
    act(() => { identity[field] = field === 'actor' ? 99 : 799; view.rerender(fixture()); });
    expect(phone()).toHaveValue(''); expect(phone()).toBeDisabled(); expect(save()).toBeDisabled();
    await act(async () => { fresh.resolve(dto('qa-a', { tenant: { id: identity.publishedId || 701, slug: 'qa-a' } })); await fresh.promise; });
    await ready(); expect(reads()).toHaveLength(2);
  });
  it('rejects a canonical GET with the right slug but a different published tenant ID', async () => {
    identity.publishedId = 799; render(fixture()); await screen.findByRole('alert');
    expect(phone()).toHaveValue(''); expect(phone()).toBeDisabled(); expect(save()).toBeDisabled(); expect(writes()).toHaveLength(0);
  });
  it('does not accept an ACK with the right slug but a different published tenant ID', async () => {
    identity.publishedId = 799;
    transport.mockImplementationOnce(async () => dto('qa-a', { tenant: { id: 799, slug: 'qa-a' } }));
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    await screen.findByRole('alert'); expect(success()).toBeNull(); expect(email()).toHaveAttribute('aria-checked', 'false');
    expect(phone()).toHaveValue('synthetic-phone-qa-a'); expect(save()).toBeEnabled(); expect(writes()).toHaveLength(1);
  });
  it('does not reuse an unmounted read in a new page instance', async () => {
    const old = deferred<any>(), fresh = deferred<any>(); transport.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const view = render(fixture()); await waitFor(() => expect(reads()).toHaveLength(1)); view.unmount(); render(fixture());
    await waitFor(() => expect(reads()).toHaveLength(2)); await act(async () => { old.resolve(dto()); await old.promise; });
    expect(phone()).toHaveValue(''); expect(phone()).toBeDisabled();
    await act(async () => { fresh.resolve(dto()); await fresh.promise; }); await ready(); expect(toast.success).not.toHaveBeenCalled();
  });
  it.each([
    { verified: false }, { profile: false }, { loading: true }, { tenantLoading: true }, { tenantError: 'synthetic unavailable' },
  ])('does not read or edit under unverified authority: %j', async change => {
    Object.assign(identity, change); render(fixture()); expect(phone()).toBeDisabled(); expect(save()).toBeDisabled(); expect(transport).not.toHaveBeenCalled();
  });
  it('does not read when an explicit query tenant conflicts with the current route', () => {
    render(fixture('/t/qa-a/notificaciones?tenant=qa-b')); expect(phone()).toBeDisabled(); expect(transport).not.toHaveBeenCalled();
  });
});

describe('municipal sparse writes and recoverable drafts', () => {
  it('keeps unedited null destinations and omitted channels out of a channel POST', async () => {
    transport.mockResolvedValueOnce(dto('qa-a', { delivery: { owner_phone: null, telegram_chat_id: null }, preferences: { digest: { hour: 8 } } }));
    const user = userEvent.setup(); render(fixture()); await ready(); expect(phone()).toHaveValue(''); await user.click(email()); await user.click(save());
    await waitFor(() => expect(success()).toBeVisible()); expect(writes()[0][1].body).toEqual({ preferences: { email: false } });
  });
  it('writes only a deliberately edited destination and reflects untouched canonical ACK values', async () => {
    transport.mockImplementation(async (_path, options) => options.method === 'POST'
      ? { ...ack(options), delivery: { ...ack(options).delivery, telegram_chat_id: 'synthetic-concurrent-chat' } } : dto());
    const user = userEvent.setup(); render(fixture()); await ready(); await user.clear(phone()); await user.type(phone(), 'synthetic-new-phone'); await user.click(save());
    await waitFor(() => expect(success()).toBeVisible()); expect(writes()[0][1].body).toEqual({ preferences: {}, delivery: { owner_phone: 'synthetic-new-phone' } });
    expect(telegram()).toHaveValue('synthetic-concurrent-chat');
  });
  it('preserves hidden preferences and destinations in an explicit legacy fallback', async () => {
    transport.mockImplementation(async (path, options) => {
      if (path === '/api/v2/notifications/hooks') throw new ApiError('synthetic unsupported', 404);
      if (options.method === 'PUT') return { status: 'ok' };
      return { owner_phone: null, telegram_chat_id: 'synthetic-chat', notification_settings: { email: true, digest: { hour: 8 } } };
    });
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    await waitFor(() => expect(success()).toBeVisible());
    expect(transport).toHaveBeenLastCalledWith('/api/admin/tenants/qa-a/notifications', expect.objectContaining({ method: 'PUT', body: {
      owner_phone: null, telegram_chat_id: 'synthetic-chat', notification_settings: { email: false, digest: { hour: 8 } },
    } }));
  });
  it('keeps the draft after a malformed ACK without replaying until an explicit save', async () => {
    transport.mockImplementationOnce(async () => dto()).mockResolvedValueOnce({ error: 'synthetic secret' });
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.clear(phone()); await user.type(phone(), 'synthetic-edited'); await user.click(save());
    await screen.findByRole('alert'); expect(screen.getByRole('alert')).toHaveTextContent('Tu borrador sigue disponible');
    expect(phone()).toHaveValue('synthetic-edited'); expect(email()).toHaveAttribute('aria-checked', 'false'); expect(save()).toBeEnabled(); expect(writes()).toHaveLength(1);
    expect(success()).toBeNull(); await user.click(save()); await waitFor(() => expect(success()).toBeVisible()); expect(writes()).toHaveLength(2);
    expect(writes()[1][1].body).toEqual(writes()[0][1].body);
  });
  it.each([401, 403])('clears destinations and edits on POST%s until a fresh GET', async status => {
    transport.mockImplementationOnce(async () => dto()).mockRejectedValueOnce(new ApiError('synthetic denied', status));
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    await screen.findByRole('alert'); expect(phone()).toHaveValue(''); expect(telegram()).toHaveValue(''); expect(save()).toBeDisabled(); expect(phone()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar preferencias' })); await ready(); expect(reads()).toHaveLength(2);
  });
  it('blocks editing and repeated dispatch while a save is pending', async () => {
    const pending = deferred<any>(); transport.mockImplementationOnce(async () => dto()).mockReturnValueOnce(pending.promise);
    const user = userEvent.setup(); render(fixture()); await ready(); await user.click(email()); await user.click(save());
    expect(email()).toBeDisabled(); expect(phone()).toBeDisabled(); expect(save()).toBeDisabled();
    await user.click(save()); expect(writes()).toHaveLength(1);
    await act(async () => { pending.resolve(ack(writes()[0][1])); await pending.promise; }); expect(success()).toBeVisible();
  });
});

describe('municipal notification accessible controls', () => {
  it('names all switches and destinations, supports keyboard drafting, and removes the inert test action', async () => {
    const user = userEvent.setup(); render(fixture()); await ready();
    for (const name of ['Telegram', 'WhatsApp', 'Email']) {
      const control = screen.getByRole('switch', { name, exact: true });
      expect(control.id).not.toBe(''); expect(screen.getByText(name, { selector: 'label', exact: true })).toHaveAttribute('for', control.id);
    }
    email().focus(); await user.keyboard(' '); expect(email()).toHaveAttribute('aria-checked', 'false');
    await user.tab(); expect(phone()).toHaveFocus(); await user.tab(); expect(telegram()).toHaveFocus(); await user.tab(); expect(save()).toHaveFocus();
    expect(writes()).toHaveLength(0); expect(screen.queryByRole('button', { name: 'Probar' })).toBeNull();
  });
  it('uses distinct IDs and local label activation across two page instances', async () => {
    const user = userEvent.setup(); render(<MemoryRouter><section data-testid="one"><MunicipalNotificationSettings /></section>
      <section data-testid="two"><MunicipalNotificationSettings /></section></MemoryRouter>);
    const one = within(screen.getByTestId('one')), two = within(screen.getByTestId('two'));
    await waitFor(() => expect(one.getByRole('switch', { name: 'Email', exact: true })).toBeEnabled());
    const first = one.getByRole('switch', { name: 'Email', exact: true }), second = two.getByRole('switch', { name: 'Email', exact: true });
    expect(first.id).not.toBe(second.id); expect(one.getByLabelText('Teléfono de Guardia (WhatsApp)').id).not.toBe(two.getByLabelText('Teléfono de Guardia (WhatsApp)').id);
    await user.click(one.getByText('Email', { selector: 'label', exact: true }));
    expect(first).toHaveAttribute('aria-checked', 'false'); expect(second).toHaveAttribute('aria-checked', 'true'); expect(writes()).toHaveLength(0);
  });
});
