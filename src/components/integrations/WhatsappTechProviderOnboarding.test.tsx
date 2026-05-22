import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WhatsappTechProviderOnboarding from "@/components/integrations/WhatsappTechProviderOnboarding";
import { tenantService } from "@/services/tenantService";

vi.mock("@/services/tenantService", () => ({
  tenantService: {
    getWhatsappTechProvider: vi.fn(),
    provisionWhatsappTechProvider: vi.fn(),
    provisionWhatsappVoiceApp: vi.fn(),
    registerWhatsappSender: vi.fn(),
    refreshWhatsappSenderStatus: vi.fn(),
  },
}));

vi.mock("@/utils/api", async () => {
  const actual = await vi.importActual<typeof import("@/utils/api")>("@/utils/api");
  return {
    ...actual,
    getErrorMessage: (_error: unknown, fallback: string) => fallback,
  };
});

const mockedTenantService = vi.mocked(tenantService);

const baseContract = {
  contract_version: "twilio.tech_provider.v1",
  status: "pending_meta_signup",
  state: {
    waba_id: "123456789",
    phone_number_id: "987654321",
    sender_id: "whatsapp:+18564858589",
    sender_sid: "XESENDER123",
    sender_status: "online",
  },
  automation: {
    env: {
      ready: true,
      missing: [],
    },
  },
  embedded_signup: {
    enabled: true,
    start_url: "https://connect.example.test/signup",
  },
  voice: {
    status: "ready",
    voice_url: "/twilio/voice?tenant=junin-1",
  },
  api_workflow: [
    { id: "meta", label: "Meta signup", status: "ready" },
    { id: "sender", label: "Sender API", status: "pending" },
  ],
  limitations: ["El cliente debe autorizar su WABA desde Meta."],
};

describe("WhatsappTechProviderOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: baseContract });
    mockedTenantService.provisionWhatsappTechProvider.mockResolvedValue({
      contract: {
        ...baseContract,
        state: {
          ...baseContract.state,
          sender_sid: "XEUPDATED",
        },
      },
    });
    mockedTenantService.provisionWhatsappVoiceApp.mockResolvedValue({ contract: baseContract });
    mockedTenantService.registerWhatsappSender.mockResolvedValue({ contract: baseContract });
    mockedTenantService.refreshWhatsappSenderStatus.mockResolvedValue({ contract: baseContract });
    vi.stubGlobal("open", vi.fn());
  });

  it("renders the production WhatsApp activation contract for a tenant", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    expect(await screen.findByText("WhatsApp productivo")).toBeInTheDocument();
    expect(screen.getByText("Activacion guiada por Chatboc")).toBeInTheDocument();
    expect(screen.getByText("123456789")).toBeInTheDocument();
    expect(screen.getByText("987654321")).toBeInTheDocument();
    expect(screen.getByText("whatsapp:+18564858589")).toBeInTheDocument();
    expect(screen.getByText("XESENDER123")).toBeInTheDocument();
    expect(screen.getByText("online")).toBeInTheDocument();
    expect(screen.getAllByText("ready").length).toBeGreaterThan(0);
    expect(screen.getByText(/Registrar sender productivo con Twilio Senders API/i)).toBeInTheDocument();
    expect(screen.getByText("El cliente debe autorizar su WABA desde Meta.")).toBeInTheDocument();

    expect(mockedTenantService.getWhatsappTechProvider).toHaveBeenCalledWith("junin-1");
  });

  it("updates the visible contract after preparing activation", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /preparar activacion/i }));

    await waitFor(() => {
      expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledWith("junin-1", {
        source: "tenant_panel",
      });
    });

    expect(await screen.findByText("XEUPDATED")).toBeInTheDocument();
  });
});
