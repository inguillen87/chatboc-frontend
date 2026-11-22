import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WhatsappEmbeddedSignupPage from "@/pages/WhatsappEmbeddedSignupPage";
import { tenantService } from "@/services/tenantService";
import { ApiError } from "@/utils/api";

vi.mock("@/services/tenantService", () => ({
  DIRECT_SIGNUP_CONTRACT: "chatboc.meta_direct_embedded_signup.v1",
  tenantService: {
    getWhatsappTechProvider: vi.fn(),
    startDirectWhatsappSignup: vi.fn(),
    finishDirectWhatsappSignup: vi.fn(),
    resumeDirectWhatsappSignup: vi.fn(),
    completeWhatsappEmbeddedSignup: vi.fn(),
  },
}));
const actor = vi.hoisted(() => ({ id: 42 }));
vi.mock("@/hooks/useUser", () => ({ useUser: () => ({ user: actor, organizationProfileVerified: true }) }));

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
    sessionStorage.clear();
    actor.id = 42;
    mockedTenantService.getWhatsappTechProvider.mockImplementation(async slug => ({
      contract_version: "twilio.tech_provider.v1", tenant: { slug },
    }));
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

  const directContract = "chatboc.meta_direct_embedded_signup.v1";
  const labels = {
    prepare: "Preparar autorización",
    resume: "Consultar estado del registro",
    done: "WhatsApp conectado",
    restored: "Podés consultar el resultado del registro anterior.",
    prepared: "La autorización está lista. Continuá con Meta.",
    prepare_failed: "No pudimos preparar el registro. Podés volver a intentarlo.",
    connected: "Meta confirmó la conexión del número con esta organización.",
    new_authorization: "La autorización anterior terminó. Revisá la cuenta y prepará una nueva autorización.",
    register_phone: "Todavía falta registrar el número en Meta. Después podés consultar el estado.",
    pending: "La conexión sigue pendiente. Podés consultar el estado del registro.",
    unknown: "No pudimos confirmar el resultado. Consultá el estado del registro.",
    choose_phone: "Para conectar WhatsApp, seleccioná una cuenta y su número en Meta.",
    cancelled: "El registro fue cancelado. Podés preparar otra autorización.",
    provider_error: "Meta no pudo completar el registro. Revisá la cuenta y volvé a intentarlo.",
    not_authorized: "Meta no completó la autorización. Podés empezar otra.",
    sending: "Confirmando el registro con Meta.",
    checking: "Consultando el estado del registro.",
  };
  const handle = "A".repeat(43);
  const directUrl = "/integracion/whatsapp/connect?tenant=org-a&app_id=app&config_id=cfg";
  const enableDirect = () => {
    mockedTenantService.getWhatsappTechProvider.mockImplementation(async slug => ({
      contract_version: "twilio.tech_provider.v1", tenant: { slug },
      direct_embedded_signup: { enabled: true, app_id: "app", configuration_id: "cfg", labels },
    }));
    mockedTenantService.startDirectWhatsappSignup.mockResolvedValue({
      contract_version: directContract, ok: true, signup_state: handle, expires_in: 900,
    });
  };
  const openDirectPopup = async () => {
    const prepare = await screen.findByRole("button", { name: /preparar autorización/i });
    await waitFor(() => expect(prepare).toBeEnabled());
    fireEvent.click(prepare);
    const open = await screen.findByRole("button", { name: /iniciar registro con meta/i });
    expect(window.FB?.login).not.toHaveBeenCalled();
    fireEvent.click(open);
    expect(window.FB?.login).toHaveBeenCalledWith(expect.any(Function), {
      config_id: "cfg", response_type: "code", override_default_response_type: true, extras: { setup: {} },
    });
  };

  it("validates the server session before opening Meta and resumes a pending finish after reload without its code", async () => {
    enableDirect();
    mockedTenantService.finishDirectWhatsappSignup.mockResolvedValue({
      contract_version: directContract, ok: false, status: "pending", reason_code: "meta_phone_registration_pending",
    });
    mockedTenantService.resumeDirectWhatsappSignup.mockResolvedValue({
      contract_version: directContract, ok: true, status: "connected",
    });
    const firstPage = renderPage(directUrl);
    await openDirectPopup();
    expect(mockedTenantService.startDirectWhatsappSignup).toHaveBeenCalledExactlyOnceWith("org-a");
    await act(async () => {
      finish();
      loginCallback?.({ authResponse: { code: "one-use-secret" } });
      finish();
    });
    expect(mockedTenantService.finishDirectWhatsappSignup).toHaveBeenCalledExactlyOnceWith("org-a", {
      code: "one-use-secret", signup_state: handle, phone_number_id: "phone-a", waba_id: "account-a",
      session_id: null, business_id: null, event: "FINISH",
    });
    expect(screen.getByRole("status")).toHaveTextContent("falta registrar el número");
    expect(Object.values(sessionStorage)).toEqual([handle]);
    expect(JSON.stringify(localStorage)).not.toContain(handle);
    firstPage.unmount();
    renderPage(directUrl);
    fireEvent.click(await screen.findByRole("button", { name: /consultar estado del registro/i }));
    expect(await screen.findByRole("button", { name: /whatsapp conectado/i })).toBeDisabled();
    expect(mockedTenantService.resumeDirectWhatsappSignup).toHaveBeenCalledExactlyOnceWith("org-a", handle);
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();
    expect(window.FB?.login).toHaveBeenCalledTimes(1);
    expect(Object.values(sessionStorage)).not.toContain(handle);
  });

  it.each([
    [409, "meta_signup_credential_reauthorization_required"],
    [403, "meta_signup_session_invalid"],
  ] as const)("keeps uncertain writes scoped and allows fresh authorization after a terminal receipt (%s, %s)", async (status, reason) => {
    enableDirect();
    mockedTenantService.finishDirectWhatsappSignup.mockRejectedValueOnce(new Error("offline"));
    mockedTenantService.resumeDirectWhatsappSignup.mockRejectedValueOnce(new ApiError("terminal", status, {
      contract_version: directContract, ok: false, reason_code: reason,
    }));
    const firstPage = renderPage(directUrl);
    await openDirectPopup();
    await act(async () => { loginCallback?.({ authResponse: { code: "synthetic-code" } }); finish(); });
    expect(screen.getByRole("status")).toHaveTextContent("No pudimos confirmar");
    firstPage.unmount();
    actor.id = 73;
    const otherPage = renderPage(directUrl);
    expect(await screen.findByRole("button", { name: /preparar autorización/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /consultar estado/i })).toBeNull();
    expect(mockedTenantService.resumeDirectWhatsappSignup).not.toHaveBeenCalled();
    otherPage.unmount();
    actor.id = 42;
    renderPage(directUrl);
    fireEvent.click(await screen.findByRole("button", { name: /consultar estado del registro/i }));
    expect(await screen.findByRole("button", { name: /preparar autorización/i })).toBeEnabled();
    expect(Object.values(sessionStorage)).not.toContain(handle);
    expect(mockedTenantService.startDirectWhatsappSignup).toHaveBeenCalledTimes(1);
    expect(mockedTenantService.finishDirectWhatsappSignup).toHaveBeenCalledTimes(1);
  });

  it("discards an unsupported final event without exchanging the code or using the legacy endpoint", async () => {
    enableDirect();
    renderPage(directUrl);
    await openDirectPopup();
    await act(async () => {
      loginCallback?.({ authResponse: { code: "test-code" } });
      const data = { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "123", phone_number_id: "456" } };
      window.dispatchEvent(new MessageEvent("message", { origin: "http://web.facebook.com", data }));
      window.dispatchEvent(new MessageEvent("message", { origin: "https://www.facebook.com",
        data: { ...data, event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" } }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("seleccioná una cuenta y su número");
    expect(mockedTenantService.finishDirectWhatsappSignup).not.toHaveBeenCalled();
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();
    expect(Object.values(sessionStorage)).not.toContain(handle);
  });

  it("requires a verified reservation before opening Meta", async () => {
    enableDirect();
    mockedTenantService.startDirectWhatsappSignup.mockResolvedValue({ contract_version: directContract, ok: true, signup_state: "malformed" });
    renderPage(directUrl);
    const prepare = await screen.findByRole("button", { name: /preparar autorización/i });
    await waitFor(() => expect(prepare).toBeEnabled());
    fireEvent.click(prepare);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No pudimos preparar el registro"));
    expect(window.FB?.login).not.toHaveBeenCalled();
    expect(mockedTenantService.finishDirectWhatsappSignup).not.toHaveBeenCalled();
  });

  it("expires an unfinished popup and ignores its late callbacks", async () => {
    enableDirect();
    mockedTenantService.startDirectWhatsappSignup.mockResolvedValue({
      contract_version: directContract, ok: true, signup_state: handle, expires_in: 1,
    });
    renderPage(directUrl);
    await openDirectPopup();
    const freshTab = await screen.findByRole("link", { name: /iniciar registro en otra pestaña/i }, { timeout: 3000 });
    expect(freshTab).toHaveAttribute("rel", "noopener noreferrer");
    await act(async () => { loginCallback?.({ authResponse: { code: "expired" } }); finish(); });
    expect(mockedTenantService.finishDirectWhatsappSignup).not.toHaveBeenCalled();
  });

  it.each(["mismatched configuration", "mismatched tenant", "missing response"])("does not use the legacy path when direct capability cannot be verified (%s)", async problem => {
    if (problem === "missing response") mockedTenantService.getWhatsappTechProvider.mockRejectedValueOnce(new Error("offline"));
    else mockedTenantService.getWhatsappTechProvider.mockResolvedValueOnce({
      contract_version: "twilio.tech_provider.v1", tenant: { slug: problem === "mismatched tenant" ? "org-b" : "org-a" },
      direct_embedded_signup: { enabled: true, app_id: "app", configuration_id: problem === "mismatched configuration" ? null : "cfg" },
    });
    renderPage(directUrl);
    expect(await screen.findByText(/No pudimos preparar el registro con Meta/i)).toBeInTheDocument();
    expect(window.FB?.init).not.toHaveBeenCalled();
    expect(mockedTenantService.startDirectWhatsappSignup).not.toHaveBeenCalled();
    expect(mockedTenantService.completeWhatsappEmbeddedSignup).not.toHaveBeenCalled();
  });

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
