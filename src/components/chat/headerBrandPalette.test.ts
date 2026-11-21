import { describe, expect, it } from "vitest";

import {
  DEFAULT_HEADER_BACKGROUND,
  contrastWithWhite,
  headerBackground,
  parseCssColor,
  readableHeaderColor,
} from "./headerBrandPalette";

const rgbOf = (css: string | null) => {
  const match = css?.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
  if (!match) throw new Error(`not rgb: ${css}`);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
};

describe("headerBrandPalette", () => {
  it("reads hex and rgb colors and ignores anything else", () => {
    expect(parseCssColor("#0af")).toEqual({ r: 0, g: 170, b: 255 });
    expect(parseCssColor("#14532D")).toEqual({ r: 20, g: 83, b: 45 });
    expect(parseCssColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseCssColor("rgba(10,20,30,0.5)")).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseCssColor("hsl(var(--primary))")).toBeNull();
    expect(parseCssColor("rgb(300, 0, 0)")).toBeNull();
    expect(parseCssColor(undefined)).toBeNull();
  });

  it.each(["#facc15", "#ffffff", "#22d3ee", "#f472b6", "#007aff", "#0f172a", "#14532d"])(
    "keeps white text readable (AA) over %s",
    (brand) => {
      expect(contrastWithWhite(rgbOf(readableHeaderColor(brand)))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("leaves brand colors that already pass untouched", () => {
    expect(readableHeaderColor("#14532d")).toBe("rgb(20, 83, 45)");
  });

  it("falls back to a CSS mix for values it cannot read", () => {
    expect(readableHeaderColor("hsl(var(--primary))")).toBe("color-mix(in srgb, hsl(var(--primary)) 72%, #020617)");
    expect(readableHeaderColor("  ")).toBeNull();
  });

  it("builds the tenant gradient and keeps the platform one without brand", () => {
    expect(headerBackground(null, undefined)).toBe(DEFAULT_HEADER_BACKGROUND);
    expect(headerBackground("#14532d", null)).toBe("linear-gradient(115deg, rgb(20, 83, 45) 0%, rgb(20, 83, 45) 100%)");
    expect(headerBackground("#0f172a", "#14532d")).toBe("linear-gradient(115deg, rgb(15, 23, 42) 0%, rgb(20, 83, 45) 100%)");
  });
});
