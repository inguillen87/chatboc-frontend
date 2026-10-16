import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({ useReducedMotion: () => true }));
vi.mock("lenis/react", () => ({ ReactLenis: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/hooks/useLandingExperience", () => ({ useLandingExperience: () => ({ experience: null }) }));
vi.mock("@/components/sections/HeroSection", () => ({ default: () => <section id="inicio" /> }));
vi.mock("@/components/sections/SaaSOperatingSystemSection", () => ({ default: () => <section id="sistema-operativo" /> }));
vi.mock("@/components/sections/SolutionSection", () => ({ default: () => null }));
vi.mock("@/components/sections/PricingSection", () => ({ default: () => null }));
vi.mock("@/components/sections/DemoShowcaseSection", () => ({ default: () => null }));
vi.mock("@/components/sections/CtaSection", () => ({ default: () => null }));
import Index from "./Index";

describe("pending landing navigation", () => {
  const scroll = vi.fn();
  const nativeScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  beforeEach(() => {
    vi.useFakeTimers(); scroll.mockReset(); sessionStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    sessionStorage.setItem("pendingScrollSection", "inicio");
  });
  afterEach(() => {
    vi.useRealTimers(); vi.unstubAllGlobals(); sessionStorage.clear();
    if (nativeScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", nativeScroll);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it("respects reduced motion when returning from another route", () => {
    render(<Index />);
    act(() => vi.advanceTimersByTime(200));
    expect(scroll).toHaveBeenCalledWith({ behavior: "auto" });
    expect(sessionStorage.getItem("pendingScrollSection")).toBeNull();
  });
  it("does not scroll the next page after unmount", () => {
    const { unmount } = render(<Index />); unmount();
    act(() => vi.advanceTimersByTime(200));
    expect(scroll).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("pendingScrollSection")).toBe("inicio");
  });
  it("does not consume or override a newer navigation intent", () => {
    render(<Index />); sessionStorage.setItem("pendingScrollSection", "sistema-operativo");
    act(() => vi.advanceTimersByTime(200));
    expect(scroll).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("pendingScrollSection")).toBe("sistema-operativo");
  });
});
