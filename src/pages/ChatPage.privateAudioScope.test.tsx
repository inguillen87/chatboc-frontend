import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '@/pages/ChatPage';
import { ApiError, apiFetch } from '@/utils/api';
import { captureChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { toast } from '@/components/ui/use-toast';
import { usePanelSessionStore } from '@/stores';
import { readVerifiedOrganizationIdentity } from '@/utils/verifiedOrganizationIdentity';
import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';

// Real caller, ChatInput, recorder hook, upload adapter and recovery owner.
// Identity, media devices, HTTP and unrelated presentation leaves are fixtures.
const fixture = vi.hoisted(() => ({
  tenant: null as any,
  refresh: vi.fn(), ask: vi.fn(), humanReply: vi.fn(), historyEmail: vi.fn(),
}));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => ({ ...await vi.importActual<typeof import('@/utils/api')>('@/utils/api'), apiFetch: vi.fn() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: usePanelSessionStore(state => state.user), refreshUser: fixture.refresh, loading: false, organizationProfileVerified: true }) }));
vi.mock('@/context/TenantContext', () => ({ useTenantContextPresence: () => fixture.tenant }));
vi.mock('@/components/layout/Navbar', () => ({ default: () => <nav data-testid="navbar-fixture" /> }));
vi.mock('@/components/chat/ChatMessage', () => ({ default: ({ message }: any) => <p>{message.text}</p> }));
vi.mock('@/components/TicketMap', () => ({ default: () => <div data-testid="ticket-map-fixture" /> }));
vi.mock('@/components/tickets/TicketTimeline', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/AddressAutocomplete', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/services/ticketService', async () => ({
  ...await vi.importActual<typeof import('@/services/ticketService')>('@/services/ticketService'),
  getTicketTimeline: vi.fn(async () => ({ history: [], messages: [], estado_chat: 'abierto' })),
  requestTicketHistoryEmail: (...args: unknown[]) => fixture.historyEmail(...args),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tenant = (slug = 'synthetic-a', id = 22) => ({
  currentSlug: slug, tenant: { slug, publishedIdentity: { tenantId: id, tenantSlug: slug } },
  isLoadingTenant: false, tenantError: null,
});
const prepare = {
  ok: true, contract_version: 'chat.attachment.direct.v1', operation: 'prepare_direct_upload',
  upload_id: 'synthetic-audio-upload', intent_token: 'synthetic-audio-intent',
  upload: { method: 'PUT', url: 'https://objects.example.test/page-audio', headers: { 'Content-Type': 'audio/webm' }, expires_in_seconds: 300 },
  constraints: { max_file_bytes: 1024, exact_size_required: true },
};
const uploaded = { ok: true, url: 'https://objects.example.test/page-audio.webm', filename: 'page-audio.webm', mime_type: 'audio/webm' };
const originalDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
let tracks: Array<{ stop: ReturnType<typeof vi.fn> }>;
let objectPut: ReturnType<typeof vi.fn>;
class FakeRecorder {
  mimeType = 'audio/webm'; state = 'inactive';
  onstart: (() => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  constructor(readonly stream: MediaStream) {}
  start() { this.state = 'recording'; this.onstart?.(); }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['synthetic-page-speech'], { type: this.mimeType }) }); this.onstop?.(); }
}
const view = () => <SessionAuthorityProvider value={{ clerkStatus: 'disabled', hasBearerSession: true, hasVerifiedSession: true }}><MemoryRouter initialEntries={['/chat']}><ChatPage /></MemoryRouter></SessionAuthorityProvider>;
const asks = () => vi.mocked(apiFetch).mock.calls.filter(([url]) => /^\/ask(?:\/|$)/.test(String(url)));
async function recordAndStop() {
  fireEvent.click(screen.getByRole('button', { name: 'Audio', exact: true }));
  await screen.findByRole('button', { name: 'Detener grabación' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Detener grabación' })); });
  await waitFor(() => expect(asks()).toHaveLength(1));
}
const expectDiscardOnly = async () => {
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('no podemos confirmar su envío'));
  expect(screen.getByRole('button', { name: 'Descartar grabación' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Escribir mensaje' })).toBeEnabled();
};
// Shape preserved by UserProvider: descriptors intact and tenant aliases are slugs.
// This fixture does not run UserProvider normalization or establish real access.
const privateProfile = (id: number) => ({
  id: '101', email: 'synthetic-actor@example.test', name: 'Synthetic actor', rol: 'tenant_admin', rubro: 'synthetic-sector',
  tenant_slug: 'synthetic-private', tenantSlug: 'synthetic-private',
  tenant: { slug: 'synthetic-private', tenant_slug: 'synthetic-private' },
  organization_profile: { contract_version: 'organization.profile_settings.v1',
    tenant: { id, slug: 'synthetic-private' }, values: { nombre_empresa: 'Synthetic private workspace' } },
  organization_workspace: { contract_version: 'organization.profile_workspace.v1',
    tenant: { id, slug: 'synthetic-private' }, organization_type: 'empresa' },
});
const verifiedPrivateId = () => readVerifiedOrganizationIdentity(usePanelSessionStore.getState().user,
  { hasVerifiedSession: true, profileVerified: true, loading: false });
beforeEach(() => {
  window.localStorage.clear(); window.sessionStorage.clear();
  usePanelSessionStore.getState().clearSession();
  usePanelSessionStore.getState().setAuthToken('synthetic-fixed-session');
  usePanelSessionStore.getState().setUser(privateProfile(17));
  localStorage.setItem('tenantSlug', 'synthetic-private');
  fixture.tenant = tenant(); tracks = [];
  fixture.ask.mockReset().mockResolvedValue({ respuesta_usuario: 'synthetic-current-reply' });
  fixture.humanReply.mockReset().mockRejectedValue(new ApiError('synthetic-empty-comment-rejected', 400));
  fixture.refresh.mockReset().mockResolvedValue(undefined);
  fixture.historyEmail.mockReset().mockResolvedValue({});
  vi.mocked(toast).mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => {
    const track = { stop: vi.fn() }; tracks.push(track); return { getTracks: () => [track] } as unknown as MediaStream;
  }) } });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  objectPut = vi.fn(async (url: unknown) => {
    if (url !== prepare.upload.url) throw new Error('unexpected_fixture_object_fetch');
    return new Response('', { status: 200 });
  });
  vi.stubGlobal('fetch', objectPut);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(apiFetch).mockReset().mockImplementation(async (url, options) => {
    if (options?.body?.operation === 'prepare_direct_upload') return prepare;
    if (options?.body?.operation === 'complete_direct_upload') return uploaded;
    if (/^\/ask(?:\/|$)/.test(String(url))) return fixture.ask(url, options);
    if (/responder_ciudadano$/.test(String(url))) return fixture.humanReply(url, options);
    if (/\/mensajes\?/.test(String(url))) return { mensajes: [], estado_chat: 'abierto' };
    if (String(url) === '/tickets/municipio/77') return { id: 77, tipo: 'municipio', estado: 'abierto' };
    throw new Error('unexpected_fixture_api_path');
  });
});
afterEach(() => {
  cleanup(); tracks.forEach(track => track.stop());
  usePanelSessionStore.getState().clearSession();
  if (originalDevices) Object.defineProperty(navigator, 'mediaDevices', originalDevices);
  else Reflect.deleteProperty(navigator, 'mediaDevices');
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});


