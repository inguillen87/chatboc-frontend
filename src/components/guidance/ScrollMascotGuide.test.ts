import { describe, expect, it } from "vitest";

import { shouldShowGuideForPath } from "./ScrollMascotGuide";

describe("ScrollMascotGuide route policy", () => {
  it("stays out of executive demo presentations", () => {
    expect(shouldShowGuideForPath("/demo")).toBe(false);
    expect(shouldShowGuideForPath("/demo/gobierno")).toBe(false);
  });

  it("remains available on guided public content", () => {
    expect(shouldShowGuideForPath("/")).toBe(true);
    expect(shouldShowGuideForPath("/encuestas/consulta-ciudadana")).toBe(true);
  });
});
