import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceJourneyFlow from "./ServiceJourneyFlow";

describe("ServiceJourneyFlow", () => {
  afterEach(() => {
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
