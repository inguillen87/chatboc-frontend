import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrackingMap from './TrackingMap';
const state = vi.hoisted(() => ({ shouldThrow: false, maps: [] as any[], markers: [] as any[] }));
vi.mock('maplibre-gl', () => {
  class Popup { text = ''; setText(text: string) { this.text = text; return this; } }
  class Marker {
    popup: Popup | null = null; position: number[] = [];
    constructor(public options: any) { state.markers.push(this); }
    setLngLat(position: number[]) { this.position = position; return this; }
    setPopup(popup: Popup) { this.popup = popup; return this; }
    addTo() { return this; }
    getPopup() { return this.popup; }
    remove = vi.fn();
  }
  class Map {
    events: Record<string, () => void> = {};
    constructor(public options: any) { if (state.shouldThrow) throw new Error('unavailable'); state.maps.push(this); }
    addControl = vi.fn(); fitBounds = vi.fn(); resize = vi.fn(); remove = vi.fn();
    on(name: string, callback: () => void) { this.events[name] = callback; }
  }
  class LngLatBounds { extend = vi.fn(() => this); }
  return { default: { Map, Marker, Popup, LngLatBounds, NavigationControl: vi.fn() } };
});
const store = { lat: -33.08, lng: -68.48, name: 'Municipio' };
const customer = { lat: -33.079, lng: -68.47, name: 'Ubicación recibida' };
beforeEach(() => { state.shouldThrow = false; state.maps.length = 0; state.markers.length = 0; });
afterEach(() => { cleanup(); delete document.documentElement.dataset.reduceMotion; });
describe('TrackingMap reported-data contract', () => {
  it('renders real endpoints, attribution and no decorative route or fictitious driver', () => {
    const { container } = render(<TrackingMap storeLocation={store} customerLocation={customer} status="enviado" />);
    expect(screen.getByTestId('tracking-map')).toBeInTheDocument();
    expect(screen.getByTestId('tracking-map-hud')).toHaveTextContent('Ubicaciones informadas');
    expect(screen.queryByTestId('tracking-map-route')).not.toBeInTheDocument();
    expect(screen.queryByText('Movil en campo')).not.toBeInTheDocument();
    expect(container.querySelector('animateMotion')).toBeNull();
    expect(state.markers.map((marker) => marker.position)).toEqual([[-68.48, -33.08], [-68.47, -33.079]]);
    expect(state.maps[0].options.attributionControl).not.toBe(false);
  });
  it('initializes no map, provider or marker without valid coordinates', () => {
    render(<TrackingMap customerLocation={{ lat: 99, lng: 0 }} status="enviado" />);
    expect(screen.getByTestId('tracking-map-empty')).toBeVisible(); expect(state.maps).toHaveLength(0); expect(state.markers).toHaveLength(0);
  });
  it('keeps a useful timeline fallback when MapLibre cannot initialize', () => {
    state.shouldThrow = true; render(<TrackingMap customerLocation={customer} status="recibido" />);
    expect(screen.getByTestId('tracking-map-fallback')).toHaveTextContent('Seguimiento por timeline');
    expect(screen.getByText('Ubicación recibida')).toBeVisible();
  });
  it('uses only real driver coordinates and removes a driver when permission is withdrawn', () => {
    const driver = { lat: -33.01, lng: -68.44 };
    const view = render(<TrackingMap customerLocation={customer} driverLocation={driver} status="enviado" />);
    expect(state.markers[1].position).toEqual([-68.44, -33.01]);
    view.rerender(<TrackingMap customerLocation={customer} driverLocation={driver} status="enviado" showDriverMarker={false} />);
    expect(state.markers[1].remove).toHaveBeenCalledOnce();
  });
  it('updates popup text without resetting the viewport or creating another provider', () => {
    const view = render(<TrackingMap customerLocation={customer} status="en_proceso" />);
    view.rerender(<TrackingMap customerLocation={{ ...customer, name: 'Nombre actualizado' }} status="en_proceso" />);
    expect(state.maps).toHaveLength(1); expect(state.maps[0].fitBounds).toHaveBeenCalledTimes(1);
    expect(state.markers[0].popup.text).toBe('Nombre actualizado');
  });
  it('does not move the camera merely because motion preference changed', () => {
    const view = render(<TrackingMap customerLocation={customer} status="en_proceso" />);
    document.documentElement.dataset.reduceMotion = 'true';
    view.rerender(<TrackingMap customerLocation={customer} status="en_proceso" />);
    expect(state.maps[0].fitBounds).toHaveBeenCalledTimes(1);
    view.rerender(<TrackingMap customerLocation={{ ...customer, lat: -33.07 }} status="en_proceso" />);
    expect(state.maps[0].fitBounds.mock.calls[1][1]).toMatchObject({ duration: 0, essential: false });
  });
  it('cleans up markers and map when coordinates are withdrawn', () => {
    const view = render(<TrackingMap customerLocation={customer} status="en_proceso" />);
    view.rerender(<TrackingMap status="en_proceso" />);
    expect(state.maps[0].remove).toHaveBeenCalledOnce(); expect(state.markers[0].remove).toHaveBeenCalledOnce();
    expect(screen.getByTestId('tracking-map-empty')).toBeVisible();
  });
  it('initializes correctly if coordinates arrive after the empty state', () => {
    const view = render(<TrackingMap status="enviado" />);
    view.rerender(<TrackingMap customerLocation={customer} status="enviado" />);
    expect(state.maps).toHaveLength(1); expect(state.markers).toHaveLength(1);
  });
  it('falls back on provider failure before load and releases resources', () => {
    render(<TrackingMap customerLocation={customer} status="enviado" />);
    act(() => state.maps[0].events.error());
    expect(screen.getByTestId('tracking-map-fallback')).toBeVisible(); expect(state.maps[0].remove).toHaveBeenCalledOnce();
  });
  it('does not discard a loaded map after a transient tile error', () => {
    render(<TrackingMap customerLocation={customer} status="enviado" />);
    act(() => { state.maps[0].events.load(); state.maps[0].events.error(); });
    expect(screen.getByTestId('tracking-map')).toBeVisible(); expect(state.maps[0].remove).not.toHaveBeenCalled();
  });
  it('supports backend-owned labels without municipality-specific branches', () => {
    render(<TrackingMap status="nuevo" labels={{ title: 'Ubicación del trámite', empty: 'El expediente no informó coordenadas.' }} />);
    expect(screen.getByRole('heading', { name: 'Ubicación del trámite' })).toBeVisible();
    expect(screen.getByText('El expediente no informó coordenadas.')).toBeVisible();
  });
});
