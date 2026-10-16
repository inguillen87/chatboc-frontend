import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import SolutionSection from "./SolutionSection";

describe("SolutionSection", () => {
  it("shows three sector solutions and one clear action", () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SolutionSection />
      </MemoryRouter>,
    );

    const section = screen.getByRole("region", { name: "Una plataforma, tres formas de operar" });

    expect(within(section).getByRole("heading", { level: 3, name: "Gobierno" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { level: 3, name: "Empresa" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { level: 3, name: "Educación" })).toBeInTheDocument();
    expect(within(section).getAllByRole("article")).toHaveLength(3);

    const actions = within(section).getAllByRole("button");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveAccessibleName("Solicitar demostración");

    fireEvent.click(actions[0]);
    expect(consoleLogSpy).toHaveBeenCalledWith("Mocked navigate to: /contacto");
    consoleLogSpy.mockRestore();
  });
});
