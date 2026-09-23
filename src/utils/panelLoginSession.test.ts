import { beforeEach, describe, expect, it, vi } from "vitest";

import { persistPanelLoginSession } from "./panelLoginSession";
import { safeLocalStorage } from "./safeLocalStorage";
import { usePanelSessionStore } from '@/stores';

describe("persistPanelLoginSession", () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
  });

  it('replaces the previous identity and organization contracts after a credential login', () => {
    usePanelSessionStore.getState().setAuthToken('previous-session');
    safeLocalStorage.setItem('tenantSlug', 'old-tenant');
    safeLocalStorage.setItem('entityToken', 'old-entity');
    safeLocalStorage.setItem('user', JSON.stringify({ id: 2, name: 'Old operator', tenant_slug: 'old-tenant',
      organization_profile: { private: 'old-profile' }, organization_workspace: { private: 'old-workspace' } }));
    const user = persistPanelLoginSession({ token: 'new-token', user: { id: 3, email: 'new@example.test', rol: 'tenant_admin', tenant_slug: 'new-tenant' }, replaceIdentity: true });
    expect(user).toMatchObject({ id: 3, tenant_slug: 'new-tenant' });
    expect(user).not.toHaveProperty('organization_profile');
    expect(user).not.toHaveProperty('name');
    expect(safeLocalStorage.getItem('entityToken')).toBeNull();
    expect(usePanelSessionStore.getState().authToken).toBe('new-token');
  });

  it('does not infer a new credential identity tenant from old local storage', () => {
    safeLocalStorage.setItem('tenantSlug', 'old-tenant');
    const user = persistPanelLoginSession({ token: 'new-token', user: { id: 3 }, replaceIdentity: true });
    expect(user).not.toHaveProperty('tenant_slug');
    expect(safeLocalStorage.getItem('tenantSlug')).toBeNull();
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
