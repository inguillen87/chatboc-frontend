import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AnalyticsAccessPage, {
  resolveAnalyticsAccessMode,
} from "./AnalyticsAccessPage";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  profileRequest: vi.fn(),
  tenantWideDashboardRequest: vi.fn(),
  tenantWideHubRequest: vi.fn(),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => mocks.useUser(),
}));

vi.mock("@/utils/api", () => ({
  apiFetch: (...args: unknown[]) => mocks.profileRequest(...args),
}));

vi.mock("@/pages/analytics/AnalyticsPage", () => ({
  default: () => {
    mocks.tenantWideDashboardRequest();
    return <div>advanced-dashboard</div>;
  },
}));

vi.mock("./AnalyticsHubPage", () => ({
  default: () => {
    mocks.tenantWideHubRequest();
    return <div>advanced-hub</div>;
  },
}));

vi.mock("./OperationsDashboardPage", () => ({
  default: () => <div>operations-page</div>,
}));

vi.mock("./OperationsDashboardPanel", () => ({
  OperationsDashboardPanel: () => <div>operations-panel</div>,
}));

const renderAccessPage = (
  props?: React.ComponentProps<typeof AnalyticsAccessPage>,
) =>
  render(
    <MemoryRouter initialEntries={["/analytics"]}>
      <React.Suspense fallback={<div>loading-module</div>}>
        <Routes>
          <Route
            path="/analytics"
            element={<AnalyticsAccessPage {...props} />}
          />
          <Route path="/403" element={<div>denied</div>} />
        </Routes>
      </React.Suspense>
    </MemoryRouter>,
  );

describe("AnalyticsAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.useUser.mockReturnValue({ user: null, loading: false });
    mocks.profileRequest.mockResolvedValue({ rol: "employee" });
  });

  it.each(["employee", "empleado", "operator", "operador", "agent"])(
    "keeps %s on the operations contract without mounting tenant-wide analytics",
    async (role) => {
      mocks.useUser.mockReturnValue({ user: { rol: role }, loading: false });

      renderAccessPage();

      expect(await screen.findByText("operations-page")).toBeInTheDocument();
      expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
      expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
    },
  );

  it("uses the embedded operations panel for an employee profile tab", async () => {
    mocks.useUser.mockReturnValue({
      user: { rol: "empleado" },
      loading: false,
    });

    renderAccessPage({ embedded: true });

    expect(await screen.findByText("operations-panel")).toBeInTheDocument();
    expect(screen.queryByText("operations-page")).not.toBeInTheDocument();
    expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });

  it("does not mount the tenant-wide hub for an employee opening the hub URL", async () => {
    mocks.useUser.mockReturnValue({
      user: { rol: "employee" },
      loading: false,
    });

    renderAccessPage({ variant: "hub" });

    expect(await screen.findByText("operations-page")).toBeInTheDocument();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });

  it("recovers the persisted employee role without briefly mounting advanced analytics", async () => {
    window.localStorage.setItem("user", JSON.stringify({ rol: "operador" }));
    mocks.useUser.mockReturnValue({ user: null, loading: true });

    renderAccessPage();

    expect(await screen.findByText("operations-page")).toBeInTheDocument();
    expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });

  it("never elevates a stale persisted admin while the live session is loading", async () => {
    window.localStorage.setItem("user", JSON.stringify({ rol: "admin" }));
    mocks.useUser.mockReturnValue({ user: null, loading: true });

    renderAccessPage();

    expect(
      await screen.findByText("Validando acceso a métricas"),
    ).toBeInTheDocument();
    expect(screen.queryByText("advanced-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("operations-page")).not.toBeInTheDocument();
    expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });

  it("does not trust a hydrated admin profile until useUser finishes validation", async () => {
    window.localStorage.setItem("user", JSON.stringify({ rol: "admin" }));
    mocks.useUser.mockReturnValue({
      user: { rol: "admin" },
      loading: true,
    });

    renderAccessPage();

    expect(
      await screen.findByText("Validando acceso a métricas"),
    ).toBeInTheDocument();
    expect(screen.queryByText("advanced-dashboard")).not.toBeInTheDocument();
    expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });

  it("does not elevate a persisted admin when the authoritative profile is an employee", async () => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: 42, rol: "admin", rubro: "municipio" }),
    );
    mocks.useUser.mockReturnValue({
      user: { id: 42, rol: "admin", rubro: "municipio" },
      loading: false,
    });
    mocks.profileRequest.mockResolvedValue({ rol: "employee" });

    renderAccessPage();

    expect(await screen.findByText("operations-page")).toBeInTheDocument();
    expect(mocks.profileRequest).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        omitEntityToken: true,
        omitTenant: true,
      }),
    );
    expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });

  it.each(["admin", "admin_municipio", "super_admin", "analytics_viewer"])(
    "preserves the advanced dashboard for %s",
    async (role) => {
      mocks.useUser.mockReturnValue({ user: { rol: role }, loading: false });
      mocks.profileRequest.mockResolvedValue({ rol: role });

      renderAccessPage();

      expect(await screen.findByText("advanced-dashboard")).toBeInTheDocument();
      expect(mocks.tenantWideDashboardRequest).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("operations-page")).not.toBeInTheDocument();
    },
  );

  it("preserves the executive hub for tenant admins", async () => {
    mocks.useUser.mockReturnValue({
      user: { rol: "tenant_admin" },
      loading: false,
    });
    mocks.profileRequest.mockResolvedValue({ rol: "tenant_admin" });

    renderAccessPage({ variant: "hub" });

    expect(await screen.findByText("advanced-hub")).toBeInTheDocument();
    expect(mocks.tenantWideHubRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("operations-page")).not.toBeInTheDocument();
  });

  it("fails closed for a role outside the backoffice analytics policy", async () => {
    mocks.useUser.mockReturnValue({
      user: { rol: "chat_user" },
      loading: false,
    });
    mocks.profileRequest.mockResolvedValue({ rol: "chat_user" });

    renderAccessPage();

    expect(await screen.findByText("denied")).toBeInTheDocument();
    expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });

  it("fails closed without mounting advanced analytics when profile validation fails", async () => {
    mocks.useUser.mockReturnValue({
      user: { id: 7, rol: "admin" },
      loading: false,
    });
    mocks.profileRequest.mockRejectedValue(new Error("network unavailable"));

    renderAccessPage();

    expect(
      await screen.findByText("No pudimos validar el acceso a analítica"),
    ).toBeInTheDocument();
    expect(mocks.tenantWideDashboardRequest).not.toHaveBeenCalled();
    expect(mocks.tenantWideHubRequest).not.toHaveBeenCalled();
  });
});

describe("resolveAnalyticsAccessMode", () => {
  it("separates tenant-wide analytics from employee operations", () => {
    expect(resolveAnalyticsAccessMode("empleado")).toBe("operations");
    expect(resolveAnalyticsAccessMode("admin")).toBe("advanced");
    expect(resolveAnalyticsAccessMode("analytics_viewer")).toBe("advanced");
    expect(resolveAnalyticsAccessMode("chat_user")).toBe("denied");
  });
});
