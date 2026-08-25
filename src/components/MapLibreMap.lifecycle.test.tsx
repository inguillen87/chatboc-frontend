import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MapLibreMap from "@/components/MapLibreMap";
import MapProviderMap from "@/components/MapProviderMap";

const mapMocks = vi.hoisted(() => ({
  constructorCalls: [] as unknown[],
  instances: [] as Array<{
    remove: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    setPaintProperty: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
    jumpTo: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    emit: (eventName: string, payload?: unknown) => void;
    setBounds: (bbox: [number, number, number, number]) => void;
  }>,
  pointSourceSetData: vi.fn(),
  polygonSourceSetData: vi.fn(),
  googleModuleLoads: 0,
  reducedMotion: false,
  rafCallbacks: [] as FrameRequestCallback[],
}));

vi.mock("@/components/GoogleHeatmapMap", () => {
  mapMocks.googleModuleLoads += 1;
  return {
    GoogleHeatmapMap: ({
      onProviderUnavailable,
      evidence,
      heatmapData,
      disableClustering,
    }: {
      onProviderUnavailable?: (reason: "load-error", details?: unknown) => void;
      evidence?: { pointCount?: number; featureCount?: number };
      heatmapData?: Array<{ lat: number; lng: number }>;
      disableClustering?: boolean;
    }) => (
      <>
        <button
          type="button"
          data-testid="google-map"
          onClick={() => onProviderUnavailable?.("load-error", new Error("runtime failure"))}
        >
          Google map
        </button>
        <output data-testid="google-evidence">
          {evidence?.pointCount ?? -1}/{evidence?.featureCount ?? -1}
        </output>
        <output data-testid="google-render-contract">
          {heatmapData?.length ?? -1}/{String(disableClustering)}
        </output>
      </>
    ),
  };
});

vi.mock("maplibre-gl", () => {
  class FakeMap {
    private readonly sources = new globalThis.Map<string, { setData: ReturnType<typeof vi.fn> }>();
    private readonly layers = new Set<string>();
    private readonly handlers = new globalThis.Map<string, Set<(...args: unknown[]) => void>>();
    private bounds: [number, number, number, number] = [-61, -35, -60, -34];
    remove = vi.fn();
    resize = vi.fn();
    setPaintProperty = vi.fn();
    flyTo = vi.fn();
    jumpTo = vi.fn();
    fitBounds = vi.fn();

    constructor(options: unknown) {
      mapMocks.constructorCalls.push(options);
      mapMocks.instances.push(this);
    }

    addControl() {
      return this;
    }

    addSource(id: string) {
      const setData = id === "points" ? mapMocks.pointSourceSetData : mapMocks.polygonSourceSetData;
      this.sources.set(id, { setData });
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    addLayer(layer: { id: string }) {
      this.layers.add(layer.id);
    }

    getLayer(id: string) {
      return this.layers.has(id) ? { id } : undefined;
    }

    setLayoutProperty() {}
    setStyle() {}
    addImage() {}
    hasImage() {
      return false;
    }

    isStyleLoaded() {
      return true;
    }

    on(eventName: string, ...args: unknown[]) {
      const handler = args.at(-1);
      if (typeof handler === "function") {
        const eventHandlers = this.handlers.get(eventName) ?? new Set();
        eventHandlers.add(handler as (...handlerArgs: unknown[]) => void);
        this.handlers.set(eventName, eventHandlers);
      }
      return this;
    }

    once(eventName: string, ...args: unknown[]) {
      const handler = args.at(-1);
      if (typeof handler !== "function") return this;
      const onceHandler = (...handlerArgs: unknown[]) => {
        this.off(eventName, onceHandler);
        (handler as (...eventArgs: unknown[]) => void)(...handlerArgs);
      };
      this.on(eventName, onceHandler);
      return this;
    }

    off(eventName: string, ...args: unknown[]) {
      const handler = args.at(-1);
      if (typeof handler === "function") {
        this.handlers.get(eventName)?.delete(handler as (...handlerArgs: unknown[]) => void);
      }
      return this;
    }

    emit(eventName: string, payload?: unknown) {
      [...(this.handlers.get(eventName) ?? [])].forEach((handler) => handler(payload));
    }

    setBounds(bbox: [number, number, number, number]) {
      this.bounds = bbox;
    }

    getBounds() {
      const [west, south, east, north] = this.bounds;
      return {
        getWest: () => west,
        getSouth: () => south,
        getEast: () => east,
        getNorth: () => north,
      };
    }
  }

  class FakeMarker {
    setLngLat() {
      return this;
    }
    setPopup() {
      return this;
    }
    addTo() {
      return this;
    }
    getElement() {
      return document.createElement("div");
    }
    remove() {}
  }

  class FakePopup {
    setLngLat() {
      return this;
    }
    setDOMContent() {
      return this;
    }
    addTo() {
      return this;
    }
  }

  class FakeLngLatBounds {
    extend() {
      return this;
    }
  }

  const module = {
    Map: FakeMap,
    Marker: FakeMarker,
    Popup: FakePopup,
    NavigationControl: class {},
    LngLatBounds: FakeLngLatBounds,
  };
  return { ...module, default: module };
});

const sourceFor = (id: string, lng: number) => ({
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature",
      properties: { id },
      geometry: { type: "Point", coordinates: [lng, -34.58] },
    },
  ],
});

