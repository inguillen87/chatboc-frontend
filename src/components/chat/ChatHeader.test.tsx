import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("keeps secondary actions available in a labeled menu without crowding the assistant name", async () => {
    const onProfile = vi.fn();
    const onCart = vi.fn();
    const onToggleSound = vi.fn();
    render(<ChatHeader onClose={vi.fn()} onProfile={onProfile} onCart={onCart} cartCount={3} onToggleSound={onToggleSound} title="Asistente de atención ciudadana" />);

    expect(screen.getByTitle("Asistente de atención ciudadana")).toHaveClass("break-words");
    expect(screen.queryByRole("button", { name: "Mi perfil" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Opciones del chat" }), { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: /Ver carrito/ })).toBeVisible();
    expect(screen.getByLabelText("3 productos")).toBeVisible();
    fireEvent.click(screen.getByRole("menuitem", { name: "Mi perfil" }));
    expect(onProfile).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("button", { name: "Opciones del chat" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: /Ver carrito/ }));
    expect(onCart).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("button", { name: "Opciones del chat" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Silenciar sonido" }));
    expect(onToggleSound).toHaveBeenCalledOnce();
  });

  it("supports keyboard dismissal and retains compact-mode actions", async () => {
    render(<ChatHeader onClose={vi.fn()} compactActions onCart={vi.fn()} onToggleSound={vi.fn()} muted />);
    const trigger = screen.getByRole("button", { name: "Opciones del chat" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: "Ver carrito" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Activar sonido" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("button", { name: "Accesibilidad" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar chat" })).toBeVisible();
  });

  it("does not invent actions or override a hidden profile", () => {
    render(<ChatHeader onClose={vi.fn()} onProfile={vi.fn()} showProfile={false} />);
    expect(screen.queryByRole("button", { name: "Opciones del chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar chat" })).toBeVisible();
  });
});
