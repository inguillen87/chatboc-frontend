// Shared UI/client regression coverage; identity and HTTP are synthetic.
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seam = vi.hoisted(() => ({ apiFetch: vi.fn() }));
const identity = vi.hoisted(() => ({ user: { id: 7 as number | undefined, rol: 'empleado', tenant_slug: 'fixture-a',
  permissions: ['tickets.write'], capabilities: ['tickets.write'], scopes: [] as string[], categoria_ids: [4] },
  loading: false, organizationProfileVerified: true, hasVerifiedSession: true }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => identity }));
vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => seam.apiFetch(...args),
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error fixture',
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number, public body: unknown = null) { super(message); }
  },
}));
vi.mock('@/config', () => ({ SAME_ORIGIN_PROXY_BASE: '/api' }));
import TicketAiHandoffControl from './TicketAiHandoffControl';
import { normalizeSaasActions, postOmnichannelInboxActionV2, type SaasAction } from '@/api/v2/saas';
import { panelApi } from '@/api/v2/client';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { ApiError } from '@/utils/api';

// Shape matched against the current BE producer by the separate source-bound focal.
const municipal = normalizeSaasActions([{
  id: 'handoff', label: 'Derivar a una persona', method: 'POST',
  endpoint: '/api/v2/inbox/omnichannel/actions', delivery_mode: 'internal_event', external_dispatch: false,
  requires: ['channel', 'reason', 'idempotency_key_header'],
  payload_defaults: { source_model: 'MunicipioTicket', ticket_id: 42, legacy_id: 42, channel: 'operator' },
  idempotency: { contract_version: 'municipio_ticket.handoff_idempotency.v1', required_header: 'Idempotency-Key', body_fallback: false },
}])[0];
const actions = { municipal };
let cache: QueryClient;
function receipt(sourceModel = 'MunicipioTicket', id = 42, slug = 'fixture-a') {
  return { ok: true, tenant: { slug }, action: 'handoff',
    delivery: { status: 'requested', external_dispatch: false, timeline_updated: true },
    ticket: { id: sourceModel === 'MunicipioTicket' ? `municipio:${id}` : String(id), ticket_id: id,
      ...(sourceModel === 'MunicipioTicket' ? { legacy_id: id } : {}), source_model: sourceModel,
      tenant_slug: slug, title: 'Expediente fixture', status: 'en_proceso', attachments: [], timeline: [], allowed_actions: [],
      handoff: { status: 'requested', reason: 'Revisión de un operador' } } };
}
function mount(action: SaasAction, ticketId = 'municipio:42',
  extra: Partial<React.ComponentProps<typeof TicketAiHandoffControl>> = {}) {
  return render(<QueryClientProvider client={cache}><TicketAiHandoffControl
    ticketId={ticketId} tenantSlug="fixture-a" actions={[action]} {...extra} /></QueryClientProvider>);
}
beforeEach(() => {
  seam.apiFetch.mockReset();
  identity.user = { id: 7, rol: 'empleado', tenant_slug: 'fixture-a', permissions: ['tickets.write'],
    capabilities: ['tickets.write'], scopes: [], categoria_ids: [4] };
  identity.loading = false; identity.organizationProfileVerified = true; identity.hasVerifiedSession = true;
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
});

