import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN } from "@/utils/municipalChatIdempotency";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("@/utils/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/api")>()),
  apiFetch: apiFetchMock,
}));

vi.mock("./useUser", () => ({
  useUser: () => ({ user: null }),
}));

vi.mock("@/utils/widgetTelemetry", () => ({
  trackWidgetEvent: vi.fn(),
}));

import { useChatLogic } from "./useChatLogic";

const successfulReply = {
  respuesta_usuario: "Respuesta municipal",
  botones: [],
};

describe("useChatLogic municipal idempotency", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(successfulReply);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps the init key stable when the same municipal session retries", async () => {
    const { result } = renderHook(() =>
      useChatLogic({
        tipoChat: "municipio",
        tenantSlug: "junin",
        skipAuth: true,
        socketEnabled: false,
        autoInitEnabled: false,
      }),
    );

    await act(async () => {
      await result.current.initializeConversation({
        force: true,
        resetContext: true,
        resetMessages: true,
      });
    });
    await act(async () => {
      await result.current.initializeConversation({
        force: true,
        resetContext: true,
        resetMessages: true,
      });
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    const firstKey = apiFetchMock.mock.calls[0][1].headers["Idempotency-Key"];
    const retryKey = apiFetchMock.mock.calls[1][1].headers["Idempotency-Key"];
    expect(firstKey).toMatch(MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN);
    expect(retryKey).toBe(firstKey);
  });

  it("adds a fresh idempotency header to ordinary municipal JSON turns", async () => {
    const { result } = renderHook(() =>
      useChatLogic({
        tipoChat: "municipio",
        tenantSlug: "junin",
        skipAuth: true,
        socketEnabled: false,
        autoInitEnabled: false,
      }),
    );

    await act(async () => {
      await result.current.handleSend({
        text: "Como inicio un tramite",
        action: "info_tramite",
      });
    });

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.headers["Idempotency-Key"]).toMatch(
      MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN,
    );
    expect(options.body).not.toHaveProperty("idempotency_key");
  });

  it("adds a valid idempotency header to direct municipal audio turns", async () => {
    const { result } = renderHook(() =>
      useChatLogic({
        tipoChat: "municipio",
        tenantSlug: "junin",
        skipAuth: true,
        socketEnabled: false,
        autoInitEnabled: false,
      }),
    );

    await act(async () => {
      await result.current.handleSend({
        text: "Audio del reclamo",
        audioBlob: new Blob(["audio"], { type: "audio/webm" }),
        audioFilename: "reclamo.webm",
      });
    });

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers["Idempotency-Key"]).toMatch(
      MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN,
    );
  });

  it("reuses the exact body and header key after an ambiguous claim confirmation", async () => {
    apiFetchMock.mockRejectedValue(new Error("network outcome unknown"));
    const { result } = renderHook(() =>
      useChatLogic({
        tipoChat: "municipio",
        tenantSlug: "junin",
        skipAuth: true,
        socketEnabled: false,
        autoInitEnabled: false,
      }),
    );

    act(() => {
      result.current.setContexto((current) => ({
        ...current,
        estado_conversacion: "confirmando_reclamo",
      }));
    });
    await waitFor(() => {
      expect(result.current.contexto.estado_conversacion).toBe(
        "confirmando_reclamo",
      );
    });

    await act(async () => {
      await result.current.handleSend({
        text: "Confirmar",
        action: "confirmar_reclamo",
      });
    });
    await act(async () => {
      await result.current.handleSend({
        text: "Confirmar",
        action: "confirmar_reclamo",
      });
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    const firstOptions = apiFetchMock.mock.calls[0][1];
    const retryOptions = apiFetchMock.mock.calls[1][1];
    const claimKey = firstOptions.headers["Idempotency-Key"];
    expect(claimKey).toMatch(MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN);
    expect(firstOptions.body.idempotency_key).toBe(claimKey);
    expect(retryOptions.headers["Idempotency-Key"]).toBe(claimKey);
    expect(retryOptions.body.idempotency_key).toBe(claimKey);
  });

  it("does not attach municipal idempotency to PYME JSON turns", async () => {
    const { result } = renderHook(() =>
      useChatLogic({
        tipoChat: "pyme",
        tenantSlug: "ferreteria-demo",
        selectedRubro: "ferreteria",
        skipAuth: true,
        socketEnabled: false,
        autoInitEnabled: false,
      }),
    );

    await act(async () => {
      await result.current.handleSend("Hola");
    });

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.headers).toBeUndefined();
    expect(options.body).not.toHaveProperty("idempotency_key");
  });
});
