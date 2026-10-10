import * as React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCrmWorkspaceState, useDebouncedValue } from "./useCrmWorkspaceState";

const Harness = () => {
  const location = useLocation();
  const {
    activeView,
    selectedContactId,
    peopleQueueView,
    peopleSort,
    peopleSearch,
    peopleMarketingOnly,
    peopleChannel,
    setActiveView,
    setSelectedContactId,
    setPeopleQueueView,
    setPeopleSort,
    setPeopleSearch,
    setPeopleMarketingOnly,
    setPeopleChannel,
  } = useCrmWorkspaceState();
  return (
    <div>
      <output data-testid="view">{activeView}</output>
      <output data-testid="contact">{selectedContactId || "none"}</output>
      <output data-testid="queue">{peopleQueueView}</output>
      <output data-testid="sort">{peopleSort}</output>
      <output data-testid="query">{peopleSearch}</output>
      <output data-testid="marketing">{String(peopleMarketingOnly)}</output>
      <output data-testid="channel">{peopleChannel}</output>
      <output data-testid="search">{location.search}</output>
      <button type="button" onClick={() => setActiveView("segmentos")}>Abrir segmentos</button>
      <button type="button" onClick={() => setSelectedContactId("contact:77")}>Elegir 77</button>
      <button type="button" onClick={() => setPeopleQueueView("review")}>Ver revisión</button>
      <button type="button" onClick={() => setPeopleSort("score-asc")}>Ordenar incompletos</button>
      <button type="button" onClick={() => setPeopleSearch("marcelo")}>Buscar Marcelo</button>
      <button type="button" onClick={() => setPeopleMarketingOnly(true)}>Filtrar opt-in</button>
      <button type="button" onClick={() => setPeopleChannel("whatsapp")}>Filtrar WhatsApp</button>
    </div>
  );
};

describe("useCrmWorkspaceState", () => {
  afterEach(() => vi.useRealTimers());

  it("restores the workspace and selected person from a deep link", () => {
    render(
      <MemoryRouter initialEntries={["/perfil?tab=usuarios&view=actividad&contact=contact%3A42&queue=whatsapp&sort=name&q=ana&marketing=true&channel=email"]}>
        <Harness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("view")).toHaveTextContent("actividad");
    expect(screen.getByTestId("contact")).toHaveTextContent("contact:42");
    expect(screen.getByTestId("queue")).toHaveTextContent("whatsapp");
    expect(screen.getByTestId("sort")).toHaveTextContent("name");
    expect(screen.getByTestId("query")).toHaveTextContent("ana");
    expect(screen.getByTestId("marketing")).toHaveTextContent("true");
    expect(screen.getByTestId("channel")).toHaveTextContent("email");
  });

  it("updates local CRM state without dropping the parent profile tab", () => {
    render(
      <MemoryRouter initialEntries={["/perfil?tab=usuarios"]}>
        <Harness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir segmentos" }));
    fireEvent.click(screen.getByRole("button", { name: "Elegir 77" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver revisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Ordenar incompletos" }));
    fireEvent.click(screen.getByRole("button", { name: "Buscar Marcelo" }));
    fireEvent.click(screen.getByRole("button", { name: "Filtrar opt-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Filtrar WhatsApp" }));

    expect(screen.getByTestId("view")).toHaveTextContent("segmentos");
    expect(screen.getByTestId("contact")).toHaveTextContent("none");
    expect(screen.getByTestId("search").textContent).toContain("tab=usuarios");
    expect(screen.getByTestId("search").textContent).toContain("view=segmentos");
    expect(screen.getByTestId("search").textContent).toContain("queue=review");
    expect(screen.getByTestId("search").textContent).toContain("sort=score-asc");
    expect(screen.getByTestId("search").textContent).toContain("q=marcelo");
    expect(screen.getByTestId("search").textContent).toContain("marketing=true");
    expect(screen.getByTestId("search").textContent).toContain("channel=whatsapp");
    expect(screen.getByTestId("search").textContent).not.toContain("contact=");
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
