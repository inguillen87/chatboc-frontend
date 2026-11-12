import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The page, public client and TrackingMap are real. HTTP, socket events, interval
// time and the GL provider are synthetic; this does not certify a live service.
const api = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), maps: [] as Array<any> }));
const realtime = vi.hoisted(() => {
  const handlers = new Map<string, (value?: unknown) => void>();
  const socket = {
    connected: false,
    on: vi.fn((event: string, handler: (value?: unknown) => void) => { handlers.set(event, handler); }),
    off: vi.fn((event: string) => { handlers.delete(event); }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return { handlers, socket, connect: vi.fn(() => socket) };
});
vi.mock('react-router-dom', async () => vi.importActual<typeof import('react-router-dom')>('react-router-dom'));
vi.mock('@/utils/api', () => ({
  apiFetch: (url: string, options: { method?: string }) =>
    options?.method === 'POST' ? api.write(url, options) : api.read(url, options),
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));
vi.mock('@/config', () => ({ getSocketUrl: () => 'https://socket.fixture.invalid', SOCKET_PATH: '/socket.io' }));
vi.mock('socket.io-client', () => ({ io: realtime.connect }));
vi.mock('maplibre-gl', () => {
  class Popup { setText() { return this; } }
  class Marker {
    popup: Popup | undefined;
    setLngLat() { return this; }
    setPopup(popup: Popup) { this.popup = popup; return this; }
    getPopup() { return this.popup; }
    addTo() { return this; }
    remove() {}
  }
  class Map {
    constructor() { api.maps.push(this); }
    addControl() {}
    on() {}
    resize() {}
    fitBounds = vi.fn();
    remove = vi.fn();
  }
  class LngLatBounds { extend() { return this; } }
  return { default: { Map, Marker, Popup, LngLatBounds, NavigationControl: class {} } };
});

import TrackingExperiencePage from './TrackingExperiencePage';

const pin = () => '7'.repeat(6);
const initialCode = 'M-refresh-fixture-a';
const initialTenant = 'refresh-fixture';
const payload = (live = false, code = initialCode, tenant = initialTenant) => ({
  contract_version: 'tracking.experience.v1', kind: 'claim',
  tenant: { id: 51, slug: tenant, nombre: 'Organización sintética' },
  resource: { code, subject: `Solicitud ${code}`, updated_at: '2026-11-12T12:00:00Z' },
  status: { current_stage: 'asignado', label: 'Asignado', detail: 'Actividad inicial verificada' },
  timeline: [{ id: 'event-1', label: 'Asignación registrada', timestamp: '2026-11-12T12:00:00Z' }],
  map: { can_render: true, destination: { lat: -33.08, lng: -68.46 } },
  support: {
    enabled: true, mode: live ? 'live' : 'offline',
    ticket: { id: 41, requires_pin: true },
    endpoints: { send_message: '/api/public/tracking/claims/41/messages' },
    polling: { interval_ms: 15_000 },
    cta: { primary: { label: 'Enviar consulta sintética' } },
    socket: { enabled: live, room: 'ticket-fixture-41', access_token: 'synthetic-room-access', event: 'new_chat_message' },
    conversation: { messages: [] },
  },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const destination = (code = initialCode, tenant = initialTenant) =>
  `/tracking/claim/${code}?tenant_slug=${tenant}#pin=${pin()}`;
function Navigation() {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate(destination('M-refresh-fixture-b'))}>Cambiar caso</button>
    <button onClick={() => navigate(destination(initialCode, 'another-fixture'))}>Cambiar organización</button>
  </>;
}
async function renderPage() {
  await act(async () => {
    render(<MemoryRouter initialEntries={[destination()]}>
      <Navigation />
      <Routes><Route path="/tracking/claim/:code" element={<TrackingExperiencePage kind="claim" />} /></Routes>
    </MemoryRouter>);
  });
  await screen.findByTestId('tracking-map');
  await waitFor(() => expect(api.maps).toHaveLength(1));
  const composer = screen.getByLabelText<HTMLTextAreaElement>('Mensaje para la mesa de ayuda');
  composer.focus();
  fireEvent.change(composer, { target: { value: 'Consulta en preparación' } });
  composer.setSelectionRange(8, 8);
  return { composer, map: api.maps[0], mapElement: screen.getByTestId('tracking-map') };
}
const poll = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(15_000); }); };
const socketRefresh = async () => {
  await act(async () => { realtime.handlers.get('ticket.status.changed')?.({ ticket_id: 41 }); });
};
const updatedPayload = (live = false) => {
  const next = payload(live);
  next.status.detail = 'Actualización confirmada';
  return next;
};

beforeAll(async () => { await import('@/components/ui/TrackingMap'); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  api.read.mockReset(); api.write.mockReset(); api.maps.length = 0;
  realtime.handlers.clear(); realtime.connect.mockClear(); realtime.socket.disconnect.mockClear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('tracking background refresh interaction continuity', () => {
  it.each(['polling', 'socket'] as const)('keeps focused composition and the map mounted across a %s refresh', async (source) => {
    const live = source === 'socket';
    const pending = deferred<ReturnType<typeof payload>>();
    api.read.mockResolvedValueOnce(payload(live)).mockReturnValueOnce(pending.promise);
    const { composer, map, mapElement } = await renderPage();

    await (live ? socketRefresh() : poll());
    expect(api.read).toHaveBeenCalledTimes(2);
    expect(composer).toBeInTheDocument();
    expect(composer).toHaveFocus();
    expect(composer.selectionStart).toBe(8);
    expect(screen.getByLabelText('Mensaje para la mesa de ayuda')).toBe(composer);
    expect(screen.getByTestId('tracking-map')).toBe(mapElement);
    expect(map.remove).not.toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enviar consulta sintética' })).toBeDisabled();
    fireEvent.change(composer, { target: { value: 'Consulta completada durante la lectura' } });

    await act(async () => { pending.resolve(updatedPayload(live)); });
    expect(await screen.findByText('Actualización confirmada')).toBeVisible();
    expect(composer).toHaveFocus();
    expect(composer).toHaveValue('Consulta completada durante la lectura');
    expect(api.maps).toHaveLength(1);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enviar consulta sintética' })).toBeEnabled();
    expect(api.write).not.toHaveBeenCalled();
  });

  it('prevents a form submission during a pending refresh and permits an explicit send after verification', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    api.read.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise);
    api.write.mockResolvedValueOnce({ tracking: updatedPayload(), message: 'Confirmación sintética' });
    const { composer } = await renderPage();
    const form = composer.closest('form')!;

    await poll();
    expect(form).toBeInTheDocument();
    fireEvent.submit(form);
    expect(api.write).not.toHaveBeenCalled();
    await act(async () => { pending.resolve(updatedPayload()); });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta sintética' }));
    await waitFor(() => expect(api.write).toHaveBeenCalledTimes(1));
    expect(api.write).toHaveBeenCalledWith('/api/public/tracking/claims/41/messages', expect.objectContaining({
      method: 'POST', pin: pin(), body: expect.objectContaining({ comentario: 'Consulta en preparación' }),
    }));
  });

  it.each([401, 403, 404])('retires all verified content after a background denial with HTTP %s', async (status) => {
    const pending = deferred<ReturnType<typeof payload>>();
    api.read.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise);
    const { composer, map } = await renderPage();
    await poll();
    await act(async () => { pending.reject(Object.assign(new Error('Synthetic denial'), { status })); });

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(composer).not.toBeInTheDocument();
    expect(screen.queryByText('Estado actual')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
    expect(map.remove).toHaveBeenCalledOnce();
    expect(api.write).not.toHaveBeenCalled();
  });

  it.each(['reference', 'organization'] as const)('retires the preceding content when a background response has a different %s', async (mismatch) => {
    const pending = deferred<ReturnType<typeof payload>>();
    api.read.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise);
    const { composer } = await renderPage();
    await poll();
    const invalid = mismatch === 'reference' ? payload(false, 'M-another-case')
      : payload(false, initialCode, 'another-fixture');
    await act(async () => { pending.resolve(invalid); });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(composer).not.toBeInTheDocument();
    expect(screen.queryByText('Estado actual')).not.toBeInTheDocument();
  });

  it('retires a pending background result on PIN edits, even when the original PIN is restored', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    api.read.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise);
    const { composer, map } = await renderPage();
    await poll();
    const field = screen.getByLabelText('PIN del reclamo');
    fireEvent.change(field, { target: { value: '8'.repeat(6) } });
    fireEvent.change(field, { target: { value: pin() } });
    expect(composer).not.toBeInTheDocument();
    expect(map.remove).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve(updatedPayload()); });
    expect(screen.queryByText('Actualización confirmada')).not.toBeInTheDocument();
    expect(screen.queryByText('Estado actual')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled();
    expect(api.read).toHaveBeenCalledTimes(2);
  });

  it.each(['caso', 'organización'] as const)('retires the background read and draft immediately when changing %s', async (scope) => {
    const previous = deferred<ReturnType<typeof payload>>();
    const current = deferred<ReturnType<typeof payload>>();
    api.read.mockResolvedValueOnce(payload()).mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise);
    const { composer, map } = await renderPage();
    await poll();
    fireEvent.click(screen.getByRole('button', { name: `Cambiar ${scope}` }));
    await waitFor(() => expect(api.read).toHaveBeenCalledTimes(3));
    expect(composer).not.toBeInTheDocument();
    expect(map.remove).toHaveBeenCalledOnce();
    await act(async () => { previous.resolve(updatedPayload()); });
    expect(screen.queryByText('Actualización confirmada')).not.toBeInTheDocument();
    expect(screen.queryByText('Estado actual')).not.toBeInTheDocument();
    const next = scope === 'caso' ? payload(false, 'M-refresh-fixture-b') : payload(false, initialCode, 'another-fixture');
    await act(async () => { current.resolve(next); });
    expect(await screen.findByLabelText('Mensaje para la mesa de ayuda')).toHaveValue('');
  });

  it('keeps manual refresh semantics: the preceding record is withdrawn while checking access', async () => {
    const pending = deferred<ReturnType<typeof payload>>();
    api.read.mockResolvedValueOnce(payload()).mockReturnValueOnce(pending.promise);
    const { composer, map } = await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
    expect(composer).not.toBeInTheDocument();
    expect(map.remove).toHaveBeenCalledOnce();
    expect(screen.queryByText('Estado actual')).not.toBeInTheDocument();
    await act(async () => { pending.resolve(updatedPayload()); });
    expect(await screen.findByText('Actualización confirmada')).toBeVisible();
  });

  it('does not replace a newer socket refresh with an older support acknowledgement', async () => {
    const background = deferred<ReturnType<typeof payload>>();
    const acknowledgement = deferred<Record<string, unknown>>();
    api.read.mockResolvedValueOnce(payload(true)).mockReturnValueOnce(background.promise);
    api.write.mockReturnValueOnce(acknowledgement.promise);
    const { map } = await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar consulta sintética' }));
    await waitFor(() => expect(api.write).toHaveBeenCalledTimes(1));
    await socketRefresh();
    const older = payload(true);
    older.status.detail = 'Estado antiguo del ACK';
    await act(async () => { acknowledgement.resolve({ tracking: older, message: 'Confirmación sintética' }); });
    expect(screen.queryByText('Estado antiguo del ACK')).not.toBeInTheDocument();
    expect(api.read).toHaveBeenCalledTimes(2);
    await act(async () => { background.resolve(updatedPayload(true)); });
    expect(await screen.findByText('Actualización confirmada')).toBeVisible();
    expect(screen.queryByText('Estado antiguo del ACK')).not.toBeInTheDocument();
    expect(api.maps).toHaveLength(1);
    expect(map.remove).not.toHaveBeenCalled();
  });
});
