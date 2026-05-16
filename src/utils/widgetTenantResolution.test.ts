import { describe, expect, it } from "vitest";

import { isPublicPlatformSurfacePath } from "./widgetTenantResolution";

describe("isPublicPlatformSurfacePath", () => {
  it("detects platform marketing surfaces", () => {
    expect(isPublicPlatformSurfacePath("/")).toBe(true);
    expect(isPublicPlatformSurfacePath("/demo")).toBe(true);
    expect(isPublicPlatformSurfacePath("/colegios")).toBe(true);
    expect(isPublicPlatformSurfacePath("/empresas")).toBe(true);
    expect(isPublicPlatformSurfacePath("/municipios")).toBe(true);
    expect(isPublicPlatformSurfacePath("/precios")).toBe(true);
  });

  it("keeps explicit tenant routes tenant-aware", () => {
    expect(isPublicPlatformSurfacePath("/t/junin-1")).toBe(false);
    expect(isPublicPlatformSurfacePath("/tenant/junin-1")).toBe(false);
    expect(isPublicPlatformSurfacePath("/municipio/junin-1")).toBe(false);
    expect(isPublicPlatformSurfacePath("/pyme/bodega-demo")).toBe(false);
    expect(isPublicPlatformSurfacePath("/market/bodega-demo")).toBe(false);
  });

  it("treats an unknown first path segment as a direct tenant slug", () => {
    expect(isPublicPlatformSurfacePath("/junin-1")).toBe(false);
    expect(isPublicPlatformSurfacePath("/bodega-demo/catalogo")).toBe(false);
  });
});
