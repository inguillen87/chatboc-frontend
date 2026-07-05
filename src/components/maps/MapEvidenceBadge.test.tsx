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

    expect(screen.getByText("Demo sintetico")).toBeInTheDocument();
    expect(screen.getByText("4 puntos")).toBeInTheDocument();
    expect(screen.getByText("Cobertura 35%")).toBeInTheDocument();
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
});
