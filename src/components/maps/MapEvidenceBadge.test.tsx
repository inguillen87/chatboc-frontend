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

  it("normalizes backend metadata into verified evidence", () => {
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

    expect(screen.getByText("Datos reales")).toBeInTheDocument();
    expect(screen.getByText("3 celdas")).toBeInTheDocument();
    expect(screen.getByText("Cobertura 82%")).toBeInTheDocument();
  });
});
