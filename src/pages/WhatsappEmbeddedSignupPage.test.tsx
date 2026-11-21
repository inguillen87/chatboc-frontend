import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WhatsappEmbeddedSignupPage from "@/pages/WhatsappEmbeddedSignupPage";
import { tenantService } from "@/services/tenantService";
import { ApiError } from "@/utils/api";

vi.mock("@/services/tenantService", () => ({
  tenantService: {
    completeWhatsappEmbeddedSignup: vi.fn(),
  },
}));

const mockedTenantService = vi.mocked(tenantService);

const renderPage = (entry = "/integracion/whatsapp/connect?tenant=junin-1&app_id=meta-app&config_id=cfg-123") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
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
      ok: true, status: "accepted", persisted: true, tenant: { slug: "junin-1" },
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
    expect(startButton).toHaveClass("w-full", "sm:w-auto");
    expect(screen.getByRole("progressbar", { name: /autorizacion de whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /pasos del registro con meta/i })).toBeInTheDocument();
    expect(screen.getByText("Autorizar con Meta").closest("li")).toHaveAttribute("aria-current", "step");

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
    expect(screen.getByRole("status")).toHaveTextContent("Falta habilitar el número");

    fireEvent.click(screen.getByRole("button", { name: /continuar activación/i }));

    expect(consoleLogSpy).toHaveBeenCalledWith("Mocked navigate to: /t/junin-1/integracion?channel=whatsapp&action=register-sender");
    consoleLogSpy.mockRestore();
  });

  it("accepts FINISH_ONLY_WABA without waiting for a phone number id", async () => {
    mockedTenantService.completeWhatsappEmbeddedSignup.mockResolvedValueOnce({
      ok: true, status: "accepted", persisted: true, tenant: { slug: "junin-1" },
    });
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
            event: "FINISH_ONLY_WABA",
            data: {
              waba_id: "waba-123",
              session_id: "session-789",
            },
          }),
        }),
      );
    });

    expect((await screen.findAllByText(/esperando codigo de autorizacion/i)).length).toBeGreaterThan(0);
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();

    await act(async () => {
      loginCallback?.({
        status: "connected",
        authResponse: { code: "meta-code" },
      });
    });

    await waitFor(() => {
      expect(mockedTenantService.completeWhatsappEmbeddedSignup).toHaveBeenCalledWith("junin-1", {
        waba_id: "waba-123",
        phone_number_id: null,
        session_id: "session-789",
        code: "meta-code",
        event: "FINISH_ONLY_WABA",
        business_id: null,
      });
    });
    expect(await screen.findByText(/n.mero pendiente de registro/i)).toBeInTheDocument();
    expect(screen.getByText("Autorizar con Meta").closest("li")).toHaveTextContent("Completado");
    expect(screen.getByRole("status")).toHaveTextContent("Consultá el estado del número en Integraciones");
    expect(screen.queryByRole("button", { name: /continuar activación/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /volver a integraciones/i })).toBeEnabled();
  });

  it.each([
    { status: "validated", persisted: false, slug: "junin-1" },
    { status: "accepted", persisted: true, slug: "otra-organizacion" },
  ])("requires a persisted receipt for this organization before continuing activation (%o)", async receipt => {
    mockedTenantService.completeWhatsappEmbeddedSignup.mockResolvedValueOnce({
      ok: true, status: receipt.status, persisted: receipt.persisted, tenant: { slug: receipt.slug },
      next_action: "register_whatsapp_sender_via_senders_api",
    });
    renderPage();
    const start = screen.getByRole("button", { name: /iniciar registro con meta/i });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    await act(async () => {
      loginCallback?.({ status: "connected", authResponse: { code: "synthetic-code" } });
      window.dispatchEvent(new MessageEvent("message", { origin: "https://www.facebook.com", data: {
        type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "waba-123", phone_number_id: "phone-456" },
      } }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("No pudimos confirmar el resultado");
    expect(start).toBeDisabled();
    expect(screen.queryByRole("button", { name: /registro guardado|continuar activación/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /volver a integraciones/i })).toBeEnabled();
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).toHaveBeenCalledTimes(1);
  });

  it("keeps a recoverable return path when the Meta configuration is incomplete", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    renderPage("/integracion/whatsapp/connect");

    expect(await screen.findByText(/la plataforma no envio todos los datos necesarios/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /volver a integraciones/i }));

    expect(consoleLogSpy).toHaveBeenCalledWith("Mocked navigate to: /integracion?channel=whatsapp");
    consoleLogSpy.mockRestore();
  });

  it("leaves an uncertain signup write for manual verification without claiming changes were not saved", async () => {
    mockedTenantService.completeWhatsappEmbeddedSignup.mockRejectedValueOnce(new Error("transport_failure"));
    renderPage();
    const startButton = await screen.findByRole("button", { name: /iniciar registro con meta/i });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(startButton);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://www.facebook.com",
        data: {
          type: "WA_EMBEDDED_SIGNUP", event: "FINISH",
          data: { waba_id: "waba-123", phone_number_id: "phone-456" },
        },
      }));
    });
    await act(async () => {
      loginCallback?.({ status: "connected", authResponse: { code: "meta-code" } });
    });
    expect((await screen.findAllByText(/No pudimos confirmar el resultado\. Vuelve a integraciones y actualiza el estado/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/No se guardaron los cambios/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /volver a integraciones/i })).toBeEnabled();
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).toHaveBeenCalledTimes(1);
    expect(window.FB?.login).toHaveBeenCalledTimes(1);
  });

  const finish = () => window.dispatchEvent(new MessageEvent("message", { origin: "https://www.facebook.com",
    data: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "account-a", phone_number_id: "phone-a" } },
  }));

  it("keeps the signup closed when the tenant in the path conflicts with the query", async () => {
    render(<MemoryRouter initialEntries={["/t/org-a/integracion/whatsapp/connect?tenant=org-b&app_id=app&config_id=cfg"]}>
      <WhatsappEmbeddedSignupPage />
    </MemoryRouter>);
    expect(screen.getByRole("button", { name: /parametros incompletos/i })).toBeDisabled();
    expect(window.FB?.init).not.toHaveBeenCalled();
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();
  });

  it.each(["popup", "write"])("retires a pending %s when the organization changes on the same route", async stage => {
    let resolveWrite!: (receipt: object) => void;
    if (stage === "write") {
      mockedTenantService.completeWhatsappEmbeddedSignup.mockImplementationOnce(() => new Promise(resolve => { resolveWrite = resolve; }));
    }
    const url = (slug: string) => `/integracion/whatsapp/connect?tenant=${slug}&app_id=app&config_id=config`;
    function SwitchOrganization() {
      const [, setParams] = useSearchParams();
      return <button onClick={() => setParams({ tenant: "org-b", app_id: "app", config_id: "config" })}>Cambiar organización</button>;
    }
    render(<MemoryRouter initialEntries={[url("org-a")]}><SwitchOrganization /><WhatsappEmbeddedSignupPage /></MemoryRouter>);
    const start = screen.getByRole("button", { name: /iniciar registro con meta/i });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    const oldCallback = loginCallback;
    act(() => {
      finish();
      if (stage === "write") oldCallback?.({ authResponse: { code: "synthetic-code" } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar organización" }));
    await act(async () => {
      if (stage === "popup") {
        oldCallback?.({ authResponse: { code: "late-code" } });
        finish();
      } else {
        resolveWrite({ ok: true, status: "accepted", persisted: true, tenant: { slug: "org-a" } });
      }
    });
    expect(screen.getByText("org-b")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /registro guardado|continuar activación/i })).not.toBeInTheDocument();
    if (stage === "popup") {
      expect(mockedTenantService.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();
      const link = screen.getByRole("link", { name: /iniciar registro en otra pestaña/i });
      expect(link).toHaveAttribute("href", url("org-b"));
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    } else {
      expect(mockedTenantService.completeWhatsappEmbeddedSignup.mock.calls.map(([slug]) => slug)).toEqual(["org-a"]);
      expect(screen.getByRole("button", { name: /iniciar registro con meta/i })).toBeEnabled();
    }
  });

  it("starts a fresh authorization after an explicit correctable rejection without replaying the old data", async () => {
    mockedTenantService.completeWhatsappEmbeddedSignup.mockRejectedValueOnce(new ApiError("Corregí la cuenta", 422, {
      contract_version: "twilio.tech_provider.embedded_signup.v1", ok: false, status: "rejected", tenant: { slug: "junin-1" },
      persisted: false, state_unchanged: true, provider_calls_performed: false, retryable_after_correction: true,
    }));
    renderPage();
    const start = screen.getByRole("button", { name: /iniciar registro con meta/i });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    await act(async () => { finish(); loginCallback?.({ authResponse: { code: "first-code" } }); });
    expect(screen.getByRole("status")).toHaveTextContent("Revisá los datos");
    fireEvent.click(start);
    await act(async () => { loginCallback?.({ authResponse: { code: "new-code" } }); });
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(mockedTenantService.completeWhatsappEmbeddedSignup.mock.calls.map(([, payload]) => payload.code))
      .toEqual(["first-code", "new-code"]);
  });
});
