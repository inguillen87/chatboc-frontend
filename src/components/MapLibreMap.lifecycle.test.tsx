import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPropertyExpression, latest, validateStyleMin, type HeatmapLayerSpecification } from "@maplibre/maplibre-gl-style-spec";

import MapLibreMap from "@/components/MapLibreMap";
import MapProviderMap from "@/components/MapProviderMap";

const mapMocks = vi.hoisted(() => ({
  constructorCalls: [] as unknown[],
  instances: [] as Array<{
    remove: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    setStyle: ReturnType<typeof vi.fn>;
    setPaintProperty: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
    jumpTo: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    emit: (eventName: string, payload?: unknown) => void;
    emitLayer: (eventName: string, layerId: string, payload?: unknown) => void;
    setBounds: (bbox: [number, number, number, number]) => void;
  }>,
  heatSourceSetData: vi.fn(),
  pointSourceSetData: vi.fn(),
  polygonSourceSetData: vi.fn(),
  googleModuleLoads: 0,
  reducedMotion: false,
  rafCallbacks: [] as FrameRequestCallback[],
  addedLayers: [] as Array<Record<string, unknown>>,
  addedSources: [] as Array<{ id: string; options: Record<string, unknown> }>,
  layoutCalls: [] as Array<[string, string, unknown]>,
  popupAddCalls: 0,
  popupOptions: [] as unknown[],
  markerElements: [] as HTMLElement[],
}));

