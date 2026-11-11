import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
const addressB = 'Segunda calle 456';
const fixturePin = '7'.repeat(6);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const payload = (code = 'M-map-a', point = false, reportedAddress = address) => ({
  kind: 'claim', contract_version: 'tracking.experience.v1',
  tenant: { id: 51, slug: 'map-fixture', nombre: 'Fixture' },
  resource: { code, subject: 'Solicitud', channel: 'web' },
  status: { current_stage: 'recibido', label: 'Recibido' },
  timeline: [{ id: code, label: `Registro ${code}` }],
  location: { address: reportedAddress, lat: point ? -33.08 : null, lng: point ? -68.46 : null },
  support: { enabled: false },
  // An older backend can still advertise an external lookup and supply a link.
  map: { can_render: true, has_coordinates: point, address: reportedAddress,
    maps_search_url: `https://maps.google.com/?q=${encodeURIComponent(reportedAddress)}`,
    destination: point ? { lat: -33.08, lng: -68.46, name: reportedAddress } : null,
    fallback_when_no_coordinates: point ? 'timeline_only' : 'geocode_address',
    ui: { address_label: 'Dirección informada', search_address_label: 'Buscar dirección en el mapa',
      address_pending_message: 'Podés buscar la dirección informada en el mapa.', location_pending_label: 'Ubicación pendiente' },
    geocoding: { contract_version: 'tracking.address_geocoding.v1', enabled: !point, provider: 'nominatim',
      persists_coordinates: false,
      scope: { kind: 'claim', code, tenant_id: 51, tenant_slug: 'map-fixture' },
      jurisdiction: { city: 'Fixture City', province: 'Fixture Province', country: 'AR',
        bounds: { west: -68.6, south: -33.2, east: -68.3, north: -32.9 } },
      labels: { loading: 'Buscando la dirección dentro de su zona…',
        unavailable: 'No pudimos ubicar un único punto.', approximate: 'Ubicación orientativa de la dirección' } },
  },
});
let responseFor: (code: string) => Response;
let requests: URL[];
const writeClipboard = vi.fn<(value: string) => Promise<void>>();
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const caseUrl = (code: string) => `/tracking/claim/${code}?tenant_slug=map-fixture#pin=${fixturePin}`;

function Navigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate(caseUrl('M-map-b'))}>Caso B</button>
    <button onClick={() => navigate(caseUrl('M-map-a'))}>Caso A</button></>;
}

const renderPage = () => render(<MemoryRouter initialEntries={[caseUrl('M-map-a')]}>
  <Navigation /><Routes><Route path="/tracking/claim/:code" element={<TrackingExperiencePage kind="claim" />} /></Routes>
</MemoryRouter>);
const mapSection = () => screen.getByRole('region', { name: 'Mapa y recorrido' });
const externalRequests = () => requests.filter(url => url.origin !== window.location.origin);

beforeEach(() => {
  cleanup(); safeSessionStorage.clear(); safeLocalStorage.clear(); clearLocalChatbocSession();
  resetBackendBootstrapGateForTests(); vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  HTMLElement.prototype.scrollIntoView = vi.fn();
  responseFor = code => json(payload(code)); requests = [];
  writeClipboard.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: writeClipboard } });
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.origin);
    requests.push(url);
    if (url.origin === window.location.origin && url.pathname === '/api/public/tracking/experience') {
      return Promise.resolve(responseFor(url.searchParams.get('code')!));
    }
    // Record an unwanted request without contacting a provider.
    return Promise.resolve(json([]));
  }));
});

afterEach(() => {
  cleanup(); clearLocalChatbocSession(); safeLocalStorage.clear(); safeSessionStorage.clear();
  resetBackendBootstrapGateForTests(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('protected tracking address with real tracking transport', () => {
  it('keeps a typed address local even when the server offers a provider and a search link', async () => {
    renderPage(); await screen.findByText(/Registro m map a/i);
    expect(within(mapSection()).getByText(address)).toBeVisible();
    expect(externalRequests()).toHaveLength(0);
    expect(within(mapSection()).queryByRole('link')).not.toBeInTheDocument();
    expect(within(mapSection()).getByText(/El mapa se mostrará cuando el caso tenga coordenadas/)).toBeVisible();
    expect(screen.queryByTestId('tracking-map')).not.toBeInTheDocument();
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it('focuses the location section and copies only the address on explicit request', async () => {
    renderPage(); await screen.findByText(/Registro m map a/i);
    fireEvent.click(screen.getByRole('button', { name: 'Ver dirección' }));
    expect(mapSection()).toHaveFocus();
    fireEvent.click(within(mapSection()).getByRole('button', { name: 'Copiar dirección' }));
    expect(await within(mapSection()).findByText('Dirección copiada.')).toHaveAttribute('role', 'status');
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith(address);
    expect(externalRequests()).toHaveLength(0);
  });

  it('preserves the address and explains manual copy when clipboard access fails', async () => {
    writeClipboard.mockRejectedValueOnce(new Error('fixture denied'));
    renderPage(); await screen.findByText(/Registro m map a/i);
    fireEvent.click(within(mapSection()).getByRole('button', { name: 'Copiar dirección' }));
    expect(await within(mapSection()).findByText(/Podés seleccionarla y copiarla manualmente/)).toBeVisible();
    expect(within(mapSection()).getByText(address)).toBeVisible();
    expect(externalRequests()).toHaveLength(0);
  });

  it('renders existing coordinates without looking up the address or publishing a search link', async () => {
    responseFor = code => json(payload(code, true)); renderPage();
    expect(await screen.findByTestId('tracking-map')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ver mapa' })).toBeEnabled();
    expect(within(mapSection()).getByText('Dirección informada').parentElement).toHaveTextContent(address);
    expect(within(mapSection()).queryByRole('link')).not.toBeInTheDocument();
    expect(externalRequests()).toHaveLength(0);
  });

  it('keeps the previous address and copy feedback out of the next claim after navigation', async () => {
    let finishCopy!: () => void;
    writeClipboard.mockReturnValueOnce(new Promise<void>(resolve => { finishCopy = resolve; }));
    responseFor = code => json(payload(code, false, code === 'M-map-b' ? addressB : address));
    renderPage(); await screen.findByText(/Registro m map a/i);
    fireEvent.click(within(mapSection()).getByRole('button', { name: 'Copiar dirección' }));
    fireEvent.click(screen.getByRole('button', { name: 'Caso B' }));
    await screen.findByText(/Registro m map b/i);
    await act(async () => finishCopy());
    expect(within(mapSection()).getByText(addressB)).toBeVisible();
    expect(within(mapSection()).queryByText(address)).not.toBeInTheDocument();
    expect(within(mapSection()).queryByText('Dirección copiada.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Caso A' }));
    await screen.findByText(/Registro m map a/i);
    expect(within(mapSection()).getByText(address)).toBeVisible();
    expect(externalRequests()).toHaveLength(0);
  });

  it('withdraws the typed address and copy action after a denied credential change', async () => {
    renderPage(); await screen.findByText(/Registro m map a/i);
    fireEvent.change(screen.getByLabelText('PIN del reclamo'), { target: { value: '8'.repeat(6) } });
    responseFor = () => json({ error: 'claim_not_found' }, 404);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await screen.findByRole('alert');
    expect(screen.queryByText(address)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar dirección' })).not.toBeInTheDocument();
    expect(externalRequests()).toHaveLength(0);
  });
});
