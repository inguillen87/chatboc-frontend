import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Integracion from "@/pages/Integracion";
import { tenantService } from "@/services/tenantService";

const whatsappOnboardingMock = vi.fn();
const session = vi.hoisted(() => ({
  loading: false, hasVerifiedSession: true, organizationProfileVerified: true, refreshUser: vi.fn(),
  user: { id: 42, tenantSlug: 'junin', rol: 'admin', role: 'admin', tipo_chat: 'municipio' },
}));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => session,
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
        <Route path="/t/:tenant/integracion" element={<Integracion />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Integracion deep links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.hasVerifiedSession = true; session.organizationProfileVerified = true;
    session.user = { id: 42, tenantSlug: 'junin', rol: 'admin', role: 'admin', tipo_chat: 'municipio' };
    whatsappOnboardingMock.mockClear();
    mockedTenantService.getTenantConfig.mockResolvedValue(baseConfig as any);
    mockedTenantService.getIntegrationEmbed.mockResolvedValue({ widget: { embed_snippet: "" } });
    mockedTenantService.getPublicWidgetConfig.mockResolvedValue({ widget: { builder_config: {} } });
    mockedTenantService.listWhatsappNumbers.mockResolvedValue({ numbers: [] });
  });
  it.each(['/integracion?channel=whatsapp&tenant_slug=selected-organization', '/t/selected-organization/integracion?channel=whatsapp'])
    ('keeps the explicit selected organization instead of the SuperAdmin actor home at %s', async entry => {
      session.user.rol = 'superadmin'; session.user.role = 'superadmin';
      mockedTenantService.getTenantConfig.mockResolvedValue({ ...baseConfig, tenant: { ...baseConfig.tenant, slug: 'selected-organization' } } as any);
      renderPage(entry);
      expect(await screen.findByTestId('whatsapp-tech-provider')).toHaveTextContent('selected-organization');
      expect(mockedTenantService.getTenantConfig).toHaveBeenCalledExactlyOnceWith('selected-organization');
      expect(session.user.tenantSlug).toBe('junin');
    });
  it('blocks conflicting route selectors and an unverified profile before loading configuration', async () => {
    renderPage('/t/selected-organization/integracion?tenant_slug=other-organization');
    expect(screen.getByText('No pudimos validar la organización')).toBeInTheDocument();
    expect(mockedTenantService.getTenantConfig).not.toHaveBeenCalled();
  });
  it('does not load settings from a persisted profile whose session has not been verified', () => {
    session.hasVerifiedSession = false; session.organizationProfileVerified = false;
    renderPage('/integracion?channel=whatsapp');
    expect(screen.getByText('No pudimos validar la organización')).toBeInTheDocument();
    expect(mockedTenantService.getTenantConfig).not.toHaveBeenCalled();
  });
  it('does not expose a foreign configuration response under the selected organization', async () => {
    renderPage('/integracion?tenant_slug=selected-organization');
    await screen.findByText('No se pudo cargar la configuración de la organización');
    expect(screen.queryByTestId('whatsapp-tech-provider')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
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

  it("renders tenants whose optional configuration namespaces are not initialized yet", async () => {
    mockedTenantService.getTenantConfig.mockResolvedValue({
      ...baseConfig,
      configs: {},
    } as any);

    renderPage("/integracion");

    expect(await screen.findByRole("heading", { name: /Integraci.n y Configuraci.n/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("data-state", "active");
    expect(screen.queryByText("Ocurri. un error inesperado", { exact: false })).not.toBeInTheDocument();
  });
});
