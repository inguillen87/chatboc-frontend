import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TrackingMap from './TrackingMap';

const maplibreState = vi.hoisted(() => ({
  shouldThrow: false,
}));

vi.mock('maplibre-gl', () => {
  class MockPopup {
    text = '';

    setText(text: string) {
      this.text = text;
      return this;
    }
  }

  class MockMarker {
    lngLat: [number, number] = [0, 0];
    popup: MockPopup | null = null;

    setLngLat(value: [number, number]) {
      this.lngLat = value;
      return this;
    }

    setPopup(value: MockPopup) {
      this.popup = value;
      return this;
    }

    addTo() {
      return this;
    }

    remove() {
      return this;
    }

    getPopup() {
      return this.popup;
    }

    getLngLat() {
      return { lng: this.lngLat[0], lat: this.lngLat[1] };
    }
  }

  class MockLngLatBounds {
    extend = vi.fn(() => this);
  }

  class MockMap {
    constructor() {
      if (maplibreState.shouldThrow) {
        throw new Error('map unavailable');
      }
    }

    addControl = vi.fn();
    on = vi.fn();
    fitBounds = vi.fn();
    easeTo = vi.fn();
    remove = vi.fn();
  }

  const mockMaplibre = {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    NavigationControl: vi.fn(),
    LngLatBounds: MockLngLatBounds,
  };

  return {
    __esModule: true,
    default: mockMaplibre,
    ...mockMaplibre,
  };
});

describe('TrackingMap', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    maplibreState.shouldThrow = false;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('renders a premium telemetry route for active tracking states', () => {
    render(
      <TrackingMap
        storeLocation={{ lat: -33.08, lng: -68.48, name: 'Municipio' }}
        customerLocation={{ lat: -33.079, lng: -68.47, name: 'Don Bosco 55' }}
        status="en_proceso"
      />,
    );

    expect(screen.getByTestId('tracking-map')).toBeInTheDocument();
    expect(screen.getByTestId('tracking-map-telemetry')).toBeInTheDocument();
    expect(screen.getByTestId('tracking-map-route')).toBeInTheDocument();
    expect(screen.getByTestId('tracking-map-hud')).toHaveTextContent('Ruta operativa');
    expect(screen.getByTestId('tracking-map-hud')).toHaveTextContent('En Proceso');
    expect(screen.getByTestId('tracking-map-hud')).toHaveTextContent('Movil en campo');
  });

  it('keeps a useful timeline fallback when MapLibre cannot initialize', async () => {
    maplibreState.shouldThrow = true;

    render(
      <TrackingMap
        customerLocation={{ lat: -33.079, lng: -68.47, name: 'Don Bosco 55' }}
        status="recibido"
      />,
    );

    expect(await screen.findByTestId('tracking-map-fallback')).toHaveTextContent('Seguimiento por timeline');
    expect(screen.getByText('Don Bosco 55')).toBeInTheDocument();
  });
});
