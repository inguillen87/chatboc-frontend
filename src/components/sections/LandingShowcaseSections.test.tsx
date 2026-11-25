import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WhiteLabelShowcaseSection from "./WhiteLabelShowcaseSection";
import ModulesBentoSection from "./ModulesBentoSection";

describe("WhiteLabelShowcaseSection", () => {
  it("switches invented white-label identities with keyboard navigation and updates palette, typography, bubbles and mascot", () => {
    render(<WhiteLabelShowcaseSection />);

    const region = screen.getByRole("region", {
      name: "Un mismo motor, la identidad exacta de cada organización",
    });
    const tabs = within(region).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent("Municipio Demo");
    expect(tabs[1]).toHaveTextContent("Clínica Demo");
    expect(tabs[2]).toHaveTextContent("Comercio Demo");
    expect(tabs[3]).toHaveTextContent("Instituto Demo");

    const preview = within(region).getByTestId("whitelabel-widget-preview");
    expect(preview).toHaveAttribute("data-brand-id", "municipio-demo");
    expect(preview).toHaveAttribute("data-bubble-style", "globa");
    expect(within(preview).getByRole("img", { name: "Mascota de Municipio Demo" })).toBeInTheDocument();

    // Keyboard arrow switches to Clínica Demo
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    const updatedPreview = within(region).getByTestId("whitelabel-widget-preview");
    expect(updatedPreview).toHaveAttribute("data-brand-id", "clinica-demo");
    expect(updatedPreview).toHaveAttribute("data-bubble-style", "capsule");
    expect(within(updatedPreview).getByRole("img", { name: "Mascota de Clínica Demo" })).toBeInTheDocument();

    // Switch to Comercio Demo via click
    fireEvent.click(tabs[2]);
    const commercePreview = within(region).getByTestId("whitelabel-widget-preview");
    expect(commercePreview).toHaveAttribute("data-brand-id", "comercio-demo");
    expect(commercePreview).toHaveAttribute("data-bubble-style", "editorial");

    // Interactive mascot mood buttons update BrandBotAvatar state
    const thinkingBtn = within(region).getByRole("button", { name: "Pensando" });
    fireEvent.click(thinkingBtn);
    expect(thinkingBtn).toHaveAttribute("aria-pressed", "true");
    expect(within(commercePreview).getByRole("img", { name: "Mascota de Comercio Demo" })).toHaveAttribute(
      "data-state",
      "thinking",
    );

    // Must never mention real client names
    expect(region.textContent).not.toMatch(/jun[ií]n|tierra del fuego|\btdf\b/i);
  });
});

describe("ModulesBentoSection", () => {
  it("presents the 7 core platform modules with accessible headings", () => {
    render(<ModulesBentoSection />);

    const region = screen.getByRole("region", {
      name: "Todo lo que necesita tu operación, conectado desde el primer día",
    });

    const expectedModules = [
      "Widget web marca blanca",
      "WhatsApp operativo",
      "Voz y audio accesible",
      "Reclamos con seguimiento",
      "Encuestas y participación",
      "CRM, catálogo y portal",
      "Estadísticas y tablero operativo",
    ];

    for (const title of expectedModules) {
      expect(within(region).getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
  });
});
