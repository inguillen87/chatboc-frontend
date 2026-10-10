import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InstitutionProfileWorkspace, {
  normalizeInstitutionProfileSection,
} from "@/components/profile/InstitutionProfileWorkspace";

describe("InstitutionProfileWorkspace", () => {
  it('does not invent a local-government scope when the organization has no name', () => {
    render(<InstitutionProfileWorkspace activeSection="general" institutionName="" isMunicipal
      organizationType="municipio" isAdministrator={false} onCancel={vi.fn()} onSave={vi.fn()} onSectionChange={vi.fn()}>Consulta</InstitutionProfileWorkspace>);
    expect(screen.getByRole('heading', { name: 'Organización' })).toBeVisible();
    expect(screen.queryByText('Gobierno local')).not.toBeInTheDocument();
  });
  it.each([['municipio', 'Gobierno'], ['colegio', 'Educación'], ['pyme', 'Empresa'], ['unknown', 'Organización']])
    ('renders the descriptive %s badge without changing editing authority', (type, label) => {
      render(<InstitutionProfileWorkspace activeSection="general" institutionName="Organización sintética"
        isMunicipal={type === 'municipio'} organizationType={type}
        organizationTypePresentation={{ organization_type_label_contract: 'organization.type_label.v1', organization_type_label: label === 'Organización' ? null : label }}
        isAdministrator={false} onCancel={vi.fn()} onSave={vi.fn()} onSectionChange={vi.fn()}><input aria-label="Dato institucional" /></InstitutionProfileWorkspace>);
      expect(screen.getByText(label, { exact: true })).toBeVisible();
      expect(screen.getByRole('textbox', { name: 'Dato institucional' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });
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
    const onSectionChange = vi.fn();
    render(
      <InstitutionProfileWorkspace
        activeSection="general"
        institutionName="Municipalidad de Junín"
        isMunicipal
        isAdministrator={false}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        onSectionChange={onSectionChange}
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
    const sectionSelector = screen.getByRole("combobox", { name: "Sección del perfil institucional" });
    expect(sectionSelector).toBeEnabled();
    fireEvent.change(sectionSelector, { target: { value: "plan-security" } });
    expect(onSectionChange).toHaveBeenCalledWith("plan-security");
  });

  it("offers all sections through a labeled selector without submitting the record", () => {
    const onSectionChange = vi.fn();
    const onSave = vi.fn();
    render(
      <InstitutionProfileWorkspace
        activeSection="hours"
        institutionName="Organización de prueba"
        isMunicipal
        isAdministrator
        onCancel={vi.fn()}
        onSave={onSave}
        onSectionChange={onSectionChange}
      >
        <input aria-label="Dato de la sección" />
      </InstitutionProfileWorkspace>,
    );

    const selector = screen.getByRole("combobox", { name: "Sección del perfil institucional" });
    expect(selector).toHaveValue("hours");
    expect(screen.getAllByRole("option").map((option) => (option as HTMLOptionElement).value))
      .toEqual(["general", "identity", "location", "hours", "channels", "plan-security"]);
    expect(screen.getByRole("group", { name: "Horarios" })).toContainElement(screen.getByRole("textbox"));

    fireEvent.change(selector, { target: { value: "location" } });
    expect(onSectionChange).toHaveBeenCalledOnce();
    expect(onSectionChange).toHaveBeenCalledWith("location");
    expect(onSave).not.toHaveBeenCalled();
  });
});
