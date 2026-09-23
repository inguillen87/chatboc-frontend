import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceJourneyFlow from "./ServiceJourneyFlow";
import SaaSOperatingSystemSection, { JourneyFlowErrorBoundary } from "./SaaSOperatingSystemSection";

describe("ServiceJourneyFlow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("presents one connected flow and switches between government and business", async () => {
    render(<ServiceJourneyFlow />);

    const journey = screen.getByRole("region", { name: "Recorrido conectado" });
    const government = within(journey).getByRole("button", { name: "Gobierno" });
    const business = within(journey).getByRole("button", { name: "Empresa" });

    expect(government).toHaveAttribute("aria-pressed", "true");
    expect(within(journey).getAllByText("Reclamos, trámites y participación").length).toBeGreaterThan(0);

    fireEvent.click(business);
    expect(business).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(within(journey).getAllByText("Consultas, catálogo y pedidos").length).toBeGreaterThan(0);
    });
  });

  it("keeps a usable ordered journey when interactive map APIs are unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);

    render(<ServiceJourneyFlow />);

    const compactJourney = screen.getByRole("list", { name: "Recorrido operativo para gobierno" });
    expect(compactJourney).not.toHaveClass("md:hidden");
    expect(within(compactJourney).getAllByRole("listitem")).toHaveLength(4);
  });
});

describe("SaaSOperatingSystemSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps an explicitly informational journey available while offline", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);

    render(<SaaSOperatingSystemSection />);

    const journey = screen.getByRole("region", { name: "Guía del recorrido sin conexión" });
    expect(within(journey).getByText("Modo informativo sin conexión")).toBeVisible();
    expect(within(journey).getAllByRole("listitem")).toHaveLength(4);
    expect(within(journey).getByText("WhatsApp, web, voz y formularios accesibles.")).toBeVisible();
    expect(within(journey).getByText("CRM y analítica")).toBeVisible();
    expect(within(journey).getByText(/según la configuración contratada/i)).toBeVisible();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/sin conexión detectada/i);
  });

  it("announces connectivity changes and restores the interactive journey", async () => {
    let isOnline = true;
    vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => isOnline);

    render(<SaaSOperatingSystemSection />);

    expect(await screen.findByRole("region", { name: "Recorrido conectado" })).toBeVisible();

    isOnline = false;
    act(() => window.dispatchEvent(new Event("offline")));

    expect(screen.getByRole("region", { name: "Guía del recorrido sin conexión" })).toBeVisible();
    expect(screen.getByText(/sin conexión detectada/i)).toHaveAttribute("aria-live", "polite");

    isOnline = true;
    act(() => window.dispatchEvent(new Event("online")));

    expect(await screen.findByRole("region", { name: "Recorrido conectado" })).toBeVisible();
    expect(screen.getByText(/conexión disponible/i)).toHaveAttribute("aria-live", "polite");
  });

  it("contains a rejected lazy import and shows the static guide", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const RejectedJourney = React.lazy(() => Promise.reject(new Error("chunk unavailable")));

    render(
      <JourneyFlowErrorBoundary>
        <React.Suspense fallback={<div>Cargando</div>}>
          <RejectedJourney />
        </React.Suspense>
      </JourneyFlowErrorBoundary>,
    );

    const fallback = await screen.findByRole("region", { name: "Vista interactiva no disponible" });
    expect(within(fallback).getByText("Modo informativo")).toBeVisible();
    expect(within(fallback).getByText(/sin acciones ni datos en vivo/i)).toBeVisible();
    expect(screen.getByText(/la vista interactiva no pudo cargarse/i)).toHaveAttribute("role", "status");
    expect(consoleError).toHaveBeenCalledWith("SaaS journey flow failed to load", expect.any(Error));
  });
});
