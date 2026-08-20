import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/utils/api";
import ChatPanel, { scrollIntoViewIfSupported } from "./ChatPanel";

const chatLogic = {
  messages: [],
  isTyping: false,
  handleSend: vi.fn(),
  activeTicketId: null,
  liveChatTicketId: null,
  liveChatSocketRoom: null,
  liveChatAccessToken: null,
  isLiveChatActive: false,
  setMessages: vi.fn(),
  setContexto: vi.fn(),
  setActiveTicketId: vi.fn(),
  contexto: {},
  uxContext: {},
  addSystemMessage: vi.fn(),
  initializeConversation: vi.fn(),
};

const provisionedSession = {
  ok: true,
  channel: "voice",
  model: "gpt-realtime",
  session: {
    id: "sess_provisioned_only",
    client_secret: { value: "ephemeral-secret" },
  },
};

vi.mock("@/hooks/useChatLogic", () => ({
  useChatLogic: () => chatLogic,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useBusinessHours", () => ({
  useBusinessHours: () => ({
    isLiveChatEnabled: false,
    horariosAtencion: "",
    availabilityLabel: "",
    timezone: "",
  }),
}));

vi.mock("./ChatHeader", () => ({ default: () => <div data-testid="chat-header" /> }));
vi.mock("./ChatInput", () => ({
  default: React.forwardRef(() => <div data-testid="chat-input" />),
}));
vi.mock("@/components/ui/ScrollToBottomButton", () => ({ default: () => null }));
vi.mock("./RealtimeAvatarStage", () => ({
  default: ({ sessionState }: { sessionState: string }) => (
    <div data-testid="realtime-session-state">{sessionState}</div>
  ),
}));

describe("ChatPanel realtime transport truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === "/api/public/realtime/session" ? provisionedSession : {},
    );
  });

  it("degrades auto-scroll safely when the rendered element has no scrollIntoView implementation", () => {
    const element = document.createElement("div");
    Object.defineProperty(element, "scrollIntoView", {
      configurable: true,
      value: undefined,
    });

    expect(scrollIntoViewIfSupported(element, { behavior: "auto", block: "end" })).toBe(false);
  });

  it("does not conceal errors thrown by a real scrollIntoView implementation", () => {
    const element = document.createElement("div");
    const scrollFailure = new Error("scroll implementation failed");
    Object.defineProperty(element, "scrollIntoView", {
      configurable: true,
      value: vi.fn(() => {
        throw scrollFailure;
      }),
    });

    expect(() => scrollIntoViewIfSupported(element, { behavior: "auto", block: "end" })).toThrow(scrollFailure);
  });

  it("does not announce a provisioned client secret as a live call", async () => {
    render(
      <ChatPanel
        tipoChat="pyme"
        tenantSlug="empresa-demo"
        supportChannels={{
          voice_call: {
            enabled: true,
            label: "Llamada IA",
            session_endpoint: "/api/public/realtime/session",
          },
        }}
        realtimeVoice={{
          enabled: true,
          contract_version: "realtime.voice_capabilities.v1",
          recommended_model: "gpt-realtime",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver acciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Llamada IA" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/public/realtime/session",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(await screen.findByTestId("realtime-session-state")).toHaveTextContent("ended");
    expect(
      screen.getAllByText("La llamada no se conectó. Podés seguir por chat.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Escuchando")).not.toBeInTheDocument();
  });

  it("announces live only after the transport connector returns duplex live audio", async () => {
    const close = vi.fn();
    const connectRealtimeVoiceTransport = vi.fn().mockResolvedValue({
      connectionState: "connected",
      getSenders: () => [{ track: { kind: "audio", readyState: "live" } }],
      getReceivers: () => [{ track: { kind: "audio", readyState: "live" } }],
      close,
    });

    render(
      <ChatPanel
        tipoChat="pyme"
        tenantSlug="empresa-demo"
        connectRealtimeVoiceTransport={connectRealtimeVoiceTransport}
        supportChannels={{
          voice_call: {
            enabled: true,
            label: "Llamada IA",
            session_endpoint: "/api/public/realtime/session",
          },
        }}
        realtimeVoice={{
          enabled: true,
          contract_version: "realtime.voice_capabilities.v1",
          recommended_model: "gpt-realtime",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver acciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Llamada IA" }));

    await waitFor(() => {
      expect(connectRealtimeVoiceTransport).toHaveBeenCalledWith(provisionedSession);
      expect(screen.getByTestId("realtime-session-state")).toHaveTextContent("live");
    });
    expect(screen.queryByText("La llamada no se conectó. Podés seguir por chat.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
