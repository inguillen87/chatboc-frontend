import * as React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCrmWorkspaceState, useDebouncedValue } from "./useCrmWorkspaceState";

const Harness = () => {
  const location = useLocation();
  const { activeView, selectedContactId, setActiveView, setSelectedContactId } = useCrmWorkspaceState();
  return (
    <div>
      <output data-testid="view">{activeView}</output>
      <output data-testid="contact">{selectedContactId || "none"}</output>
      <output data-testid="search">{location.search}</output>
      <button type="button" onClick={() => setActiveView("segmentos")}>Abrir segmentos</button>
      <button type="button" onClick={() => setSelectedContactId("contact:77")}>Elegir 77</button>
    </div>
  );
};

describe("useCrmWorkspaceState", () => {
  afterEach(() => vi.useRealTimers());

  it("restores the workspace and selected person from a deep link", () => {
    render(
      <MemoryRouter initialEntries={["/perfil?tab=usuarios&view=actividad&contact=contact%3A42"]}>
        <Harness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("view")).toHaveTextContent("actividad");
    expect(screen.getByTestId("contact")).toHaveTextContent("contact:42");
  });

  it("updates local CRM state without dropping the parent profile tab", () => {
    render(
      <MemoryRouter initialEntries={["/perfil?tab=usuarios"]}>
        <Harness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir segmentos" }));
    fireEvent.click(screen.getByRole("button", { name: "Elegir 77" }));

    expect(screen.getByTestId("view")).toHaveTextContent("segmentos");
    expect(screen.getByTestId("contact")).toHaveTextContent("contact:77");
    expect(screen.getByTestId("search").textContent).toContain("tab=usuarios");
    expect(screen.getByTestId("search").textContent).toContain("view=segmentos");
    expect(screen.getByTestId("search").textContent).toContain("contact=contact%3A77");
  });

  it("debounces server-facing search changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 350),
      { initialProps: { value: "ma" } },
    );

    rerender({ value: "mauricio" });
    expect(result.current).toBe("ma");

    act(() => vi.advanceTimersByTime(349));
    expect(result.current).toBe("ma");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("mauricio");
  });
});
