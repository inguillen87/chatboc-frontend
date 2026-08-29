import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InstitutionProfileWorkspace, {
  normalizeInstitutionProfileSection,
} from "@/components/profile/InstitutionProfileWorkspace";

describe("InstitutionProfileWorkspace", () => {
  it("normalizes legacy and localized deep links", () => {
    expect(normalizeInstitutionProfileSection("plan")).toBe("plan-security");
    expect(normalizeInstitutionProfileSection("canales")).toBe("channels");
    expect(normalizeInstitutionProfileSection("ubicacion")).toBe("location");
    expect(normalizeInstitutionProfileSection("unknown")).toBe("general");
  });

  it("renders one compact section navigator and delegates section changes", () => {
    const onSectionChange = vi.fn();
    render(
      <InstitutionProfileWorkspace
        activeSection="location"
        institutionName="Municipalidad de Junín"
        isMunicipal
        isAdministrator
        plan="full"
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onSectionChange={onSectionChange}
      >
        <p>Contenido de ubicación</p>
      </InstitutionProfileWorkspace>,
    );

    expect(screen.getByRole("navigation", { name: "Secciones del perfil institucional" })).toBeInTheDocument();
    expect(screen.getByTestId("institution-profile-workspace")).toHaveAttribute("data-layout", "viewport");
    expect(screen.getByTestId("institution-profile-workspace")).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(screen.getByTestId("institution-profile-scroll")).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(screen.getByTestId("institution-profile-section-location")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Contenido de ubicación")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("institution-profile-section-channels"));
    expect(onSectionChange).toHaveBeenCalledWith("channels");
  });

  it("keeps save disabled for non-administrative profiles", () => {
    render(
      <InstitutionProfileWorkspace
        activeSection="general"
        institutionName="Municipalidad de Junín"
        isMunicipal
        isAdministrator={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onSectionChange={vi.fn()}
      >
        <label>
          Nombre institucional
          <input defaultValue="Municipalidad de Junín" />
        </label>
      </InstitutionProfileWorkspace>,
    );

    expect(screen.getByText("Solo lectura operativa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Nombre institucional" })).toBeDisabled();
  });
});
