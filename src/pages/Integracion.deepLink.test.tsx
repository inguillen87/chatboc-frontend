import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Integracion from "@/pages/Integracion";
import { tenantService } from "@/services/tenantService";

const whatsappOnboardingMock = vi.fn();

vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({
    loading: false,
    user: { tenantSlug: "junin", rol: "admin", role: "admin", tipo_chat: "municipio" },
  }),
}));

vi.mock("@/services/tenantService", () => ({
  tenantService: {
    getTenantConfig: vi.fn(),
    getIntegrationEmbed: vi.fn(),
    getPublicWidgetConfig: vi.fn(),
    listWhatsappNumbers: vi.fn(),
    updateTenantConfig: vi.fn(),
    assignWhatsappNumber: vi.fn(),
    createWhatsappNumber: vi.fn(),
    createExternalWhatsappNumber: vi.fn(),
    deleteWhatsappNumber: vi.fn(),
  },
}));

vi.mock("@/components/brand/MetaAppReviewApproval", () => ({
  default: () => <div data-testid="meta-review">Meta review</div>,
}));

vi.mock("@/components/tenant/MenuBuilder", () => ({
  default: () => <div data-testid="menu-builder">Menu builder</div>,
}));

vi.mock("@/pages/pyme/integraciones/IntegracionesPage", () => ({
  default: () => <div data-testid="marketplace-integrations">Marketplace integrations</div>,
}));

vi.mock("@/components/integrations/WhatsappTechProviderOnboarding", () => ({
  default: (props: { tenantSlug?: string | null; focusAction?: string | null }) => {
    whatsappOnboardingMock(props);
    return (
      <div data-testid="whatsapp-tech-provider">
        {props.tenantSlug}:{props.focusAction}
      </div>
    );
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedTenantService = vi.mocked(tenantService);

const baseConfig = {
  tenant: {
    slug: "junin",
    nombre: "Municipalidad de Junin",
    tipo: "municipio",
    plan: "full",
    color_primario: "#0f766e",
    logo_url: "",
  },
  whatsapp: {
    has_number: false,
    phone_number: "",
    sender_id: "",
  },
  configs: {
    widget: { default: {} },
    contacts: { default: {} },
    links: { default: { items: [] } },
    menu: { default: { version: 1, main_menu: [], submenus: {} } },
  },
};

const renderPage = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/integracion" element={<Integracion />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Integracion deep links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whatsappOnboardingMock.mockClear();
    mockedTenantService.getTenantConfig.mockResolvedValue(baseConfig as any);
    mockedTenantService.getIntegrationEmbed.mockResolvedValue({ widget: { embed_snippet: "" } });
    mockedTenantService.getPublicWidgetConfig.mockResolvedValue({ widget: { builder_config: {} } });
  });

  it("opens WhatsApp setup and forwards focusAction from channel deep links", async () => {
    renderPage("/integracion?channel=whatsapp&action=register-sender");

    expect(await screen.findByTestId("whatsapp-tech-provider")).toHaveTextContent("junin:register-sender");
    await waitFor(() => {
      expect(whatsappOnboardingMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ tenantSlug: "junin", focusAction: "register-sender" }),
      );
    });
    expect(screen.getByRole("tab", { name: /whatsapp/i })).toHaveAttribute("data-state", "active");
  });
});