vi.mock("@/components/GoogleHeatmapMap", () => {
  mapMocks.googleModuleLoads += 1;
  return {
    GoogleHeatmapMap: ({
      onProviderUnavailable,
      evidence,
      heatmapData,
      disableClustering,
      showEvidenceBadge,
      showPoints,
      showPointLabels,
    }: {
      onProviderUnavailable?: (reason: "load-error", details?: unknown) => void;
      evidence?: { pointCount?: number; featureCount?: number };
      heatmapData?: Array<{ lat: number; lng: number }>;
      disableClustering?: boolean;
      showEvidenceBadge?: boolean;
      showPoints?: boolean;
      showPointLabels?: boolean;
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
        <output data-testid="google-visibility-contract">
          {String(showEvidenceBadge)}/{String(showPoints)}/{String(showPointLabels)}
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
    stop = vi.fn();
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

    addSource(id: string, options: Record<string, unknown>) {
      const setData = id === "chatboc-runtime-heatmap"
        ? mapMocks.heatSourceSetData
        : id === "chatboc-runtime-points"
          ? mapMocks.pointSourceSetData
          : mapMocks.polygonSourceSetData;
      this.sources.set(id, { setData });
      mapMocks.addedSources.push({ id, options });
    }

    getSource(id: string) {
      return this.sources.get(id);
    }

    addLayer(layer: { id: string } & Record<string, unknown>) {
      this.layers.add(layer.id);
      mapMocks.addedLayers.push(layer);
    }

    getLayer(id: string) {
      return this.layers.has(id) ? { id } : undefined;
    }

    setLayoutProperty(layerId: string, property: string, value: unknown) {
      mapMocks.layoutCalls.push([layerId, property, value]);
    }
    setStyle = vi.fn();
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
        const layerId = typeof args[0] === "string" && args.length > 1 ? args[0] : null;
        const handlerKey = layerId ? `${eventName}:${layerId}` : eventName;
        const eventHandlers = this.handlers.get(handlerKey) ?? new Set();
        eventHandlers.add(handler as (...handlerArgs: unknown[]) => void);
        this.handlers.set(handlerKey, eventHandlers);
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
        const layerId = typeof args[0] === "string" && args.length > 1 ? args[0] : null;
        const handlerKey = layerId ? `${eventName}:${layerId}` : eventName;
        this.handlers.get(handlerKey)?.delete(handler as (...handlerArgs: unknown[]) => void);
      }
      return this;
    }

    emit(eventName: string, payload?: unknown) {
      [...(this.handlers.get(eventName) ?? [])].forEach((handler) => handler(payload));
    }

    emitLayer(eventName: string, layerId: string, payload?: unknown) {
      [...(this.handlers.get(`${eventName}:${layerId}`) ?? [])].forEach((handler) => handler(payload));
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
    constructor(options?: { element?: HTMLElement }) {
      if (options?.element) {
        mapMocks.markerElements.push(options.element);
      }
    }
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
    constructor(options?: unknown) {
      mapMocks.popupOptions.push(options);
    }
    setLngLat() {
      return this;
    }
    setDOMContent() {
      return this;
    }
    addTo() {
      mapMocks.popupAddCalls += 1;
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
      type: "Feature" as const,
      properties: { id },
      geometry: { type: "Point" as const, coordinates: [lng, -34.58] },
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
    mapMocks.heatSourceSetData.mockReset();
    mapMocks.pointSourceSetData.mockReset();
    mapMocks.polygonSourceSetData.mockReset();
    mapMocks.googleModuleLoads = 0;
    mapMocks.reducedMotion = false;
    mapMocks.rafCallbacks.length = 0;
    mapMocks.addedLayers.length = 0;
    mapMocks.addedSources.length = 0;
    mapMocks.layoutCalls.length = 0;
    mapMocks.popupAddCalls = 0;
    mapMocks.popupOptions.length = 0;
    mapMocks.markerElements.length = 0;

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

  it("can keep the map canvas free of the evidence overlay", async () => {
    render(
      <MapLibreMap
        geoLayerConfig={configFor(sourceFor("unobstructed", -60.95))}
        showHeatmap
        showEvidenceBadge={false}
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    expect(screen.queryByTestId("map-evidence-badge")).not.toBeInTheDocument();
  });

  it("clusters overlapping audited cases even when each point includes ticket samples", async () => {
    const heatmapData = [
      { lat: -34.58, lng: -60.9, weight: 1, ticket: "M-1", sampleTickets: ["M-1"] },
      { lat: -34.58, lng: -60.9, weight: 1, ticket: "M-2", sampleTickets: ["M-2"] },
      { lat: -34.58, lng: -60.9, weight: 1, ticket: "M-3", sampleTickets: ["M-3"] },
    ];

    render(
      <MapLibreMap
        heatmapData={heatmapData}
        geoLayerConfig={configFor(sourceFor("server-contract", -60.95))}
        showHeatmap
        showPoints
        pointLabelMode="count"
      />,
    );

    await waitFor(() => {
      const latestSource = mapMocks.pointSourceSetData.mock.calls.at(-1)?.[0] as {
        features?: Array<{ properties?: { clusterSize?: number; sampleTickets?: string[] } }>;
      };
      expect(latestSource.features).toHaveLength(1);
      expect(latestSource.features?.[0]?.properties?.clusterSize).toBe(3);
      expect(latestSource.features?.[0]?.properties?.sampleTickets).toEqual(["M-1", "M-2", "M-3"]);
      expect(
        mapMocks.markerElements.some(
          (element) => element.getAttribute("aria-label") === "3 reclamos agrupados",
        ),
      ).toBe(true);
    });
  });

  it("constructs MapLibre once and updates both filtered datasets with setData", async () => {
    const initialSource = sourceFor("initial", -60.95);
    const nextSource = sourceFor("filtered", -60.91);
    const { rerender } = render(
      <MapLibreMap
        geoLayerConfig={configFor(initialSource)}
        heatmapRadiusScale={2.8}
        showHeatmap
        showPoints
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    await waitFor(() => expect(mapMocks.heatSourceSetData).toHaveBeenCalledWith(initialSource));
    await waitFor(() => expect(mapMocks.pointSourceSetData).toHaveBeenCalledWith(initialSource));
    const heatUpdatesBeforeFilter = mapMocks.heatSourceSetData.mock.calls.length;
    const updatesBeforeFilter = mapMocks.pointSourceSetData.mock.calls.length;

    rerender(
      <MapLibreMap
        geoLayerConfig={configFor(nextSource)}
        heatmapRadiusScale={2.35}
        showHeatmap
        showPoints
      />,
    );

    await waitFor(() =>
      expect(mapMocks.heatSourceSetData).toHaveBeenCalledWith(nextSource),
    );
    await waitFor(() =>
      expect(mapMocks.pointSourceSetData).toHaveBeenCalledWith(nextSource),
    );
    expect(mapMocks.heatSourceSetData.mock.calls.length).toBeGreaterThan(heatUpdatesBeforeFilter);
    expect(mapMocks.pointSourceSetData.mock.calls.length).toBeGreaterThan(updatesBeforeFilter);
    await waitFor(() =>
      expect(mapMocks.instances[0]?.setPaintProperty).toHaveBeenCalledWith(
        "territory-heat",
        "heatmap-radius",
        expect.arrayContaining(["interpolate", ["linear"], ["zoom"]]),
      ),
    );
    expect(mapMocks.constructorCalls).toHaveLength(1);
    expect(mapMocks.instances[0]?.remove).not.toHaveBeenCalled();
  });

  it.each(["default", "faro"] as const)("adds a valid %s density layer with visible zoom-scaled radii", async (heatmapPalette) => {
    const source = sourceFor("density", -68.48);
    const { rerender } = render(
      <MapLibreMap geoLayerConfig={configFor(source)} heatmapPalette={heatmapPalette} showHeatmap showPoints={false} />,
    );
    await waitFor(() => expect(mapMocks.addedLayers.some((layer) => layer.type === "heatmap")).toBe(true));
    const layer = mapMocks.addedLayers.find((candidate) => candidate.type === "heatmap") as HeatmapLayerSpecification;
    const errors = validateStyleMin({
      version: 8,
      sources: { "chatboc-runtime-heatmap": { type: "geojson", data: source } },
      layers: [layer],
    });
    expect(errors.map((error) => error.message)).toEqual([]);
    expect(layer.maxzoom).toBeGreaterThan(14);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-heat", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "none"]);

    const radius = createPropertyExpression(layer.paint?.["heatmap-radius"], latest.paint_heatmap["heatmap-radius"]);
    expect(radius.result).toBe("success");
    if (radius.result !== "success") throw new Error("MapLibre rejected the density radius.");
    for (const zoom of [0, 9, 11, 13, 14]) {
      const value = radius.value.evaluate({ zoom }, { type: "Point", properties: { clusterSize: 7 } });
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }

    rerender(
      <MapLibreMap geoLayerConfig={configFor(source)} heatmapPalette={heatmapPalette} heatmapRadiusScale={2.35} showHeatmap showPoints={false} />,
    );
    const update = mapMocks.instances[0]?.setPaintProperty.mock.calls
      .filter(([, property]) => property === "heatmap-radius").at(-1)?.[2];
    const scaledRadius = createPropertyExpression(update, latest.paint_heatmap["heatmap-radius"]);
    expect(scaledRadius.result).toBe("success");
    if (scaledRadius.result !== "success") throw new Error("MapLibre rejected the updated density radius.");
    for (const zoom of [0, 9, 11, 13, 14]) {
      const feature = { type: "Point" as const, properties: { clusterSize: 7 } };
      expect(scaledRadius.value.evaluate({ zoom }, feature)).toBeCloseTo(radius.value.evaluate({ zoom }, feature) * 2.35);
    }
    expect(mapMocks.constructorCalls).toHaveLength(1);
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

  it("renders an executive hybrid layer with density, points and aggregate labels", async () => {
    const { rerender } = render(
      <MapLibreMap
        geoLayerConfig={configFor(sourceFor("hybrid", -60.93))}
        showHeatmap
        showPoints
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    await waitFor(() =>
      expect(mapMocks.addedLayers.some((layer) => layer.id === "territory-points-labels")).toBe(true),
    );
    expect(mapMocks.layoutCalls).toContainEqual(["territory-heat", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points-labels", "visibility", "visible"]);
    expect(mapMocks.addedLayers.find((layer) => layer.id === "territory-points-labels")).toEqual(
      expect.objectContaining({
        type: "symbol",
        source: "chatboc-runtime-points",
        layout: expect.objectContaining({
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        }),
      }),
    );
    expect(mapMocks.constructorCalls[0]).toEqual(
      expect.objectContaining({ cooperativeGestures: true, maxPitch: 60 }),
    );

    mapMocks.layoutCalls.length = 0;
    rerender(
      <MapLibreMap
        geoLayerConfig={configFor(sourceFor("hybrid", -60.93))}
        showHeatmap
        showPoints={false}
      />,
    );
    await waitFor(() =>
      expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "none"]),
    );
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points-labels", "visibility", "none"]);
    expect(mapMocks.constructorCalls).toHaveLength(1);
  });

  it("keeps heat and point-label datasets independent across every visibility combination", async () => {
    const source = sourceFor("visibility-contract", -60.93);
    const emptySource = expect.objectContaining({
      type: "FeatureCollection",
      features: [],
    });
    const { rerender } = render(
      <MapLibreMap
        geoLayerConfig={configFor(source)}
        showHeatmap
        showPoints={false}
        showPointLabels={false}
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    await waitFor(() => expect(mapMocks.heatSourceSetData).toHaveBeenCalledWith(source));
    await waitFor(() => expect(mapMocks.pointSourceSetData).toHaveBeenCalledWith(emptySource));
    expect(
      mapMocks.addedSources.find((candidate) => candidate.id === "chatboc-runtime-heatmap")
        ?.options.data,
    ).toBe(source);
    expect(
      mapMocks.addedSources.find((candidate) => candidate.id === "chatboc-runtime-points")
        ?.options.data,
    ).toEqual(emptySource);
    expect(mapMocks.addedLayers.find((layer) => layer.id === "territory-heat")).toEqual(
      expect.objectContaining({ source: "chatboc-runtime-heatmap" }),
    );
    expect(mapMocks.addedLayers.find((layer) => layer.id === "territory-points")).toEqual(
      expect.objectContaining({ source: "chatboc-runtime-points" }),
    );
    expect(mapMocks.layoutCalls).toContainEqual(["territory-heat", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "none"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points-labels", "visibility", "none"]);

    mapMocks.heatSourceSetData.mockClear();
    mapMocks.pointSourceSetData.mockClear();
    mapMocks.layoutCalls.length = 0;
    rerender(
      <MapLibreMap
        geoLayerConfig={configFor(source)}
        showHeatmap={false}
        showPoints={false}
        showPointLabels={false}
      />,
    );

    await waitFor(() => expect(mapMocks.heatSourceSetData).toHaveBeenCalledWith(emptySource));
    await waitFor(() => expect(mapMocks.pointSourceSetData).toHaveBeenCalledWith(emptySource));
    expect(mapMocks.layoutCalls).toContainEqual(["territory-heat", "visibility", "none"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "none"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points-labels", "visibility", "none"]);
    expect(mapMocks.constructorCalls).toHaveLength(1);
    expect(mapMocks.instances[0]?.remove).not.toHaveBeenCalled();
  });

  it("supports the Faro territorial presentation without changing global map defaults", async () => {
    const source = sourceFor("faro-territory", -67.7);
    const onFeatureSelect = vi.fn();
    const { rerender } = render(
      <MapLibreMap
        geoLayerConfig={configFor(source)}
        showHeatmap
        showPoints
        showPointLabels
        pointMinZoom={4.5}
        pointLabelMinZoom={9}
        pointLabelMode="barrio"
        heatmapRadiusScale={2.8}
        heatmapPalette="faro"
        onFeatureSelect={onFeatureSelect}
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    const pointLayer = mapMocks.addedLayers.find((layer) => layer.id === "territory-points");
    const labelLayer = mapMocks.addedLayers.find((layer) => layer.id === "territory-points-labels");
    const heatLayer = mapMocks.addedLayers.find((layer) => layer.id === "territory-heat");
    const haloLayer = mapMocks.addedLayers.find((layer) => layer.id === "territory-points-halo");

    expect(pointLayer).toEqual(expect.objectContaining({
      minzoom: 4.5,
      paint: expect.objectContaining({
        "circle-stroke-color": "rgba(15, 23, 42, 0.90)",
        "circle-stroke-width": 2.25,
        "circle-stroke-opacity": 0.98,
        "circle-opacity": 0.98,
        "circle-blur": 0.02,
      }),
    }));
    expect(labelLayer).toEqual(expect.objectContaining({
      minzoom: 9,
      layout: expect.objectContaining({
        "text-field": ["coalesce", ["get", "barrio"], ["get", "distrito"], ""],
      }),
    }));
    expect(heatLayer).toEqual(expect.objectContaining({
      paint: expect.objectContaining({
        "heatmap-opacity": 0.76,
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "intensity"], ["get", "weight"], 1],
          0,
          0,
          1,
          0.42,
          4,
          0.58,
          16,
          0.78,
          64,
          1,
        ],
      }),
    }));
    expect(haloLayer).toEqual(expect.objectContaining({
      source: "chatboc-runtime-heatmap",
      minzoom: 4.5,
      paint: expect.objectContaining({
        "circle-color": ["case", ["has", "categoryColor"], ["get", "categoryColor"], "#2563eb"],
        "circle-opacity": 0.42,
        "circle-blur": 0.08,
        "circle-stroke-color": "rgba(255, 255, 255, 0.96)",
        "circle-stroke-width": 3,
      }),
    }));
    expect(mapMocks.addedLayers.indexOf(heatLayer!)).toBeLessThan(mapMocks.addedLayers.indexOf(haloLayer!));
    expect(mapMocks.layoutCalls).toContainEqual(["territory-heat", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points-labels", "visibility", "visible"]);

    rerender(
      <MapLibreMap
        geoLayerConfig={configFor(source)}
        showHeatmap
        showPoints
        showPointLabels
        pointMinZoom={4.5}
        pointLabelMinZoom={9}
        pointLabelMode="barrio"
        heatmapRadiusScale={2.8}
        heatmapPalette="faro"
        adaptiveZoomMode
        onFeatureSelect={onFeatureSelect}
      />,
    );
    await waitFor(() =>
      expect(mapMocks.instances[0]?.setPaintProperty).toHaveBeenCalledWith(
        "territory-heat",
        "heatmap-opacity",
        ["interpolate", ["linear"], ["zoom"], 4, 0.76, 9, 0.58, 12, 0.24, 14, 0],
      ),
    );
    expect(mapMocks.constructorCalls).toHaveLength(1);

    mapMocks.layoutCalls.length = 0;
    rerender(
      <MapLibreMap
        geoLayerConfig={configFor(source)}
        showHeatmap
        showPoints={false}
        showPointLabels={false}
        pointMinZoom={4.5}
        pointLabelMinZoom={9}
        pointLabelMode="barrio"
        heatmapRadiusScale={2.8}
        heatmapPalette="faro"
        onFeatureSelect={onFeatureSelect}
      />,
    );

    await waitFor(() =>
      expect(mapMocks.layoutCalls).toContainEqual(["territory-points-halo", "visibility", "visible"]),
    );
    expect(mapMocks.layoutCalls).toContainEqual(["territory-heat", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "none"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points-labels", "visibility", "none"]);

    mapMocks.instances[0]?.emitLayer("click", "territory-points-halo", {
      features: [
        {
          geometry: { coordinates: [-67.7, -34.58] },
          properties: { id: "faro-territory", categoria: "Luminarias" },
        },
      ],
      lngLat: { lng: -67.7 },
    });
    expect(mapMocks.popupAddCalls).toBe(1);
    expect(mapMocks.popupOptions).toContainEqual({
      offset: 16,
      closeButton: true,
      maxWidth: "320px",
    });
    expect(onFeatureSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: "faro-territory",
      ticketIdentityStatus: "missing",
    }));
  });

  it("keeps Faro point anchors visible in points-only mode on a light basemap", async () => {
    const source = sourceFor("municipio_ticket:419", -60.95);
    Object.assign(source.features[0].properties, {
      record_source: "municipio_ticket",
      categoria: "Luminarias",
      categoryColor: "#2563eb",
    });

    render(
      <MapLibreMap
        geoLayerConfig={configFor(source)}
        showHeatmap={false}
        showPoints
        showPointLabels
        pointMinZoom={7}
        pointLabelMode="categoria"
        heatmapPalette="faro"
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    await waitFor(() => {
      const latestHaloSource = mapMocks.heatSourceSetData.mock.calls.at(-1)?.[0] as {
        features?: unknown[];
      };
      expect(latestHaloSource.features).toHaveLength(1);
    });
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points-halo", "visibility", "visible"]);
    expect(mapMocks.layoutCalls).toContainEqual(["territory-points", "visibility", "visible"]);
  });

  it("selects a territorial point by source model and ticket id before a colliding scalar id", async () => {
    const onFeatureSelect = vi.fn();
    const source = sourceFor("419", -60.94);
    Object.assign(source.features[0].properties, {
      source_model: "TenantTicket",
      ticket_id: "419",
      tenantSlug: "junin",
      clusterSize: 1,
    });

    render(
      <MapLibreMap
        tenantSlug="junin"
        geoLayerConfig={configFor(source)}
        heatmapData={[
          {
            lat: -34.56,
            lng: -60.93,
            id: "419",
            ticketId: "419",
            sourceModel: "TenantTicket",
            tenantSlug: "otro-municipio",
          },
          {
            lat: -34.58,
            lng: -60.95,
            id: "419",
            ticketId: "419",
            sourceModel: "MunicipioTicket",
            tenantSlug: "junin",
          },
          {
            lat: -34.57,
            lng: -60.94,
            id: "419",
            ticketId: "419",
            sourceModel: "TenantTicket",
            tenantSlug: "junin",
          },
        ]}
        disableClientClustering
        showHeatmap
        showPoints
        heatmapPalette="faro"
        onFeatureSelect={onFeatureSelect}
      />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    mapMocks.instances[0]?.emitLayer("click", "territory-points", {
      features: [
        {
          geometry: { coordinates: [-60.94, -34.57] },
          properties: source.features[0].properties,
        },
      ],
      lngLat: { lng: -60.94 },
    });

    expect(onFeatureSelect).toHaveBeenCalledWith(expect.objectContaining({
      sourceModel: "TenantTicket",
      ticketId: "419",
      lat: -34.57,
      lng: -60.94,
      tenantSlug: "junin",
      ticketHref: "/perfil?tab=tickets&source_model=TenantTicket&ticket_id=419&tenant_slug=junin&tenant=junin",
    }));
  });

  it("keeps the basemap usable and explains a filtered view with no geolocated points", async () => {
    render(
      <MapLibreMap
        ariaLabel="Mapa territorial filtrado"
        heatmapPalette="faro"
        heatmapData={[]}
        showHeatmap
        showPoints={false}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sin puntos geolocalizados para esta vista",
    );
    expect(screen.getByRole("region", { name: "Mapa territorial filtrado" })).toBeInTheDocument();
    expect(mapMocks.constructorCalls).toHaveLength(1);
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
        heatmapData={[{ lat: -33.16, lng: -68.5, totalWeight: 1 }]}
        geoLayerConfig={configFor(sourceFor("junin", -68.48))}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Mapa de participación de Junin, Mendoza" }),
    ).toHaveAttribute("aria-describedby", "territory-map-description");
    await waitFor(() => expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(1));
    expect(mapMocks.instances[0]?.fitBounds).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ maxZoom: 14 }),
    );
    const mapOptions = mapMocks.constructorCalls[0] as { container: HTMLElement };
    expect(mapOptions.container).toHaveClass("h-full", "w-full");
    expect(mapOptions.container).not.toHaveClass("absolute", "inset-0");

    // A live vote changes weights and object identities, but not geography.
    rerender(
      <MapLibreMap
        ariaLabel="Mapa de participación de Junin, Mendoza"
        ariaDescribedBy="territory-map-description"
        fitToBounds={fitToBounds.map(([lng, lat]) => [lng, lat] as [number, number])}
        fitBoundsRequestKey={0}
        heatmapData={[{ lat: -33.16, lng: -68.5, totalWeight: 99 }]}
        geoLayerConfig={configFor(sourceFor("junin", -68.48))}
      />,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(1);

    const changedCoordinates: [number, number][] = [
      [-68.5, -33.16],
      [-68.44, -33.1],
    ];
    rerender(
      <MapLibreMap
        ariaLabel="Mapa de participación de Junin, Mendoza"
        ariaDescribedBy="territory-map-description"
        fitToBounds={changedCoordinates}
        fitBoundsRequestKey={0}
        heatmapData={[{ lat: -33.16, lng: -68.5, totalWeight: 99 }]}
        geoLayerConfig={configFor(sourceFor("junin", -68.48))}
      />,
    );
    await waitFor(() => expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(2));

    // API ranking changes may reorder the exact same geography after a vote.
    // Reordering must not move the camera while an operator is inspecting it.
    const reorderedCoordinates = [...changedCoordinates].reverse();
    rerender(
      <MapLibreMap
        ariaLabel="Mapa de participación de Junin, Mendoza"
        ariaDescribedBy="territory-map-description"
        fitToBounds={reorderedCoordinates}
        fitBoundsRequestKey={0}
        heatmapData={[{ lat: -33.16, lng: -68.5, totalWeight: 100 }]}
        geoLayerConfig={configFor(sourceFor("junin", -68.48))}
      />,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(2);

    rerender(
      <MapLibreMap
        ariaLabel="Mapa de participación de Junin, Mendoza"
        ariaDescribedBy="territory-map-description"
        fitToBounds={reorderedCoordinates}
        fitBoundsRequestKey={1}
        heatmapData={[{ lat: -33.16, lng: -68.5, totalWeight: 100 }]}
        geoLayerConfig={configFor(sourceFor("junin", -68.48))}
      />,
    );

    await waitFor(() => expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(3));
    expect(mapMocks.constructorCalls).toHaveLength(1);
    expect(mapMocks.instances[0]?.remove).not.toHaveBeenCalled();
  });

  it("reframes the same map for a new filtered category and caps coincident locations", async () => {
    const luminariasCoordinates: [number, number][] = [
      [-60.95, -34.61],
      [-60.93, -34.59],
      [-60.91, -34.57],
    ];
    const treeCoordinates: [number, number][] = [
      [-60.84, -34.64],
      [-60.83, -34.63],
      [-60.82, -34.62],
      [-60.81, -34.61],
      [-60.8, -34.6],
    ];
    const initialSource = sourceFor("luminarias", -60.93);
    const filteredSource = sourceFor("arbol-caido", -60.82);
    const { rerender } = render(
      <MapLibreMap
        fitToBounds={luminariasCoordinates}
        fitBoundsRequestKey="luminarias:all:all"
        geoLayerConfig={configFor(initialSource)}
        heatmapRadiusScale={2.8}
        showHeatmap
        showPoints
      />,
    );

    await waitFor(() => expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(1));

    rerender(
      <MapLibreMap
        fitToBounds={treeCoordinates}
        fitBoundsRequestKey="arbol-caido:all:all"
        geoLayerConfig={configFor(filteredSource)}
        heatmapRadiusScale={2.35}
        showHeatmap
        showPoints
      />,
    );

    await waitFor(() => expect(mapMocks.pointSourceSetData).toHaveBeenCalledWith(filteredSource));
    await waitFor(() => expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(2));
    expect(mapMocks.instances[0]?.stop).toHaveBeenCalled();
    expect(mapMocks.constructorCalls).toHaveLength(1);
    expect(mapMocks.instances[0]?.remove).not.toHaveBeenCalled();

    const coincidentTreeCoordinates = Array.from(
      { length: 5 },
      () => [-60.805, -34.605] as [number, number],
    );
    rerender(
      <MapLibreMap
        fitToBounds={coincidentTreeCoordinates}
        fitBoundsRequestKey="arbol-caido:centro:all"
        geoLayerConfig={configFor(filteredSource)}
        heatmapRadiusScale={2.35}
        showHeatmap
        showPoints
      />,
    );

    await waitFor(() =>
      expect(mapMocks.instances[0]?.flyTo).toHaveBeenLastCalledWith(
        expect.objectContaining({
          center: [-60.805, -34.605],
          zoom: 12,
        }),
      ),
    );
    expect(mapMocks.instances[0]?.fitBounds).toHaveBeenCalledTimes(2);
    expect(mapMocks.constructorCalls).toHaveLength(1);
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

  it("does not rotate styles when teardown aborts an in-flight map request", async () => {
    const { unmount } = render(
      <MapLibreMap geoLayerConfig={configFor(sourceFor("teardown", -60.93))} />,
    );

    await waitFor(() => expect(mapMocks.constructorCalls).toHaveLength(1));
    const map = mapMocks.instances[0];
    map.remove.mockImplementation(() => {
      map.emit("error", {
        resourceType: "style",
        error: {
          name: "AbortError",
          message: "signal is aborted without reason",
          status: 0,
        },
      });
    });

    unmount();

    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(map.setStyle).not.toHaveBeenCalled();
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

  it("forwards the unobstructed and point visibility contract to Google", async () => {
    render(
      <MapProviderMap
        provider="google"
        googleMapsKey="configured"
        heatmapData={[{ lat: -34.58, lng: -60.9, weight: 1 }]}
        showHeatmap
        showPoints
        showPointLabels={false}
        showEvidenceBadge={false}
      />,
    );

    await screen.findByTestId("google-map");
    expect(screen.getByTestId("google-visibility-contract")).toHaveTextContent(
      "false/true/false",
    );
  });
});
