import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("react-router-dom");
const state = vi.hoisted(() => ({ experience: null as Record<string, unknown> | null, loading: false, reload: vi.fn() }));
vi.mock("@/hooks/useLandingExperience", () => ({ useLandingExperience: () => state }));

import ContactPage, { publicContactHref } from "./ContactPage";

const contract = {
  contact: {
    title: "Coordinemos una demostración",
    description: "Elegí un canal para conversar con el equipo.",
    back_label: "Volver al inicio",
    refresh_label: "Actualizar información",
    methods: [
      { id: "email", label: "Escribir al equipo", description: "Abrí un correo.", href: "mailto:info@example.com?subject=Demo%20Chatboc" },
      { id: "whatsapp", label: "Consultar por WhatsApp", href: "https://wa.me/12345678" },
    ],
  },
};

const Page = () => <MemoryRouter initialEntries={["/contacto"]}><Routes><Route path="/contacto" element={<ContactPage />} /></Routes></MemoryRouter>;

describe("public contact route", () => {
  beforeEach(() => { state.experience = contract; state.loading = false; state.reload.mockReset(); });

  it("opens a distinct contact page with backend methods and no simulated submission", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: contract.contact.title })).toBeVisible();
    expect(screen.getByRole("link", { name: /Escribir al equipo/ })).toHaveAttribute("href", contract.contact.methods[0].href);
    expect(screen.getByRole("link", { name: "Consultar por WhatsApp" })).toHaveAttribute("href", contract.contact.methods[1].href);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/enviada|registrada|Solicitud recibida/i)).toBeNull();
    expect(state.reload).not.toHaveBeenCalled();
  });

  it("does not invent brand contact methods for a missing or white-label contract", () => {
    state.experience = { contact: null };
    render(<Page />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByRole("link", { name: /WhatsApp|correo|equipo/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });

  it("retains the refresh control and keyboard focus throughout a reload", () => {
    const { rerender } = render(<Page />);
    const button = screen.getByRole("button", { name: "Actualizar información" });
    button.focus(); fireEvent.click(button);
    expect(state.reload).toHaveBeenCalledTimes(1);
    act(() => { state.loading = true; }); rerender(<Page />);
    expect(screen.getByRole("button", { name: "Actualizar información" })).toBe(button);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button); expect(state.reload).toHaveBeenCalledTimes(1);
    act(() => { state.loading = false; }); rerender(<Page />);
    expect(button).toHaveFocus();
  });

  it("shows loading without announcing an error before the request has finished", () => {
    state.experience = null; state.loading = true;
    render(<Page />);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["javascript:alert(1)", "//evil.example", "http://example.com", "https://user:pass@example.com", "mailto:person@example.com?bcc=other@example.com", "mailto:person@example.com?subject=demo?&bcc=other@example.com", "mailto:person@example.com?subject=demo%0aBcc:other@example.com"])("rejects an unsafe contact destination: %s", (href) => {
    expect(publicContactHref(href)).toBeNull();
  });
});
