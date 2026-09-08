import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChatHeader from "./ChatHeader";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("./AccessibilityToggle", () => ({
  default: () => <button type="button">Accesibilidad</button>,
}));

vi.mock("./ChatbocLogoAnimated", () => ({
  default: () => <span aria-hidden="true">logo</span>,
}));

describe("ChatHeader", () => {
  it("uses professional Chatboc defaults and exposes a verified live channel", () => {
    render(
      <ChatHeader
        onClose={vi.fn()}
        supportChannels={{
          live_chat: {
            socket_enabled: true,
            available: true,
            label: "Atención en línea",
          },
        }}
      />,
    );

    expect(screen.getByText("Chatboc")).toBeVisible();
    expect(screen.getByText("Asistente digital")).toBeVisible();
    expect(screen.getByText("Atención en línea")).toBeVisible();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar chat" })).toBeVisible();
  });

  it("does not claim a live channel when the realtime socket is disabled", () => {
    render(
      <ChatHeader
        onClose={vi.fn()}
        supportChannels={{
          live_chat: {
            socket_enabled: false,
            available: true,
            label: "Atención en línea",
          },
        }}
      />,
    );

    expect(screen.queryByText("Atención en línea")).not.toBeInTheDocument();
  });

  it("announces response activity without an always-running animation requirement", () => {
    render(<ChatHeader onClose={vi.fn()} isTyping />);

    expect(screen.getByText("Preparando respuesta")).toBeVisible();
    expect(screen.getByText("Preparando respuesta").parentElement?.innerHTML).toContain(
      "motion-safe:animate-ping",
    );
  });
});
