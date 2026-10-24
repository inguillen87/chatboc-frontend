import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { clearLocalChatbocSession } from '@/utils/sessionLogout';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';

// Page, client, apiFetch and TrackingMap are real. HTTP and the GL engine are fixtures.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('socket.io-client', () => ({ io: vi.fn(() => { throw new Error('unexpected socket'); }) }));
vi.mock('maplibre-gl', () => {
  class Popup { setText() { return this; } }
  class Marker { setLngLat() { return this; } setPopup() { return this; } addTo() { return this; }
    getPopup() { return new Popup(); } remove() {} }
  class Map { addControl() {} fitBounds() {} resize() {} remove() {} on() {} }
  class LngLatBounds { extend() { return this; } }
  return { default: { Map, Marker, Popup, LngLatBounds, NavigationControl: class {} } };
});
import TrackingExperiencePage from './TrackingExperiencePage';

const address = 'Calle de prueba 123';
const safeMapUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
const fixturePin = () => '7'.repeat(6);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const payload = (code = 'M-map-a', point = false) => ({
  kind: 'claim', contract_version: 'tracking.experience.v1',
  tenant: { id: 51, slug: 'map-fixture', nombre: 'Fixture' },
  resource: { code, subject: 'Solicitud', channel: 'web' },
  status: { current_stage: 'recibido', label: 'Recibido' },
  timeline: [{ id: code, label: `Registro ${code}` }],
  location: { address, lat: point ? -33.08 : null, lng: point ? -68.46 : null },
  support: { enabled: false },
  map: { can_render: true, has_coordinates: point, address, maps_search_url: safeMapUrl,
    destination: point ? { lat: -33.08, lng: -68.46, name: address } : null,
    fallback_when_no_coordinates: point ? 'timeline_only' : 'geocode_address',
    ui: { address_label: 'Dirección informada', search_address_label: 'Buscar dirección en el mapa',
      address_pending_message: 'Todavía no hay un punto confirmado.', location_pending_label: 'Ubicación pendiente' },
    geocoding: { contract_version: 'tracking.address_geocoding.v1', enabled: !point, provider: 'nominatim',
      persists_coordinates: false,
      scope: { kind: 'claim', code, tenant_id: 51, tenant_slug: 'map-fixture' },
      jurisdiction: { city: 'Fixture City', province: 'Fixture Province', country: 'AR',
        bounds: { west: -68.6, south: -33.2, east: -68.3, north: -32.9 } },
      labels: { loading: 'Buscando la dirección dentro de su zona…',
        unavailable: 'No pudimos ubicar un único punto. Conservamos la dirección informada.',
        approximate: 'Ubicación orientativa de la dirección' } },
  },
});
const providerPoint = { lat: '-33.08', lon: '-68.46', addresstype: 'house',
  address: { city: 'Fixture City', state: 'Fixture Province', country_code: 'ar' } };
let responseFor: (code: string) => Response | Promise<Response>;
let geocodeFor: () => Response | Promise<Response>;
let requests: Array<{ url: URL; init?: RequestInit }>;
function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate(`/tracking/claim/M-map-b?tenant_slug=map-fixture#pin=${fixturePin()}`)}>Caso B</button>
    <button onClick={() => navigate(`/tracking/claim/M-map-a?tenant_slug=map-fixture#pin=${fixturePin()}`)}>Caso A</button></>;
}
const renderPage = () => render(<MemoryRouter initialEntries={[
  `/tracking/claim/M-map-a?tenant_slug=map-fixture#pin=${fixturePin()}`,
]}><Navigation /><Routes><Route path="/tracking/claim/:code" element={<TrackingExperiencePage kind="claim" />} /></Routes></MemoryRouter>);
const mapSection = () => screen.getByRole('heading', { name: 'Mapa y recorrido' }).closest('section')!;
const geoRequests = () => requests.filter(r => r.url.hostname === 'nominatim.openstreetmap.org');

