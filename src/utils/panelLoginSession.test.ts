import { beforeEach, describe, expect, it, vi } from "vitest";

import { persistPanelLoginSession } from "./panelLoginSession";
import { safeLocalStorage } from "./safeLocalStorage";

describe("persistPanelLoginSession", () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it("stores a minimal tenant admin identity immediately after login", () => {
    const setUser = vi.fn();

    const user = persistPanelLoginSession({
      token: "jwt-token",
      user: {
        id: 7,
        email: "mauricio@junin.com",
        name: "Mauricio",
        rol: "admin",
        tenant_slug: "junin",
      },
      tipoChat: "municipio",
      setUser,
    });

    expect(safeLocalStorage.getItem("authToken")).toBe("jwt-token");
    expect(safeLocalStorage.getItem("tenantSlug")).toBe("junin");
    expect(user).toMatchObject({
      id: 7,
      email: "mauricio@junin.com",
      rol: "admin",
      tipo_chat: "municipio",
      tenant_slug: "junin",
      tenantSlug: "junin",
      tenant: { slug: "junin", tenant_slug: "junin" },
    });
    expect(JSON.parse(safeLocalStorage.getItem("user") || "{}")).toMatchObject({
      rol: "admin",
      tipo_chat: "municipio",
      tenant_slug: "junin",
    });
    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ tenant_slug: "junin" }));
  });

  it("preserves existing user data while replacing stale role and tenant", () => {
    safeLocalStorage.setItem(
      "user",
      JSON.stringify({
        id: 3,
        name: "Old Name",
        rol: "empleado",
        tenant_slug: "viejo",
        preferences: { density: "compact" },
      }),
    );

    const user = persistPanelLoginSession({
      token: "new-token",
      user: {
        email: "admin@junin.com",
        rol: "admin_municipio",
        tenant_slug: "junin",
      },
    });

    expect(user).toMatchObject({
      id: 3,
      name: "Old Name",
      email: "admin@junin.com",
      rol: "admin_municipio",
      tenant_slug: "junin",
      preferences: { density: "compact" },
    });
    expect(JSON.parse(safeLocalStorage.getItem("user") || "{}")).toMatchObject({
      tenant_slug: "junin",
      tenantSlug: "junin",
    });
  });
});
