import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProfileWorkspaceNavigation, {
  resolveProfileWorkspaceCapabilities,
} from "@/components/profile/ProfileWorkspaceNavigation";

describe("ProfileWorkspaceNavigation", () => {
  it("fails closed until the backend contract is ready and honors the survey feature flag", () => {
    const enabledModuleIds = new Set([
      "operations",
      "reports",
      "surveys",
      "people",
      "maps",
      "advanced_analytics",
    ]);
    const baseAccess = {
      enabledModuleIds,
      operationAccess: true,
      surveyAccess: true,
      territoryAccess: true,
      contactsAccess: true,
      reportsAccess: true,
      analyticsAccess: true,
      catalogAccess: true,
      teamAccess: true,
    };

    expect(
      resolveProfileWorkspaceCapabilities({
        ...baseAccess,
        status: "denied",
        featureSurveys: true,
      }),
    ).toEqual({
      operation: false,
      participation: false,
      territory: false,
      contacts: false,
      reports: false,
      analytics: false,
      catalog: false,
      team: false,
    });

    expect(
      resolveProfileWorkspaceCapabilities({
        ...baseAccess,
        status: "ready",
        featureSurveys: false,
      }).participation,
    ).toBe(false);
  });

  it("groups the CRM modules by operational domain and keeps the active context visible", () => {
    const onTabChange = vi.fn();
    const onOpenSurveys = vi.fn();

    render(
      <ProfileWorkspaceNavigation
        activeTab="tickets"
        capabilities={{
          operation: true,
          participation: true,
          territory: true,
          contacts: true,
          reports: true,
          analytics: true,
          catalog: true,
          team: true,
        }}
        isMunicipal
        onOpenSurveys={onOpenSurveys}
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Módulos del centro de control" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menú Operación" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: "Abrir menú Participación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menú Territorio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menú Ciudadanía" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menú Inteligencia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menú Administración" })).toBeInTheDocument();
    expect(screen.queryByText(/Plan Full|Plan Pro/)).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir menú Operación" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: /Tareas y gestión/i }));
    expect(onTabChange).toHaveBeenCalledWith("pedidos");

    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir menú Participación" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: /Encuestas y votaciones/i }));
    expect(onOpenSurveys).toHaveBeenCalledTimes(1);
  });

  it("hides staff-only modules while preserving the citizen-facing structure", () => {
    render(
      <ProfileWorkspaceNavigation
        activeTab="usuarios"
        capabilities={{
          operation: true,
          participation: false,
          territory: false,
          contacts: true,
          reports: true,
          analytics: false,
          catalog: true,
          team: false,
        }}
        isMunicipal
        onOpenSurveys={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Abrir menú Ciudadanía" })).toHaveAttribute("data-active", "true");

    expect(screen.queryByRole("button", { name: "Abrir menú Participación" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir menú Territorio" })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir menú Administración" }), { key: "Enter" });
    expect(screen.queryByRole("menuitem", { name: /Equipo y permisos/i })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir menú Inteligencia" }), { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: /Reportes ejecutivos/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Analítica avanzada/i })).not.toBeInTheDocument();
  });

  it("does not create a duplicate map target when territory is unavailable", () => {
    render(
      <ProfileWorkspaceNavigation
        activeTab="estadisticas"
        capabilities={{
          operation: true,
          participation: false,
          territory: false,
          contacts: false,
          reports: true,
          analytics: false,
          catalog: false,
          team: false,
        }}
        isMunicipal
        onOpenSurveys={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Abrir menú Territorio" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menú Inteligencia" })).toHaveAttribute("data-active", "true");
  });
});