describe('ChatPage audio ownership across a private organization descriptor replacement', () => {
  it('retires the draft and delayed ACK when the private ID changes with actor, token, slug and public tenant unchanged', async () => {
    expect(readVerifiedOrganizationIdentity(privateProfile(17), { hasVerifiedSession: true, profileVerified: true, loading: false }))
      .toMatchObject({ tenantId: 17, tenantSlug: 'synthetic-private' });
    expect(readVerifiedOrganizationIdentity(privateProfile(18), { hasVerifiedSession: true, profileVerified: true, loading: false }))
      .toMatchObject({ tenantId: 18, tenantSlug: 'synthetic-private' });
    const revision = captureChatbocSessionRevision(), publicTenant = fixture.tenant;
    const ack = deferred<unknown>(); fixture.ask.mockReturnValueOnce(ack.promise);
    render(view()); await recordAndStop();
    expect(verifiedPrivateId()?.tenantId).toBe(17);
    expect(screen.getByRole('button', { name: 'Descartar grabación' })).toBeVisible();
    act(() => { usePanelSessionStore.getState().setUser(privateProfile(18)); });
    expect(verifiedPrivateId()?.tenantId).toBe(18);
    expect(usePanelSessionStore.getState().user?.id).toBe('101');
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-fixed-session');
    expect(localStorage.getItem('tenantSlug')).toBe('synthetic-private');
    expect(captureChatbocSessionRevision()).toBe(revision); expect(fixture.tenant).toBe(publicTenant);
    expect.soft(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    await act(async () => ack.resolve({ respuesta_usuario: 'synthetic-retired-private-id-ack' }));
    expect.soft(screen.queryByText('synthetic-retired-private-id-ack')).toBeNull();
    expect(asks()).toHaveLength(1); expect(toast).not.toHaveBeenCalled();
  });
  it('retires the draft and delayed ACK across synchronous private ID A to B to A notifications between React commits', async () => {
    expect(readVerifiedOrganizationIdentity(privateProfile(17), { hasVerifiedSession: true, profileVerified: true, loading: false }))
      .toMatchObject({ tenantId: 17, tenantSlug: 'synthetic-private' });
    expect(readVerifiedOrganizationIdentity(privateProfile(18), { hasVerifiedSession: true, profileVerified: true, loading: false }))
      .toMatchObject({ tenantId: 18, tenantSlug: 'synthetic-private' });
    const revision = captureChatbocSessionRevision(), publicTenant = fixture.tenant;
    const ack = deferred<unknown>(); fixture.ask.mockReturnValueOnce(ack.promise);
    render(view()); await recordAndStop();
    const seen: Array<number | undefined> = [];
    const stop = usePanelSessionStore.subscribe(() => { seen.push(verifiedPrivateId()?.tenantId); });
    act(() => {
      usePanelSessionStore.getState().setUser(privateProfile(18));
      usePanelSessionStore.getState().setUser(privateProfile(17));
    });
    stop(); expect(seen).toEqual([18, 17]); expect(verifiedPrivateId()?.tenantId).toBe(17);
    expect(usePanelSessionStore.getState().user?.id).toBe('101');
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-fixed-session');
    expect(localStorage.getItem('tenantSlug')).toBe('synthetic-private');
    expect(captureChatbocSessionRevision()).toBe(revision); expect(fixture.tenant).toBe(publicTenant);
    expect.soft(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    await act(async () => ack.resolve({ respuesta_usuario: 'synthetic-retired-private-aba-ack' }));
    expect.soft(screen.queryByText('synthetic-retired-private-aba-ack')).toBeNull();
    expect(asks()).toHaveLength(1); expect(toast).not.toHaveBeenCalled();
  });
});