const configFor = (source: ReturnType<typeof sourceFor>) => ({
  contract_version: "operations.map.v1",
  source,
  source_options: { cluster: false, clusterRadius: 48 },
  interactions: { hover: true, time_slider: { enabled: false, field: "created_at" } },
  layers: {
    heatmap: { id: "territory-heat" },
    points: { id: "territory-points" },
  },
});

describe("MapLibreMap lifecycle", () => {
  beforeEach(() => {
    mapMocks.constructorCalls.length = 0;
    mapMocks.instances.length = 0;
    mapMocks.pointSourceSetData.mockReset();
    mapMocks.polygonSourceSetData.mockReset();
    mapMocks.googleModuleLoads = 0;
    mapMocks.reducedMotion = false;
    mapMocks.rafCallbacks.length = 0;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion") ? mapMocks.reducedMotion : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        mapMocks.rafCallbacks.push(callback);
        return mapMocks.rafCallbacks.length;
      }),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("constructs MapLibre once and updates a new GeoJSON filter with setData", async () => {
    const initialSource = sourceFor("initial", -60.95);
    const nextSource = sourceFor("filtered", -60.91);
    const { rerender } = render(
      <MapLibreMap geoLayerConfig={configFor(initialSource)} showHeatmap />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    await waitFor(() => expect(mapMocks.pointSourceSetData).toHaveBeenCalled());
    const updatesBeforeFilter = mapMocks.pointSourceSetData.mock.calls.length;

    rerender(<MapLibreMap geoLayerConfig={configFor(nextSource)} showHeatmap />);

    await waitFor(() =>
      expect(mapMocks.pointSourceSetData).toHaveBeenCalledWith(nextSource),
    );
    expect(mapMocks.pointSourceSetData.mock.calls.length).toBeGreaterThan(updatesBeforeFilter);
    expect(mapMocks.constructorCalls).toHaveLength(1);
    expect(mapMocks.instances[0]?.remove).not.toHaveBeenCalled();
  });

  it("uses instant camera transitions and skips the heat pulse for reduced motion", async () => {
    mapMocks.reducedMotion = true;
    render(
      <MapLibreMap
        center={[-60.93, -34.58]}
        fitToBounds={[
          [-60.95, -34.6],
          [-60.9, -34.55],
        ]}
        geoLayerConfig={configFor(sourceFor("reduced", -60.93))}
        showHeatmap
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    await waitFor(() => expect(mapMocks.instances[0]?.jumpTo).toHaveBeenCalled());
    await waitFor(() =>
      expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ duration: 0 }),
      ),
    );
    expect(mapMocks.instances[0]?.flyTo).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mapMocks.instances[0]?.setPaintProperty).toHaveBeenCalledWith(
        "territory-heat",
        "heatmap-intensity",
        1,
      ),
    );

    const scheduledWork = mapMocks.rafCallbacks.splice(0);
    scheduledWork.forEach((callback) => callback(0));
    expect(mapMocks.rafCallbacks).toHaveLength(0);
  });

  it("exposes an accessible map region and refits on an explicit request without recreating it", async () => {
    const fitToBounds: [number, number][] = [
      [-68.5, -33.16],
      [-68.46, -33.12],
    ];
    const { rerender } = render(
      <MapLibreMap
        ariaLabel="Mapa de participación de Junin, Mendoza"
        ariaDescribedBy="territory-map-description"
        fitToBounds={fitToBounds}
        fitBoundsRequestKey={0}
        geoLayerConfig={configFor(sourceFor("junin", -68.48))}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Mapa de participación de Junin, Mendoza" }),
    ).toHaveAttribute("aria-describedby", "territory-map-description");
    await waitFor(() => expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(1));

    rerender(
      <MapLibreMap
        ariaLabel="Mapa de participación de Junin, Mendoza"
        ariaDescribedBy="territory-map-description"
        fitToBounds={fitToBounds}
        fitBoundsRequestKey={1}
        geoLayerConfig={configFor(sourceFor("junin", -68.48))}
      />,
    );

    await waitFor(() => expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(2));
    expect(mapMocks.constructorCalls).toHaveLength(1);
    expect(mapMocks.instances[0]?.remove).not.toHaveBeenCalled();
  });

  it("debounces bounding-box events, toggles callbacks without recreating the map, and cleans up", async () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const { rerender, unmount } = render(
      <MapLibreMap
        onBoundingBoxChange={firstCallback}
        geoLayerConfig={configFor(sourceFor("bbox", -60.93))}
      />,
    );

    await waitFor(() => expect(firstCallback).toHaveBeenCalledWith([-61, -35, -60, -34]));
    firstCallback.mockClear();
    const map = mapMocks.instances[0];
    map.setBounds([-60.9, -34.8, -60.7, -34.6]);
    map.emit("moveend");
    map.emit("zoomend");
    map.emit("dragend");

    await waitFor(() =>
      expect(firstCallback).toHaveBeenCalledWith([-60.9, -34.8, -60.7, -34.6]),
    );
    expect(firstCallback).toHaveBeenCalledTimes(1);

    rerender(
      <MapLibreMap
        onBoundingBoxChange={secondCallback}
        geoLayerConfig={configFor(sourceFor("bbox", -60.93))}
      />,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(secondCallback).not.toHaveBeenCalled();
    expect(mapMocks.constructorCalls).toHaveLength(1);

    rerender(
      <MapLibreMap
        geoLayerConfig={configFor(sourceFor("bbox", -60.93))}
      />,
    );
    map.emit("moveend");
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(firstCallback).toHaveBeenCalledTimes(1);

    rerender(
      <MapLibreMap
        onBoundingBoxChange={secondCallback}
        geoLayerConfig={configFor(sourceFor("bbox", -60.93))}
      />,
    );
    await waitFor(() =>
      expect(secondCallback).toHaveBeenCalledWith([-60.9, -34.8, -60.7, -34.6]),
    );

    secondCallback.mockClear();
    unmount();
    map.setBounds([-60.7, -34.7, -60.5, -34.5]);
    map.emit("moveend");
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    expect(secondCallback).not.toHaveBeenCalled();
  });

  it("keeps Google unloaded on the MapLibre route", async () => {
    render(
      <MapProviderMap
        provider="maplibre"
        googleMapsKey="configured-but-unused"
        geoLayerConfig={configFor(sourceFor("maplibre", -60.92))}
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    expect(mapMocks.googleModuleLoads).toBe(0);
    expect(screen.queryByTestId("google-map")).not.toBeInTheDocument();
  });

  it("fails closed to MapLibre when Google is selected without a key", async () => {
    const onProviderUnavailable = vi.fn();
    const { rerender } = render(
      <MapProviderMap
        provider="google"
        googleMapsKey=""
        onProviderUnavailable={onProviderUnavailable}
        geoLayerConfig={configFor(sourceFor("fallback", -60.9))}
      />,
    );

    await waitFor(() =>
      expect(onProviderUnavailable).toHaveBeenCalledWith(
        "google",
        "missing-api-key",
        undefined,
      ),
    );
    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    expect(mapMocks.googleModuleLoads).toBe(0);
    expect(
      screen.getByText("Mostramos la vista de mapa disponible para esta cuenta."),
    ).toBeInTheDocument();

    rerender(
      <MapProviderMap
        provider="google"
        googleMapsKey="configured-after-readiness"
        onProviderUnavailable={onProviderUnavailable}
        geoLayerConfig={configFor(sourceFor("fallback", -60.9))}
      />,
    );

    expect(await screen.findByTestId("google-map")).toBeInTheDocument();
    await waitFor(() => expect(mapMocks.instances[0]?.remove).toHaveBeenCalled());
  });

  it("falls back on Google failure and blocks unsafe live key rotation", async () => {
    const onProviderUnavailable = vi.fn();
    const { rerender } = render(
      <MapProviderMap
        provider="google"
        googleMapsKey="configured"
        onProviderUnavailable={onProviderUnavailable}
        geoLayerConfig={configFor(sourceFor("google", -60.89))}
      />,
    );

    const googleMap = await screen.findByTestId("google-map");
    expect(mapMocks.constructorCalls).toHaveLength(0);

    fireEvent.click(googleMap);

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    expect(onProviderUnavailable).toHaveBeenCalledWith(
      "google",
      "load-error",
      expect.any(Error),
    );
    expect(
      screen.getByText("Mostramos la vista de mapa disponible para esta cuenta."),
    ).toBeInTheDocument();

    rerender(
      <MapProviderMap
        provider="google"
        googleMapsKey="configured-v2"
        onProviderUnavailable={onProviderUnavailable}
        geoLayerConfig={configFor(sourceFor("google", -60.89))}
      />,
    );
    await waitFor(() =>
      expect(onProviderUnavailable).toHaveBeenLastCalledWith(
        "google",
        "load-error",
        expect.objectContaining({
          message: expect.stringContaining("actualizar la página"),
        }),
      ),
    );
    expect(screen.queryByTestId("google-map")).not.toBeInTheDocument();
    expect(mapMocks.constructorCalls).toHaveLength(1);

    rerender(
      <MapProviderMap
        provider="google"
        googleMapsKey="configured"
        onProviderUnavailable={onProviderUnavailable}
        geoLayerConfig={configFor(sourceFor("google", -60.89))}
      />,
    );
    expect(await screen.findByTestId("google-map")).toBeInTheDocument();
  });

  it("reports the Google evidence count from points actually rendered", async () => {
    const heatmapData = [
      { lat: -34.58, lng: -60.9, weight: 1 },
      { lat: -34.58, lng: -60.9, weight: 2 },
      { lat: Number.NaN, lng: -60.87, weight: 3 },
    ];
    const geoLayerConfig = configFor(sourceFor("not-rendered-by-google", -60.89));
    const { rerender } = render(
      <MapProviderMap
        provider="google"
        googleMapsKey="configured"
        heatmapData={heatmapData}
        evidence={{ pointCount: 99, featureCount: 99 }}
        geoLayerConfig={geoLayerConfig}
      />,
    );

    await screen.findByTestId("google-map");
    expect(screen.getByTestId("google-evidence")).toHaveTextContent("1/0");
    expect(screen.getByTestId("google-render-contract")).toHaveTextContent("1/true");

    rerender(
      <MapProviderMap
        provider="google"
        googleMapsKey="configured"
        heatmapData={heatmapData}
        disableClientClustering
        evidence={{ pointCount: 99, featureCount: 99 }}
        geoLayerConfig={geoLayerConfig}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("google-render-contract")).toHaveTextContent("2/true"),
    );
    expect(screen.getByTestId("google-evidence")).toHaveTextContent("2/0");
  });
});
