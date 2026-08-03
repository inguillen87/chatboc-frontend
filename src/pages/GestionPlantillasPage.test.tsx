import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GestionPlantillasPage from "./GestionPlantillasPage";

const pageMocks = vi.hoisted(() => ({
  role: "empleado",
  apiFetch: vi.fn(),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({ user: { rol: pageMocks.role } }),
}));

vi.mock("@/stores/tenantStore", () => ({
  useTenantStore: (selector: (state: { slug: string }) => unknown) => selector({ slug: "junin" }),
}));

vi.mock("@/utils/api", async () => {
  const actual = await vi.importActual<typeof import("@/utils/api")>("@/utils/api");
  return {
    ...actual,
    apiFetch: pageMocks.apiFetch,
  };
});

vi.mock("@/components/admin/WhatsappOperationsHub", () => ({
  default: ({ canManageFlows }: { canManageFlows?: boolean }) => (
    <div data-testid="whatsapp-operations-permission">{canManageFlows ? "admin" : "read-only"}</div>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GestionPlantillasPage />
    </MemoryRouter>,
  );

describe("GestionPlantillasPage WhatsApp permissions", () => {
  beforeEach(() => {
    pageMocks.role = "empleado";
    pageMocks.apiFetch.mockReset();
    pageMocks.apiFetch.mockResolvedValue({ plantillas: [] });
  });

  it("keeps WhatsApp operations read-only and hides onboarding from employees", async () => {
    renderPage();

    await waitFor(() => expect(pageMocks.apiFetch).toHaveBeenCalledWith("/api/ai/templates", expect.any(Object)));
    await screen.findByText("Sin plantillas rapidas cargadas");
    expect(screen.getByTestId("whatsapp-operations-permission")).toHaveTextContent("read-only");
    expect(screen.getByTestId("notification-template-preview-panel")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Onboarding WhatsApp/i })).not.toBeInTheDocument();
  });

  it("shows WhatsApp onboarding to tenant administrators", async () => {
    pageMocks.role = "tenant_admin";
    renderPage();

    await waitFor(() => expect(pageMocks.apiFetch).toHaveBeenCalledWith("/api/ai/templates", expect.any(Object)));
    await screen.findByText("Sin plantillas rapidas cargadas");
    expect(screen.getByTestId("whatsapp-operations-permission")).toHaveTextContent("admin");
    expect(screen.getByRole("link", { name: /Onboarding WhatsApp/i })).toHaveAttribute(
      "href",
      "/t/junin/integracion?channel=whatsapp&action=twilio-content",
    );
  });
});
