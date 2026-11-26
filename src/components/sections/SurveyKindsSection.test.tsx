import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SurveyKindsSection from "./SurveyKindsSection";

describe("SurveyKindsSection", () => {
  it("names the four kinds of survey the editor offers", () => {
    render(<SurveyKindsSection />);

    const tabs = within(screen.getByRole("tablist", { name: "Tipos de encuesta" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining("Votación en vivo"),
      expect.stringContaining("Consulta sobre una propuesta"),
      expect.stringContaining("Sondeo rápido"),
      expect.stringContaining("Planificación"),
    ]);
  });

  it("lets the visitor answer a vote once and labels the results as an example", () => {
    render(<SurveyKindsSection />);

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).queryByText(/datos de ejemplo/)).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Luminarias nuevas" }));

    expect(within(panel).getByText("Tu voto quedó registrado.")).toBeVisible();
    expect(within(panel).getByText(/Simulación con datos de ejemplo/)).toBeVisible();
    expect(within(panel).getByRole("button", { name: /Luminarias nuevas/ })).toBeDisabled();
  });

  it("says what the organization reads afterwards", () => {
    render(<SurveyKindsSection />);

    for (const reading of ["Resultados en vivo", "Mapa de calor", "Quién responde", "Por dónde llegan"]) {
      expect(screen.getByText(reading)).toBeVisible();
    }
  });

  it("accepts several answers in a planning survey before sending", () => {
    render(<SurveyKindsSection />);
    fireEvent.click(screen.getByRole("tab", { name: /Planificación/ }));

    const panel = screen.getByRole("tabpanel");
    const send = within(panel).getByRole("button", { name: "Enviar respuesta" });
    expect(send).toBeDisabled();

    fireEvent.click(within(panel).getByRole("button", { name: "Martes" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Sábado" }));
    expect(within(panel).getByRole("button", { name: "Martes" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("button", { name: "Jueves" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(send);
    expect(within(panel).getByText(/Anotado/)).toBeVisible();
  });
});
