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

  it("normalizes backend role payloads into the rol field expected by the app", () => {
    const user = persistPanelLoginSession({
      token: "jwt-token",
      user: {
        id: 11,
        email: "mauricio@junin.com",
        name: "Mauricio",
        role: "admin_municipio",
        tenant_slug: "municipio",
      },
      tipoChat: "municipio",
    });

    expect(user).toMatchObject({
      role: "admin_municipio",
      rol: "admin_municipio",
      tenant_slug: "municipio",
      tipo_chat: "municipio",
    });
    expect(JSON.parse(safeLocalStorage.getItem("user") || "{}")).toMatchObject({
      role: "admin_municipio",
      rol: "admin_municipio",
    });
  });

  it("removes stale Clerk markers when a legacy panel login replaces the session", () => {
    safeLocalStorage.setItem("authProvider", "clerk");
    safeLocalStorage.setItem("clerkUserId", "user_clerk_a");
    safeLocalStorage.setItem(
      "user",
      JSON.stringify({
        id: 21,
        email: "old@chatboc.test",
        authProvider: "clerk",
        auth_provider: "clerk",
        clerkUserId: "user_clerk_a",
      }),
    );

    const user = persistPanelLoginSession({
      token: "legacy-token",
      user: {
        id: 22,
        email: "legacy@chatboc.test",
        rol: "admin",
        tenant_slug: "junin",
      },
    });

    expect(safeLocalStorage.getItem("authProvider")).toBeNull();
    expect(safeLocalStorage.getItem("clerkUserId")).toBeNull();
    expect(user).not.toHaveProperty("authProvider");
    expect(user).not.toHaveProperty("auth_provider");
    expect(user).not.toHaveProperty("clerkUserId");
  });
});
