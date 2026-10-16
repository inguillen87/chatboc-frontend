import { afterEach, describe, expect, it, vi } from "vitest";
import { preferredScrollBehavior } from "./scrollPreference";

describe("navigation motion preference", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses instant scrolling when reduced motion is enabled", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    expect(preferredScrollBehavior()).toBe("auto");
  });
  it("reads a changed system preference at the time of navigation", () => {
    let reduced = false;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reduced })));
    expect(preferredScrollBehavior()).toBe("smooth");
    reduced = true;
    expect(preferredScrollBehavior()).toBe("auto");
  });
  it("falls back to instant scrolling when media queries are unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(preferredScrollBehavior()).toBe("auto");
  });
});
