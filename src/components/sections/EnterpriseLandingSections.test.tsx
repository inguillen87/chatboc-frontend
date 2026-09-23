import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import CtaSection from "./CtaSection";
import PricingSection from "./PricingSection";

const renderWithRouter = (element: React.ReactElement) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {element}
    </MemoryRouter>,
  );

describe("enterprise landing sections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the institutional plan action explicit and opens it safely", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithRouter(<PricingSection />);

    const section = screen.getByRole("region", { name: "Planes claros para implementar y escalar" });
    expect(within(section).getAllByRole("article")).toHaveLength(3);

    fireEvent.click(within(section).getByRole("button", { name: "Coordinar reunión" }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("wa.me/5492613168608"),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("closes the page with three clear next actions", () => {
    renderWithRouter(<CtaSection />);

    const section = screen.getByRole("region", {
      name: "Convertí atención, ventas y soporte en una operación conectada",
    });
    expect(within(section).getByRole("button", { name: "Ver demo" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Hablar con un asesor" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Ya tengo cuenta, iniciar sesión" })).toBeInTheDocument();
  });
});
