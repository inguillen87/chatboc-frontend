import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WhatsappEmbeddedSignupPage from "@/pages/WhatsappEmbeddedSignupPage";
import { tenantService } from "@/services/tenantService";

vi.mock("@/services/tenantService", () => ({
  tenantService: {
    completeWhatsappEmbeddedSignup: vi.fn(),
  },
}));

const mockedTenantService = vi.mocked(tenantService);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/integracion/whatsapp/connect?tenant=junin-1&app_id=meta-app&config_id=cfg-123"]}>
      <Routes>
        <Route path="/integracion/whatsapp/connect" element={<WhatsappEmbeddedSignupPage />} />
        <Route path="/t/:tenant/integracion" element={<div>Integraciones tenant</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("WhatsappEmbeddedSignupPage", () => {
  let loginCallback: ((response: any) => void) | null;

  beforeEach(() => {
    vi.clearAllMocks();
    loginCallback = null;
    mockedTenantService.completeWhatsappEmbeddedSignup.mockResolvedValue({
      next_action: "register_whatsapp_sender_via_senders_api",
    });
    (window as any).FB = {
      init: vi.fn(),
      login: vi.fn((callback: (response: any) => void) => {
        loginCallback = callback;
      }),
    };
  });

  it("waits for Meta auth code before saving a finished signup", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    renderPage();

    const startButton = await screen.findByRole("button", { name: /iniciar registro con meta/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());

    fireEvent.click(startButton);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://www.facebook.com",
          data: JSON.stringify({
            type: "WA_EMBEDDED_SIGNUP",
            event: "FINISH",
            data: {
              waba_id: "waba-123",
              phone_number_id: "phone-456",
              session_id: "session-789",
            },
          }),
        }),
      );
    });

    expect((await screen.findAllByText("Meta envio la cuenta. Esperando codigo de autorizacion...")).length).toBeGreaterThan(0);
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();

    await act(async () => {
      loginCallback?.({
        status: "connected",
        authResponse: {
          code: "meta-code",
        },
      });
    });

    await waitFor(() => {
      expect(mockedTenantService.completeWhatsappEmbeddedSignup).toHaveBeenCalledWith("junin-1", {
        waba_id: "waba-123",
        phone_number_id: "phone-456",
        session_id: "session-789",
        code: "meta-code",
        event: "FINISH",
        business_id: null,
      });
    });
    expect(await screen.findByRole("button", { name: /registro guardado/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /continuar activacion/i }));

    expect(consoleLogSpy).toHaveBeenCalledWith("Mocked navigate to: /t/junin-1/integracion");
    consoleLogSpy.mockRestore();
  });
});
