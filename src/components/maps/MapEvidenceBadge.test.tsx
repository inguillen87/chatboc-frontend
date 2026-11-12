import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapEvidenceBadge, buildMapEvidence } from "./MapEvidenceBadge";

describe("MapEvidenceBadge", () => {
  it("marks synthetic fallback data clearly", () => {
    render(
      <MapEvidenceBadge
        evidence={{
          usingSyntheticPoints: true,
          source: "survey_heatmap",
          pointCount: 4,
          coveragePct: 35,
        }}
      />,
    );

    expect(screen.getByText("Escenario demostrativo")).toBeInTheDocument();
    expect(screen.getByText("4 ubicaciones simuladas")).toBeInTheDocument();
    expect(screen.getByText("Cobertura 35%")).toBeInTheDocument();
    expect(screen.getByText("Simulación controlada")).toBeInTheDocument();
    expect(screen.getByText("No representa datos municipales reales.")).toBeInTheDocument();
    expect(screen.queryByText(/survey_heatmap/i)).not.toBeInTheDocument();
  });

  it("normalizes backend metadata without treating provider metadata as provenance", () => {
    const evidence = buildMapEvidence({
      metadata: {
        request_id: "req_123456789",
        provider: "maplibre",
        generated_at: "2026-07-04T20:15:00.000Z",
      },
      locationQuality: {
        coverage_pct: 91,
      },
      points: [{ id: 1 }, { id: 2 }],
    });

    expect(evidence.empty).toBe(false);
    expect(evidence.provider).toBe("maplibre");
    expect(evidence.requestId).toBe("req_123456789");
    expect(evidence.coveragePct).toBe(91);
    expect(evidence.pointCount).toBe(2);
  });

  it("supports a provincial synthetic disclaimer without changing the municipal default", () => {
    render(
      <MapEvidenceBadge
        evidence={{
          usingSyntheticPoints: true,
          pointCount: 6,
          syntheticDisclaimer: "No representa datos provinciales ni casos reales.",
        }}
      />,
    );

    expect(screen.getByText("No representa datos provinciales ni casos reales.")).toBeInTheDocument();
    expect(screen.queryByText("No representa datos municipales reales.")).not.toBeInTheDocument();
  });

  it("surfaces aggregated cells when raw points are not shown", () => {
    render(
      <MapEvidenceBadge
        evidence={{
          source: "operations.heatmap.v1",
          pointCount: 0,
          cellCount: 3,
          coveragePct: 82,
        }}
      />,
    );

    expect(screen.getByText("Datos disponibles")).toBeInTheDocument();
    expect(screen.queryByText("Datos reales")).not.toBeInTheDocument();
    expect(screen.getByText("3 celdas")).toBeInTheDocument();
    expect(screen.getByText("Cobertura 82%")).toBeInTheDocument();
    expect(screen.getByTestId("map-evidence-badge")).toHaveAttribute("data-evidence-variant", "available");
    expect(screen.queryByTestId("map-evidence-icon-verified")).not.toBeInTheDocument();
  });

  it("does not show verified evidence styling for partial or unvalidated provenance", () => {
    render(
      <MapEvidenceBadge
        evidence={{
          source: "procedencia no validada",
          provider: "maplibre",
          label: "Procedencia parcial",
          pointCount: 4,
        }}
      />,
    );

    expect(screen.getByText("Procedencia parcial")).toBeInTheDocument();
    expect(screen.getByTestId("map-evidence-badge")).toHaveAttribute("data-evidence-variant", "unvalidated");
    expect(screen.getByTestId("map-evidence-icon-unvalidated")).toBeInTheDocument();
    expect(screen.queryByTestId("map-evidence-icon-verified")).not.toBeInTheDocument();
  });

  it("reserves verified evidence styling for explicit validated provenance", () => {
    render(
      <MapEvidenceBadge
        evidence={{
          source: "procedencia validada",
          provenanceState: "real",
          pointCount: 2,
        }}
      />,
    );

    expect(screen.getByTestId("map-evidence-badge")).toHaveAttribute("data-evidence-variant", "verified");
    expect(screen.getByTestId("map-evidence-icon-verified")).toBeInTheDocument();
  });
});
