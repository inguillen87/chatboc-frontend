import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("shows global templates as read-only while keeping tenant templates editable", async () => {
    pageMocks.apiFetch.mockResolvedValue({
      plantillas: [
        {
          id: 1,
          tenant_id: null,
          tenant_slug: null,
          scope: "global",
          name: "Base validada",
          text: "Respuesta institucional compartida.",
          keywords: ["base"],
          is_active: true,
        },
        {
          id: 2,
          tenant_id: 7,
          tenant_slug: "junin",
          scope: "tenant",
          name: "Respuesta local",
          text: "Respuesta configurada por el equipo local.",
          keywords: ["local"],
          is_active: true,
        },
      ],
    });

    renderPage();

    const globalCard = (await screen.findByText("Base validada")).closest("article");
    const tenantCard = screen.getByText("Respuesta local").closest("article");
    expect(globalCard).not.toBeNull();
    expect(tenantCard).not.toBeNull();

    expect(within(globalCard as HTMLElement).getByText("Base institucional")).toBeInTheDocument();
    expect(within(globalCard as HTMLElement).getByText("Solo lectura")).toBeInTheDocument();
    expect(within(globalCard as HTMLElement).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(globalCard as HTMLElement).queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();

    expect(within(tenantCard as HTMLElement).getByText("De esta organización")).toBeInTheDocument();
    expect(within(tenantCard as HTMLElement).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(tenantCard as HTMLElement).getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });
});