beforeEach(() => {
  cleanup(); safeSessionStorage.clear(); safeLocalStorage.clear(); clearLocalChatbocSession();
  resetBackendBootstrapGateForTests(); vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  HTMLElement.prototype.scrollIntoView = vi.fn();
  responseFor = code => json(payload(code)); geocodeFor = () => json([]); requests = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin); requests.push({ url, init });
    if (url.pathname === '/api/public/tracking/experience') return Promise.resolve(responseFor(url.searchParams.get('code')!));
    if (url.hostname === 'nominatim.openstreetmap.org') return Promise.resolve(geocodeFor());
    throw new Error(`Unexpected fixture request ${url.origin}${url.pathname}`);
  }));
});
afterEach(() => {
  cleanup(); clearLocalChatbocSession(); safeLocalStorage.clear(); safeSessionStorage.clear();
  resetBackendBootstrapGateForTests(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe('verified address map with real tracking transport', () => {
  it.each(['empty', 'error'])('keeps the verified address and safe map action after provider %s', async mode => {
    geocodeFor = () => mode === 'empty' ? json([]) : Promise.reject(new TypeError('fixture unavailable'));
    renderPage();
    const link = await screen.findByRole('link', { name: 'Buscar dirección en el mapa' });
    expect(link).toHaveAttribute('href', safeMapUrl);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    expect(within(mapSection()).getByText(address)).toBeVisible();
    expect(await screen.findByText('No pudimos ubicar un único punto. Conservamos la dirección informada.')).toBeVisible();
    expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
  });

  it('uses only the backend scoped bounded query and marks a unique result as orientative', async () => {
    geocodeFor = () => json([providerPoint]); renderPage();
    expect(await screen.findByTestId('tracking-map')).toBeVisible();
    expect(screen.getByText('Ubicación orientativa de la dirección')).toBeVisible();
    const request = geoRequests()[0];
    expect(request.url.searchParams.get('bounded')).toBe('1');
    expect(request.url.searchParams.get('limit')).toBe('2');
    expect(request.url.searchParams.get('countrycodes')).toBe('ar');
    expect(request.url.searchParams.get('viewbox')).toBe('-68.6,-32.9,-68.3,-33.2');
    expect(request.init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(request.url.toString()).not.toContain(fixturePin());
  });

  it('preserves existing coordinates without consulting another provider', async () => {
    responseFor = code => json(payload(code, true)); renderPage();
    expect(await screen.findByTestId('tracking-map')).toBeVisible(); expect(geoRequests()).toHaveLength(0);
  });

  it.each([
    [providerPoint, { ...providerPoint, lon: '-68.45' }],
    [{ ...providerPoint, addresstype: 'city' }],
    [{ ...providerPoint, lat: 'NaN' }],
    [{ ...providerPoint, address: { ...providerPoint.address, country_code: 'xx' } }],
    [{ ...providerPoint, lon: '0' }],
  ])('does not plot an ambiguous, centroid, invalid or foreign result %#', async (...results) => {
    geocodeFor = () => json(results); renderPage();
    await screen.findByText('No pudimos ubicar un único punto. Conservamos la dirección informada.');
    expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar dirección en el mapa' })).toBeVisible();
  });

  it.each(['javascript:alert(1)', 'https://maps.google.com.evil.invalid/?q=x',
    `https://user@maps.google.com/?q=${encodeURIComponent(address)}`,
    `${safeMapUrl}&pin=synthetic-private`, `${safeMapUrl}#pin=synthetic-private`,
    'https://maps.google.com/?q=unrelated-secret'])('rejects an unsafe or unrelated map URL %#', async url => {
    responseFor = code => { const result = payload(code); result.map.maps_search_url = url; return json(result); };
    renderPage(); await screen.findByText(/Registro m map a/i);
    expect(screen.queryByRole('link', { name: 'Buscar dirección en el mapa' })).not.toBeInTheDocument();
  });

  it('keeps address visible without issuing a global query when the capability lacks authority', async () => {
    responseFor = code => { const result = payload(code); result.map.geocoding.enabled = false; return json(result); };
    renderPage(); await screen.findByRole('link', { name: 'Buscar dirección en el mapa' });
    expect(geoRequests()).toHaveLength(0); expect(within(mapSection()).getByText(address)).toBeVisible();
  });

  it('aborts the old geocode on A to B to A and ignores a transport that resolves after retirement', async () => {
    const pending = deferred<Response>(); let calls = 0;
    geocodeFor = () => ++calls === 1 ? pending.promise : json([]);
    renderPage(); await waitFor(() => expect(geoRequests()).toHaveLength(1));
    const firstSignal = geoRequests()[0].init?.signal;
    fireEvent.click(screen.getByRole('button', { name: 'Caso B' })); await screen.findByText(/Registro m map b/i);
    fireEvent.click(screen.getByRole('button', { name: 'Caso A' })); await screen.findByText(/Registro m map a/i);
    await act(async () => pending.resolve(json([providerPoint])));
    expect(firstSignal?.aborted).toBe(true); expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
  });

  it('retires geocoding when PIN changes and keeps denial free of the old location', async () => {
    const pending = deferred<Response>(); geocodeFor = () => pending.promise;
    renderPage(); await waitFor(() => expect(geoRequests()).toHaveLength(1)); const signal = geoRequests()[0].init?.signal;
    fireEvent.change(screen.getByLabelText('PIN del reclamo'), { target: { value: '8'.repeat(6) } });
    responseFor = () => json({ error: 'claim_not_found' }, 404);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' })); await screen.findByRole('alert');
    await act(async () => pending.resolve(json([providerPoint])));
    expect(signal?.aborted).toBe(true); expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Buscar dirección en el mapa' })).not.toBeInTheDocument();
  });

  it('aborts a geocode when the tracking page unmounts', async () => {
    const pending = deferred<Response>(); geocodeFor = () => pending.promise;
    const view = renderPage(); await waitFor(() => expect(geoRequests()).toHaveLength(1));
    const signal = geoRequests()[0].init?.signal; view.unmount();
    await act(async () => pending.resolve(json([providerPoint]))); expect(signal?.aborted).toBe(true);
  });

  it.each(['tenant', 'slug', 'code', 'bounds'])('requires exact capability authority for %s', async field => {
    responseFor = code => {
      const result = payload(code);
      if (field === 'tenant') result.map.geocoding.scope.tenant_id = 52;
      if (field === 'slug') result.map.geocoding.scope.tenant_slug = 'another-tenant';
      if (field === 'code') result.map.geocoding.scope.code = 'M-another-case';
      if (field === 'bounds') result.map.geocoding.jurisdiction.bounds.east = -69;
      return json(result);
    };
    renderPage(); await screen.findByRole('link', { name: 'Buscar dirección en el mapa' });
    expect(geoRequests()).toHaveLength(0); expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
  });

  it.each(['city', 'province', 'county-only'])('requires a matching city and province for %s', async field => {
    const point = { ...providerPoint, address: { ...providerPoint.address } };
    if (field === 'city') point.address.city = 'Another city';
    if (field === 'province') point.address.state = 'Another province';
    if (field === 'county-only') {
      delete (point.address as Partial<typeof point.address>).city;
      Object.assign(point.address, { county: 'Fixture City' });
    }
    geocodeFor = () => json([point]); renderPage();
    await screen.findByText('No pudimos ubicar un único punto. Conservamos la dirección informada.');
    expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
  });

  it('times out a stalled address provider without accepting its later result', async () => {
    const pending = deferred<Response>(); geocodeFor = () => pending.promise;
    try {
      vi.useFakeTimers();
      await act(async () => { renderPage(); });
      expect(geoRequests()).toHaveLength(1);
      const signal = geoRequests()[0].init?.signal;
      await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
      expect(screen.getByText('No pudimos ubicar un único punto. Conservamos la dirección informada.')).toBeVisible();
      await act(async () => pending.resolve(json([providerPoint])));
      expect(signal?.aborted).toBe(true); expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});
