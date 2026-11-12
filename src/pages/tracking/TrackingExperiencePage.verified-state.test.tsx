import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn() }));
vi.mock('react-router-dom', async () =>
  vi.importActual<typeof import('react-router-dom')>('react-router-dom'));
vi.mock('@/api/trackingExperience', () => ({
  fetchTrackingExperience: (...args: unknown[]) => api.load(...args),
  sendTrackingSupportMessage: (...args: unknown[]) => api.send(...args),
}));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('@/components/ui/TrackingMap', () => ({ default: () => <div>Map fixture</div> }));

import TrackingExperiencePage from './TrackingExperiencePage';

const fixturePin = () => '8'.repeat(6);
const payload = (code: string, title = 'Solicitud verificada') => ({
  contract_version: 'tracking.experience.v1', kind: 'claim',
  tenant: { slug: 'fixture-tenant', nombre: 'Organización verificada' },
  resource: { code, subject: title, category: 'Categoría publicada', channel: 'web',
    created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:05:00Z' },
  status: { current_stage: 'asignado', label: 'Asignado', progress_percent: 50 },
  milestones: [{ key: 'recibido', label: 'Recibido' }, { key: 'asignado', label: 'Asignado' }, { key: 'resuelto', label: 'Resuelto' }],
  timeline: [{ id: 'verified-event', label: title, timestamp: '2026-10-01T12:05:00Z' }],
  map: { can_render: false }, support: { enabled: false },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const destination = (code: string, tenant = 'fixture-tenant') =>
  `/tracking/claim/${code}?tenant_slug=${tenant}#pin=${fixturePin()}`;
function NavigationFixture() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate(destination('M-fixture-route-b'))}>Otra referencia</button>
    <button onClick={() => navigate(destination('M-fixture-route-a'))}>Referencia inicial</button>
    <button onClick={() => navigate('/tracking/claim/M-fixture-tenant-memory?tenant_slug=another-tenant')}>Otra organización sin PIN</button></>;
}
function renderPage(entry: string, navigation = false, kind: 'claim' | 'order' = 'claim') {
  return render(<MemoryRouter initialEntries={[entry]}>
    {navigation ? <NavigationFixture /> : null}
    <Routes><Route path={`/tracking/${kind}/:code`} element={<TrackingExperiencePage kind={kind} />} /></Routes>
  </MemoryRouter>);
}
function expectNoVerifiedRecord() {
  expect(screen.queryByText('Estado actual')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText('Timeline')).not.toBeInTheDocument();
  expect(screen.queryByText('General')).not.toBeInTheDocument();
  expect(screen.queryByText('Detalles y diagnostico')).not.toBeInTheDocument();
}

describe('TrackingExperiencePage verified data boundary', () => {
  beforeEach(() => { api.load.mockReset(); api.send.mockReset(); HTMLElement.prototype.scrollIntoView = vi.fn(); });

  it('shows only the access form before any valid PIN or response', () => {
    renderPage('/tracking/claim/M-fixture-no-access');
    expectNoVerifiedRecord();
    expect(screen.getByLabelText('PIN del reclamo')).toBeVisible();
    expect(api.load).not.toHaveBeenCalled();
  });

  it('does not invent a status or percentage during the first pending read', async () => {
    const pending = deferred<ReturnType<typeof payload>>(); api.load.mockReturnValueOnce(pending.promise);
    renderPage(destination('M-fixture-pending'));
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(1));
    expectNoVerifiedRecord();
    await act(async () => pending.resolve(payload('M-fixture-pending')));
    expect(await screen.findByText('Estado actual')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    fireEvent.click(screen.getByText('Detalles y diagnostico'));
    expect(screen.getByText('Categoría publicada')).toBeVisible();
  });

  it('keeps the entered PIN and explicit retry after a denied lookup, without fake data', async () => {
    api.load.mockRejectedValueOnce(Object.assign(new Error('Reclamo no encontrado'), { status: 404 }));
    renderPage('/tracking/claim/M-fixture-denied');
    const field = screen.getByLabelText('PIN del reclamo');
    fireEvent.change(field, { target: { value: fixturePin() } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expectNoVerifiedRecord();
    expect((field as HTMLInputElement).value === fixturePin()).toBe(true);
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled();
  });

  it('rejects an empty HTTP-200 payload instead of treating it as received', async () => {
    api.load.mockResolvedValueOnce({});
    renderPage(destination('M-fixture-empty'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expectNoVerifiedRecord();
  });

  it.each([
    ['missing resource', { status: { current_stage: 'recibido' } }],
    ['missing status', { resource: { code: 'M-fixture-invalid' } }],
    ['different reference', payload('M-fixture-other')],
    ['different kind', { ...payload('M-fixture-invalid'), kind: 'order' }],
    ['different explicit organization', { ...payload('M-fixture-invalid'), tenant: { slug: 'another-tenant' } }],
  ])('does not display a response with %s', async (_case, response) => {
    api.load.mockResolvedValueOnce(response);
    renderPage(destination('M-fixture-invalid'));
    expect(await screen.findByRole('alert')).toBeVisible();
    expectNoVerifiedRecord();
  });

  it('accepts compatible future payloads without inventing missing optional facts', async () => {
    api.load.mockResolvedValueOnce({
      contract_version: 'tracking.experience.v2', kind: 'claim',
      resource: { code: 'M-fixture-minimal' }, status: 'asignado', support: { enabled: false },
    });
    renderPage(destination('M-fixture-minimal'));
    expect(await screen.findByText('Estado actual')).toBeVisible();
    expect(screen.getByText('Asignado')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('General')).not.toBeInTheDocument();
    expect(screen.queryByText('Proxima etapa')).not.toBeInTheDocument();
    expect(screen.queryByText('Seguimiento finalizado')).not.toBeInTheDocument();
    expect(screen.queryByText('Recibido')).not.toBeInTheDocument();
    expect(screen.getByText('0 eventos')).toBeVisible();
  });

  it('accepts a server claim prefix for an unprefixed route without rewriting the requested code', async () => {
    api.load.mockResolvedValueOnce(payload('M-fixture-unprefixed'));
    renderPage(destination('fixture-unprefixed'));
    expect(await screen.findByText('Estado actual')).toBeVisible();
    expect(api.load).toHaveBeenCalledWith(expect.objectContaining({ code: 'fixture-unprefixed', pin: fixturePin() }));
  });

  it('preserves case-insensitive claim lookup while sending the original reference unchanged', async () => {
    api.load.mockResolvedValueOnce(payload('M-Fixture-MixedCase'));
    renderPage(destination('fixture-mixedcase'));
    expect(await screen.findByText('Estado actual')).toBeVisible();
    expect(api.load).toHaveBeenCalledWith(expect.objectContaining({ code: 'fixture-mixedcase' }));
  });

  it('supports the isolated T- receipt namespace with a real string status and no invented stages', async () => {
    const response = payload('T-47');
    api.load.mockResolvedValueOnce({ ...response, resource: { ...response.resource, source_model: 'TenantTicket' }, status: 'validando', milestones: [] });
    renderPage(destination('t-47'));
    expect(await screen.findByText('Estado actual')).toBeVisible();
    expect(screen.getByText('Validando')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(api.load).toHaveBeenCalledWith(expect.objectContaining({ code: 't-47' }));
  });

  it.each([
    ['market:47', 'market:47', 'market:47', 'MarketOrder'],
    ['MO-47', 'market:47', 'market:47', 'MarketOrder'],
    ['00047', 'market:47', 'market:47', 'MarketOrder'],
    ['conversational:47', 'pc-47', 'conversational:47', 'PedidoConversacional'],
    ['PC-47', 'tracking-publico-fixture', 'conversational:47', 'PedidoConversacional'],
    ['47', 'tracking-publico-fixture', 'conversational:47', 'PedidoConversacional'],
    ['pedido-opaco-fixture', 'pedido-opaco-fixture', 'legacy:47', 'PymePedido'],
  ])('accepts the backend order reference %s and its declared identity', async (requestedCode, returnedCode, id, source_model) => {
    api.load.mockResolvedValueOnce({ kind: 'order', resource: { code: returnedCode, id, source_model }, status: 'preparando', support: { enabled: false } });
    renderPage(`/tracking/order/${encodeURIComponent(requestedCode)}#token=synthetic-order-token`, false, 'order');
    expect(await screen.findByText('Estado actual')).toBeVisible();
    expect(api.load).toHaveBeenCalledWith(expect.objectContaining({ kind: 'order', code: requestedCode, token: 'synthetic-order-token' }));
  });

  it.each([
    ['mo-47', 'market:48', 'MarketOrder'],
    ['pc-47', 'market:47', 'MarketOrder'],
    ['mo-47', 'market:47', 'PedidoConversacional'],
  ])('rejects an unrelated order identity for %s / %s / %s', async (requestedCode, id, source_model) => {
    api.load.mockResolvedValueOnce({ kind: 'order', resource: { code: 'another-order', id, source_model }, status: 'preparando' });
    renderPage(`/tracking/order/${requestedCode}#token=synthetic-order-token`, false, 'order');
    expect(await screen.findByRole('alert')).toBeVisible();
    expectNoVerifiedRecord();
  });

  it('retires an in-flight read when its PIN draft is edited, including ABA edits', async () => {
    const pending = deferred<ReturnType<typeof payload>>(); api.load.mockReturnValueOnce(pending.promise);
    renderPage(destination('M-fixture-pin-edited'));
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(1));
    const field = screen.getByLabelText('PIN del reclamo');
    fireEvent.change(field, { target: { value: '9'.repeat(6) } });
    fireEvent.change(field, { target: { value: fixturePin() } });
    await act(async () => pending.resolve(payload('M-fixture-pin-edited')));
    expectNoVerifiedRecord();
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled();
  });

  it('retires a verified record immediately when the PIN draft changes and waits for an explicit retry', async () => {
    api.load.mockResolvedValueOnce(payload('M-fixture-pin-retire'));
    renderPage(destination('M-fixture-pin-retire'));
    expect(await screen.findByText('Estado actual')).toBeVisible();
    const field = screen.getByLabelText('PIN del reclamo');
    fireEvent.change(field, { target: { value: '9'.repeat(6) } });
    expectNoVerifiedRecord();
    expect(api.load).toHaveBeenCalledTimes(1);
    expect((field as HTMLInputElement).value === '9'.repeat(6)).toBe(true);
  });

  it('blocks duplicate reads from the same pending submit', async () => {
    api.load.mockReturnValueOnce(new Promise(() => {}));
    renderPage('/tracking/claim/M-fixture-duplicate');
    fireEvent.change(screen.getByLabelText('PIN del reclamo'), { target: { value: fixturePin() } });
    const form = screen.getByRole('button', { name: 'Actualizar estado' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(1));
    expectNoVerifiedRecord();
  });

  it('does not reuse a remembered PIN for the same reference in another organization', async () => {
    api.load.mockResolvedValueOnce(payload('M-fixture-tenant-memory'));
    renderPage(destination('M-fixture-tenant-memory'), true);
    expect(await screen.findByText('Estado actual')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Otra organización sin PIN' }));
    expectNoVerifiedRecord();
    expect((screen.getByLabelText('PIN del reclamo') as HTMLInputElement).value.length).toBe(0);
    expect(api.load).toHaveBeenCalledTimes(1);
  });

  it('supports an explicit keyboard retry after a denied lookup', async () => {
    const user = userEvent.setup();
    api.load.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
      .mockResolvedValueOnce(payload('M-fixture-keyboard'));
    renderPage('/tracking/claim/M-fixture-keyboard');
    const field = screen.getByLabelText('PIN del reclamo');
    await user.type(field, fixturePin());
    await user.keyboard('{Enter}');
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
    expectNoVerifiedRecord();
    screen.getByRole('button', { name: 'Actualizar estado' }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Estado actual')).toBeVisible();
    expect(api.load).toHaveBeenCalledTimes(2);
  });

  it('does not republish a support response after editing the access PIN', async () => {
    const response = payload('M-fixture-support-retire');
    const pending = deferred<Record<string, unknown>>();
    api.load.mockResolvedValueOnce({ ...response, support: {
      enabled: true, endpoints: { send_message: '/fixture/support' },
    } });
    api.send.mockReturnValueOnce(pending.promise);
    renderPage(destination('M-fixture-support-retire'));
    await screen.findByText('Estado actual');
    fireEvent.change(screen.getByLabelText('Mensaje para la mesa de ayuda'), { target: { value: 'Consulta sintética' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dejar mensaje para el equipo' }));
    await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('PIN del reclamo'), { target: { value: '9'.repeat(6) } });
    await act(async () => pending.resolve({ tracking: response, message: 'ACK retirado' }));
    expectNoVerifiedRecord();
    expect(screen.queryByText('ACK retirado')).not.toBeInTheDocument();
    expect(api.load).toHaveBeenCalledTimes(1);
  });

  it('retires a previously verified record while refresh is pending and after refresh denial', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    api.load.mockResolvedValueOnce(payload('M-fixture-refresh', 'Respuesta anterior verificada')).mockReturnValueOnce(pending.promise);
    renderPage(destination('M-fixture-refresh'));
    expect(await screen.findByText('Estado actual')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(2));
    expectNoVerifiedRecord();
    await act(async () => pending.reject(Object.assign(new Error('Reclamo no encontrado'), { status: 404 })));
    expect(screen.getByRole('alert')).toBeVisible();
    expectNoVerifiedRecord();
    expect(screen.queryByText('Respuesta anterior verificada')).not.toBeInTheDocument();
  });

  it('does not publish a late response from the previous route or an earlier ABA visit', async () => {
    const firstA = deferred<ReturnType<typeof payload>>();
    api.load.mockReturnValueOnce(firstA.promise)
      .mockResolvedValueOnce(payload('M-fixture-route-b', 'Respuesta de B'))
      .mockResolvedValueOnce(payload('M-fixture-route-a', 'Respuesta actual de A'));
    renderPage(destination('M-fixture-route-a'), true);
    await waitFor(() => expect(api.load).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Otra referencia' }));
    await waitFor(() => expect(screen.getAllByText('Respuesta de B').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Referencia inicial' }));
    await waitFor(() => expect(screen.getAllByText('Respuesta actual de A').length).toBeGreaterThan(0));
    await act(async () => firstA.resolve(payload('M-fixture-route-a', 'Respuesta antigua de A')));
    expect(screen.queryByText('Respuesta antigua de A')).not.toBeInTheDocument();
    expect(screen.getAllByText('Respuesta actual de A').length).toBeGreaterThan(0);
  });
});
