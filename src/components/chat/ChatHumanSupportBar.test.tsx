import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ChatHumanSupportBar from "./ChatHumanSupportBar";

describe("ChatHumanSupportBar", () => {
  it("keeps the human handoff visible with a truthful availability state", () => {
    const onLiveChat = vi.fn();

    render(
      <ChatHumanSupportBar
        liveChatLabel="Hablar con un representante"
        liveChatStatus="Asesores en línea"
        liveChatAvailable
        onLiveChat={onLiveChat}
      />,
    );

    expect(screen.getByRole("region", { name: "Opciones de atención humana" })).toBeVisible();
    expect(screen.getByText("Ayuda de una persona")).toBeVisible();
    expect(screen.getByText("Asesores en línea")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Hablar con un representante" }));
    expect(onLiveChat).toHaveBeenCalledTimes(1);
  });

  it("offers the configured WhatsApp path without claiming live availability", () => {
    const onWhatsApp = vi.fn();

    render(
      <ChatHumanSupportBar whatsappLabel="Continuar por WhatsApp" onWhatsApp={onWhatsApp} />,
    );

    expect(screen.getByText("Continuidad por WhatsApp")).toBeVisible();
    expect(screen.queryByText("Equipo disponible ahora")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar por WhatsApp" }));
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the backend exposes no human channel", () => {
    const { container } = render(<ChatHumanSupportBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps an offline message action in the fixed support area and preserves its callback", () => {
    const onLiveChat = vi.fn();
    render(<ChatHumanSupportBar onLiveChat={onLiveChat} onWhatsApp={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Opciones de atención humana" })).toHaveClass("shrink-0");
    expect(screen.getByText("Podés dejar un mensaje")).toBeVisible();
    const primary = screen.getByRole("button", { name: "Dejar mensaje" });
    expect(primary).toHaveClass("bg-primary", "min-h-11");
    expect(screen.getByRole("button", { name: "WhatsApp" })).toHaveClass("bg-card");
    fireEvent.click(primary);
    expect(onLiveChat).toHaveBeenCalledOnce();
  });

  it("gives a sole configured WhatsApp action primary emphasis without claiming realtime help", () => {
    render(<ChatHumanSupportBar onWhatsApp={vi.fn()} whatsappLabel="Escribir al equipo" />);
    expect(screen.getByRole("button", { name: "Escribir al equipo" })).toHaveClass("bg-primary");
    expect(screen.queryByText("Equipo disponible ahora")).not.toBeInTheDocument();
  });
});
