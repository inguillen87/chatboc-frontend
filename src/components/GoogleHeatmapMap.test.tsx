import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleHeatmapMap } from "@/components/GoogleHeatmapMap";

const googleApiMocks = vi.hoisted(() => ({
  isLoaded: true,
  loadError: undefined as Error | undefined,
}));

vi.mock("@react-google-maps/api", () => ({
  useJsApiLoader: () => ({
    isLoaded: googleApiMocks.isLoaded,
    loadError: googleApiMocks.loadError,
  }),
  GoogleMap: ({ children }: { children?: ReactNode }) => <div data-testid="google-map-canvas">{children}</div>,
  HeatmapLayerF: () => <div data-testid="google-heat-layer" />,
  MarkerF: ({ label, title }: { label?: string | { text?: string }; title?: string }) => (
    <div
      data-testid="google-point-marker"
      data-label={typeof label === "string" ? label : (label?.text ?? "")}
      data-title={title ?? ""}
    />
  ),
}));

const originalGoogle = window.google;

const installGoogleRuntime = () => {
  class LatLng {
    constructor(
      readonly lat: number,
      readonly lng: number,
    ) {}
  }

  class MVCArray<T> {
    constructor(readonly values: T[]) {}
  }

  class LatLngBounds {
    extend() {
      return this;
    }
  }

  Object.defineProperty(window, "google", {
    configurable: true,
    writable: true,
    value: {
      maps: {
        version: "3.64.0",
        Map: class {},
        LatLng,
        LatLngBounds,
        MVCArray,
        SymbolPath: { CIRCLE: 0 },
        visualization: { HeatmapLayer: class {} },
      },
    },
  });
};

const heatmapData = [
  {
    id: "centro",
    lat: -34.58,
    lng: -60.9,
    weight: 3,
    totalWeight: 3,
    clusterId: "centro",
    clusterSize: 3,
  },
];

describe("GoogleHeatmapMap visibility contract", () => {
  beforeEach(() => {
    googleApiMocks.isLoaded = true;
    googleApiMocks.loadError = undefined;
    installGoogleRuntime();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.defineProperty(window, "google", {
      configurable: true,
      writable: true,
      value: originalGoogle,
    });
  });

  it("supports a hybrid heatmap while independently hiding points, labels and evidence", async () => {
    const { rerender } = render(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        showPoints
        showPointLabels
        showEvidenceBadge={false}
        disableClustering
        googleMapsKey="configured"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("google-heat-layer")).toBeInTheDocument());
    expect(screen.getByTestId("google-point-marker")).toHaveAttribute("data-label", "3");
    expect(screen.queryByTestId("map-evidence-badge")).not.toBeInTheDocument();

    rerender(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        showPoints
        showPointLabels={false}
        showEvidenceBadge={false}
        disableClustering
        googleMapsKey="configured"
      />,
    );
    expect(screen.getByTestId("google-point-marker")).toHaveAttribute("data-label", "");

    rerender(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        showPoints={false}
        showPointLabels
        showEvidenceBadge={false}
        disableClustering
        googleMapsKey="configured"
      />,
    );
    expect(screen.getByTestId("google-heat-layer")).toBeInTheDocument();
    expect(screen.queryByTestId("google-point-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("map-evidence-badge")).not.toBeInTheDocument();
  });

  it("preserves existing defaults for evidence and marker fallback", async () => {
    const { rerender } = render(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        disableClustering
        googleMapsKey="configured"
      />,
    );

    await waitFor(() => expect(screen.getByTestId("google-heat-layer")).toBeInTheDocument());
    expect(screen.queryByTestId("google-point-marker")).not.toBeInTheDocument();
    expect(screen.getByTestId("map-evidence-badge")).toBeInTheDocument();

    rerender(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap={false}
        disableClustering
        googleMapsKey="configured"
      />,
    );
    expect(screen.queryByTestId("google-heat-layer")).not.toBeInTheDocument();
    expect(screen.getByTestId("google-point-marker")).toHaveAttribute("data-label", "3");
  });

  it("fails closed for explicit point privacy when the Google heat layer is unavailable", () => {
    Object.defineProperty(window.google.maps, "visualization", {
      configurable: true,
      value: {},
    });
    const { rerender } = render(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        showPoints={false}
        showPointLabels={false}
        disableClustering
        googleMapsKey="configured"
      />,
    );

    expect(screen.queryByTestId("google-heat-layer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("google-point-marker")).not.toBeInTheDocument();

    rerender(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        disableClustering
        googleMapsKey="configured"
      />,
    );
    expect(screen.getByTestId("google-point-marker")).toBeInTheDocument();
  });

  it("reports the removed Google heat layer before React can instantiate it", async () => {
    Object.defineProperty(window.google.maps, "version", {
      configurable: true,
      value: "3.66.2d",
    });
    const onProviderUnavailable = vi.fn();

    render(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        disableClustering
        googleMapsKey="configured"
        onProviderUnavailable={onProviderUnavailable}
      />,
    );

    await waitFor(() =>
      expect(onProviderUnavailable).toHaveBeenCalledWith("heatmap-unavailable", undefined),
    );
    expect(screen.queryByTestId("google-heat-layer")).not.toBeInTheDocument();
    expect(screen.getByTestId("google-point-marker")).toBeInTheDocument();
  });

  it("honors the evidence flag while Google is loading or reports an error", () => {
    googleApiMocks.isLoaded = false;
    const { rerender } = render(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        showEvidenceBadge={false}
        googleMapsKey="configured"
      />,
    );

    expect(screen.getByText("Cargando mapa de Google Maps...")).toBeInTheDocument();
    expect(screen.queryByTestId("map-evidence-badge")).not.toBeInTheDocument();

    googleApiMocks.loadError = new Error("loader failed");
    rerender(
      <GoogleHeatmapMap
        initialZoom={12}
        heatmapData={heatmapData}
        showHeatmap
        showEvidenceBadge={false}
        googleMapsKey="configured"
      />,
    );
    expect(screen.getByText(/No se pudo cargar Google Maps/)).toBeInTheDocument();
    expect(screen.queryByTestId("map-evidence-badge")).not.toBeInTheDocument();
  });
});
