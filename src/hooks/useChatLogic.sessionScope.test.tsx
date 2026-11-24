import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/utils/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/api")>()),
  apiFetch: apiFetchMock,
}));
vi.mock("./useUser", () => ({ useUser: () => ({ user: null }) }));
vi.mock("@/utils/widgetTelemetry", () => ({ trackWidgetEvent: vi.fn() }));

import { useChatLogic } from "./useChatLogic";
import { ApiError } from "@/utils/api";

const scopeConflict = () => new ApiError("Conflict", 409, {
  reason_code: "municipio_chat_idempotency_scope_conflict",
  message: "La sesion indicada no pertenece al alcance validado. No se realizo ninguna accion.",
});
const turns = () => apiFetchMock.mock.calls.filter(([path]) => !String(path).includes("/institutional-assistant"));
const render = () => renderHook(() => useChatLogic({
  tipoChat: "municipio", tenantSlug: "qa-scope", skipAuth: true, socketEnabled: false, autoInitEnabled: false,
}));

describe("useChatLogic stored session of another scope", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("chat_session_id", "stale-foreign-session");
  });

  it("resends the same turn once in a fresh session instead of showing the conflict", async () => {
    let posts = 0;
    const sentSessions: string[] = [];
    apiFetchMock.mockImplementation(async (path: string, options: { body: { session_id: string } }) => {
      if (path.includes("/institutional-assistant")) throw new ApiError("Not available", 404, { reason_code: "knowledge_not_available" });
      posts += 1;
      sentSessions.push(options.body.session_id);
      if (posts === 1) throw scopeConflict();
      return { respuesta_usuario: "Respuesta en la sesión nueva", botones: [] };
    });
    const { result } = render();
    await act(async () => { await result.current.handleSend({ text: "Consulta sintética", action: "info_tramite" }); });

    const [first, second] = turns();
    expect(turns()).toHaveLength(2);
    const fresh = window.localStorage.getItem("chat_session_id");
    expect(sentSessions).toEqual(["stale-foreign-session", fresh]);
    expect(fresh).not.toBe("stale-foreign-session");
    // Same logical turn: the key is kept (the backend never reserved it).
    expect(second[1].headers["Idempotency-Key"]).toBe(first[1].headers["Idempotency-Key"]);
    expect(result.current.messages.some((message) => message.isError)).toBe(false);
    expect(result.current.messages.at(-1)?.text).toBe("Respuesta en la sesión nueva");
  });

  it("shows the error after a second conflict and does not loop", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.includes("/institutional-assistant")) throw new ApiError("Not available", 404, { reason_code: "knowledge_not_available" });
      throw scopeConflict();
    });
    const { result } = render();
    await act(async () => { await result.current.handleSend({ text: "Consulta sintética", action: "info_tramite" }); });
    expect(turns()).toHaveLength(2);
    expect(result.current.messages.at(-1)?.isError).toBe(true);
  });

  it("does not resend other conflicts", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.includes("/institutional-assistant")) throw new ApiError("Not available", 404, { reason_code: "knowledge_not_available" });
      throw new ApiError("Conflict", 409, { reason_code: "municipio_chat_idempotency_conflict" });
    });
    const { result } = render();
    await act(async () => { await result.current.handleSend({ text: "Consulta sintética", action: "info_tramite" }); });
    expect(turns()).toHaveLength(1);
  });
});