describe('handoff authority and private transport continuity', () => {
  it('retires the old handoff button when its ACK publishes an authoritative empty action set', async () => {
    seam.apiFetch.mockResolvedValue(receipt());
    mount(municipal); fillReason();
    const oldButton = screen.getByRole('button', { name: municipal.label });
    fireEvent.click(oldButton);
    await waitFor(() => expect(screen.getByTestId('handoff-action-result')).toBeTruthy());
    expect(screen.queryByRole('button', { name: municipal.label })).toBeNull();
    fireEvent.click(oldButton);
    expect(seam.apiFetch).toHaveBeenCalledTimes(1);
  });

  it('uses the published accept action after ACK and retains it if that next operation fails', async () => {
    const acceptedAction = { id: 'accept_handoff', label: 'Tomar conversación', method: 'POST',
      endpoint: municipal.endpoint, delivery_mode: 'internal_event', external_dispatch: false,
      requires: [], payload_defaults: { source_model: 'MunicipioTicket', ticket_id: 42, legacy_id: 42 } };
    const ack = receipt();
    const publishedAck = { ...ack, ticket: { ...ack.ticket, allowed_actions: [acceptedAction] } };
    seam.apiFetch.mockResolvedValueOnce(publishedAck).mockRejectedValueOnce(new Error('No confirmamos la toma de conversación.'));
    mount(municipal); fillReason(); submit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tomar conversación' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: municipal.label })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tomar conversación' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Tomar conversación' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: municipal.label })).toBeNull();
    expect(seam.apiFetch).toHaveBeenCalledTimes(2);
    expect(seam.apiFetch.mock.calls[1][1].body).toMatchObject({ action: 'accept_handoff', source_model: 'MunicipioTicket', ticket_id: 42 });
    expect(seam.apiFetch.mock.calls[1][1].headers['Idempotency-Key']).toBeUndefined();
  });
  it('does not start a mutation with an unknown actor', () => {
    identity.user = { ...identity.user, id: undefined };
    mount(municipal); fillReason(); submit();
    expect(seam.apiFetch).not.toHaveBeenCalled();
  });
  it.each(['actor', 'capabilities'] as const)('retires a queued attempt when effective %s change', async (kind) => {
    const gate = deferred<void>(), entered = vi.fn(), confirmed = vi.fn();
    cache.setDefaultOptions({ mutations: { retry: false, gcTime: 0,
      onMutate: async () => { entered(); await gate.promise; } } });
    seam.apiFetch.mockResolvedValue(receipt());
    const mounted = mount(municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    identity.user = kind === 'actor' ? { ...identity.user, id: 8 } : { ...identity.user, capabilities: [], permissions: [] };
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:42" tenantSlug="fixture-a" actions={[municipal]} onActionComplete={confirmed} /></QueryClientProvider>);
    await act(async () => gate.resolve());
    expect(seam.apiFetch).not.toHaveBeenCalled();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it.each(['loading', 'organizationProfileVerified', 'hasVerifiedSession'] as const)(
    'does not start a mutation with unverified authority: %s', (field) => {
      if (field === 'loading') identity.loading = true; else identity[field] = false;
      mount(municipal); fillReason(); submit();
      expect(seam.apiFetch).not.toHaveBeenCalled();
    });
  it('does not revive a queued attempt after organization and ticket A to B to A', async () => {
    const gate = deferred<void>(), entered = vi.fn(), confirmed = vi.fn();
    cache.setDefaultOptions({ mutations: { retry: false, gcTime: 0,
      onMutate: async () => { entered(); await gate.promise; } } });
    seam.apiFetch.mockResolvedValue(receipt());
    const mounted = mount(municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    const other = { ...municipal, payload_defaults: { ...municipal.payload_defaults, ticket_id: 43, legacy_id: 43 } };
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:43" tenantSlug="fixture-b" actions={[other]} onActionComplete={confirmed} /></QueryClientProvider>);
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:42" tenantSlug="fixture-a" actions={[municipal]} onActionComplete={confirmed} /></QueryClientProvider>);
    await act(async () => gate.resolve());
    expect(seam.apiFetch).not.toHaveBeenCalled();
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.queryByTestId('handoff-action-result')).toBeNull();
  });

  it('does not revive a queued attempt after an action is withdrawn and restored', async () => {
    const gate = deferred<void>(), entered = vi.fn(), confirmed = vi.fn();
    cache.setDefaultOptions({ mutations: { retry: false, gcTime: 0,
      onMutate: async () => { entered(); await gate.promise; } } });
    seam.apiFetch.mockResolvedValue(receipt());
    const mounted = mount(municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:42" tenantSlug="fixture-a" actions={[{ ...municipal, disabled: true }]} onActionComplete={confirmed} /></QueryClientProvider>);
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:42" tenantSlug="fixture-a" actions={[municipal]} onActionComplete={confirmed} /></QueryClientProvider>);
    await act(async () => gate.resolve());
    expect(seam.apiFetch).not.toHaveBeenCalled();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('does not confirm an old in-flight ACK after an A to B to A return', async () => {
    const pending = deferred<ReturnType<typeof receipt>>(), confirmed = vi.fn();
    seam.apiFetch.mockReturnValue(pending.promise);
    const mounted = mount(municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(seam.apiFetch).toHaveBeenCalledTimes(1));
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:42" tenantSlug="fixture-b" actions={[municipal]} onActionComplete={confirmed} /></QueryClientProvider>);
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:42" tenantSlug="fixture-a" actions={[municipal]} onActionComplete={confirmed} /></QueryClientProvider>);
    await act(async () => pending.resolve(receipt()));
    expect(seam.apiFetch).toHaveBeenCalledTimes(1); // An already-sent request cannot be undone.
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.queryByTestId('handoff-action-result')).toBeNull();
  });

  it('allows correction only after a known pre-write municipal validation rejection', async () => {
    seam.apiFetch.mockRejectedValueOnce(new ApiError('Corregí el motivo.', 400,
      { reason_code: 'handoff_reason_invalid' })).mockResolvedValue(receipt());
    mount(municipal);
    fillReason(); submit();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect((screen.getByRole('textbox', { name: /motivo/i }) as HTMLTextAreaElement).disabled).toBe(false);
    const oldKey = seam.apiFetch.mock.calls[0][1].headers['Idempotency-Key'];
    fillReason('Motivo corregido por el operador'); submit();
    await waitFor(() => expect(seam.apiFetch).toHaveBeenCalledTimes(2));
    expect(seam.apiFetch.mock.calls[1][1].body.reason).toBe('Motivo corregido por el operador');
    expect(seam.apiFetch.mock.calls[1][1].headers['Idempotency-Key']).not.toBe(oldKey);
  });

  it('keeps an unknown 400 result locked for the same explicit retry', async () => {
    seam.apiFetch.mockRejectedValueOnce(new ApiError('Resultado no confirmado.', 400,
      { reason_code: 'unrecognized_fixture_code' })).mockResolvedValue(receipt());
    mount(municipal);
    fillReason(); submit();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect((screen.getByRole('textbox', { name: /motivo/i }) as HTMLTextAreaElement).disabled).toBe(true);
    const oldKey = seam.apiFetch.mock.calls[0][1].headers['Idempotency-Key'];
    submit();
    await waitFor(() => expect(seam.apiFetch).toHaveBeenCalledTimes(2));
    expect(seam.apiFetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(oldKey);
    expect(seam.apiFetch.mock.calls[1][1].body.reason).toBe('Revisión de un operador');
  });
  it('retires a queued POST when the panel session revision changes', async () => {
    const gate = deferred<void>(), entered = vi.fn(), confirmed = vi.fn();
    cache.setDefaultOptions({ mutations: { retry: false, gcTime: 0,
      onMutate: async () => { entered(); await gate.promise; } } });
    seam.apiFetch.mockResolvedValue(receipt());
    mount(actions.municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    act(() => { advanceChatbocSessionRevision(); });
    await act(async () => gate.resolve());
    expect(seam.apiFetch).not.toHaveBeenCalled();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('retires a queued POST when the published permission is withdrawn', async () => {
    const gate = deferred<void>(), entered = vi.fn(), confirmed = vi.fn();
    cache.setDefaultOptions({ mutations: { retry: false, gcTime: 0,
      onMutate: async () => { entered(); await gate.promise; } } });
    seam.apiFetch.mockResolvedValue(receipt());
    const mounted = mount(actions.municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:42" tenantSlug="fixture-a" actions={[{ ...actions.municipal, disabled: true }]}
      onActionComplete={confirmed} /></QueryClientProvider>);
    await act(async () => gate.resolve());
    expect(seam.apiFetch).not.toHaveBeenCalled();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('passes the private POST lifecycle callback through panelApi to the HTTP seam', async () => {
    let current = true;
    const isCurrent = () => current;
    seam.apiFetch.mockResolvedValue(receipt());
    await postOmnichannelInboxActionV2('municipio:42', { action: 'handoff',
      payload: { ...municipal.payload_defaults, reason: 'Revisión de un operador', idempotency_key: 'handoff-fixture-0001' } },
      'fixture-a', undefined, { isCurrent });
    const options = seam.apiFetch.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.isCurrent).toBe(isCurrent);
    expect(options.isCurrent()).toBe(true);
    current = false;
    expect(options.isCurrent()).toBe(false);
  });

  it('preserves private GET callbacks and the absence of an optional POST callback', async () => {
    seam.apiFetch.mockResolvedValue({});
    const isCurrent = () => true;
    await panelApi.get('/fixture-read', { tenantSlug: 'fixture-a', isCurrent });
    await panelApi.post('/fixture-write', { fixture: true }, { tenantSlug: 'fixture-a' });
    expect(seam.apiFetch.mock.calls[0][1].method).toBe('GET');
    expect(seam.apiFetch.mock.calls[0][1].isCurrent).toBe(isCurrent);
    expect(seam.apiFetch.mock.calls[1][1].method).toBe('POST');
    expect(seam.apiFetch.mock.calls[1][1]).not.toHaveProperty('isCurrent');
  });
});
afterEach(() => { cleanup(); cache.clear(); });

function fillReason(value = 'Revisión de un operador') {
  fireEvent.change(screen.getByRole('textbox', { name: /motivo/i }), { target: { value } });
}
function submit() { fireEvent.click(screen.getByRole('button', { name: actions.municipal.label })); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('municipal handoff continuity', () => {
  it('accepts a backing numeric UI id only with the exact municipal receipt identity', async () => {
    seam.apiFetch.mockResolvedValue(receipt());
    const confirmed = vi.fn();
    mount(actions.municipal, '42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(confirmed).toHaveBeenCalledTimes(1));
    const [path, options] = seam.apiFetch.mock.calls[0];
    expect(path).toBe('/api/v2/inbox/omnichannel/actions');
    expect(options.body).toMatchObject({ source_model: 'MunicipioTicket', ticket_id: 42, legacy_id: 42 });
    expect(options.headers['Idempotency-Key']).toMatch(/^[A-Za-z0-9_.:-]{8,128}$/);
  });

  it('retains the same key and exact payload for an explicit retry after an uncertain ACK', async () => {
    const calls: any[] = [];
    seam.apiFetch.mockImplementation(async (path: string, options: any) => {
      calls.push({ path, body: structuredClone(options.body), headers: { ...options.headers } });
      if (calls.length === 1) throw new Error('No recibimos confirmación de la operación.');
      return receipt();
    });
    const confirmed = vi.fn();
    mount(actions.municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(confirmed).not.toHaveBeenCalled();
    expect(seam.apiFetch).toHaveBeenCalledTimes(1); // No automatic retry.
    expect((screen.getByRole('textbox', { name: /motivo/i }) as HTMLTextAreaElement).value).toBe('Revisión de un operador');
    submit();
    await waitFor(() => expect(confirmed).toHaveBeenCalledTimes(1));
    expect(calls).toHaveLength(2);
    expect(calls[1].path).toBe(calls[0].path);
    expect(calls[1].body).toEqual(calls[0].body);
    expect(calls[1].headers['Idempotency-Key']).toBe(calls[0].headers['Idempotency-Key']);
    expect(calls[1].headers['X-Tenant-Slug']).toBe('fixture-a');
  });

  it('deduplicates a double click while the single POST remains pending', async () => {
    const pending = deferred<ReturnType<typeof receipt>>();
    seam.apiFetch.mockReturnValue(pending.promise);
    const confirmed = vi.fn();
    mount(actions.municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit(); submit();
    await waitFor(() => expect(seam.apiFetch).toHaveBeenCalledTimes(1));
    expect(confirmed).not.toHaveBeenCalled();
    await act(async () => pending.resolve(receipt()));
    await waitFor(() => expect(confirmed).toHaveBeenCalledTimes(1));
    expect(seam.apiFetch).toHaveBeenCalledTimes(1);
  });

  it('does not start a delayed mutation after its organization and ticket scope retire', async () => {
    const gate = deferred<void>();
    const entered = vi.fn();
    cache.setDefaultOptions({ mutations: { retry: false, gcTime: 0,
      onMutate: async () => { entered(); await gate.promise; } } });
    seam.apiFetch.mockResolvedValue(receipt());
    const oldConfirmed = vi.fn(), newConfirmed = vi.fn();
    const mounted = mount(actions.municipal, 'municipio:42', { onActionComplete: oldConfirmed });
    fillReason(); submit();
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    expect(seam.apiFetch).not.toHaveBeenCalled();
    const nextAction = { ...actions.municipal,
      payload_defaults: { ...actions.municipal.payload_defaults, ticket_id: 43, legacy_id: 43 } };
    mounted.rerender(<QueryClientProvider client={cache}><TicketAiHandoffControl
      ticketId="municipio:43" tenantSlug="fixture-b" actions={[nextAction]}
      onActionComplete={newConfirmed} /></QueryClientProvider>);
    await act(async () => gate.resolve());
    expect(seam.apiFetch).not.toHaveBeenCalled();
    expect(oldConfirmed).not.toHaveBeenCalled();
    expect(newConfirmed).not.toHaveBeenCalled();
    expect(screen.queryByTestId('handoff-action-result')).toBeNull();
  });

  it('does not start a delayed mutation after its control unmounts', async () => {
    const gate = deferred<void>();
    const entered = vi.fn();
    cache.setDefaultOptions({ mutations: { retry: false, gcTime: 0,
      onMutate: async () => { entered(); await gate.promise; } } });
    seam.apiFetch.mockResolvedValue(receipt());
    const confirmed = vi.fn();
    const mounted = mount(actions.municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    mounted.unmount();
    await act(async () => gate.resolve());
    expect(seam.apiFetch).not.toHaveBeenCalled();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it.each([
    ['another ticket', () => receipt('MunicipioTicket', 43)],
    ['a colliding TenantTicket', () => receipt('TenantTicket', 42)],
    ['another organization', () => receipt('MunicipioTicket', 42, 'fixture-b')],
    ['a missing organization', () => { const result = receipt(); return {
      ...result, tenant: undefined, ticket: { ...result.ticket, tenant_slug: undefined },
    }; }],
  ])('does not confirm an ACK for %s', async (_name, response) => {
    seam.apiFetch.mockResolvedValue(response());
    const confirmed = vi.fn();
    mount(actions.municipal, 'municipio:42', { onActionComplete: confirmed });
    fillReason(); submit();
    await waitFor(() => expect(seam.apiFetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.queryByTestId('handoff-action-result')).toBeNull();
    expect(seam.apiFetch).toHaveBeenCalledTimes(1);
  });
});
