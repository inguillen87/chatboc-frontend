import type { OrganizationWorkspace } from "@/utils/organizationWorkspace";
import type { FormEvent, ReactNode } from "react";
import {
  Building2,
  Clock3,
  MapPin,
  Palette,
  Radio,
  Save,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InstitutionProfileSection =
  | "general"
  | "identity"
  | "location"
  | "hours"
  | "channels"
  | "plan-security";

export const normalizeInstitutionProfileSection = (
  value?: string | null,
): InstitutionProfileSection => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "identity" || normalized === "identidad") return "identity";
  if (normalized === "location" || normalized === "ubicacion") return "location";
  if (normalized === "hours" || normalized === "horarios") return "hours";
  if (normalized === "channels" || normalized === "canales") return "channels";
  if (["plan", "security", "seguridad", "plan-security"].includes(normalized)) {
    return "plan-security";
  }
  return "general";
};

const sections: Array<{
  id: InstitutionProfileSection;
  label: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    id: "general",
    label: "General",
    description: "Nombre, contacto y sitio institucional",
    icon: Building2,
  },
  {
    id: "identity",
    label: "Identidad visual",
    description: "Imagen autorizada y presencia de marca",
    icon: Palette,
  },
  {
    id: "location",
    label: "Ubicación",
    description: "Domicilio y coordenadas operativas",
    icon: MapPin,
  },
  {
    id: "hours",
    label: "Horarios",
    description: "Disponibilidad de atención",
    icon: Clock3,
  },
  {
    id: "channels",
    label: "Canales",
    description: "WhatsApp, web e integraciones",
    icon: Radio,
  },
  {
    id: "plan-security",
    label: "Plan y seguridad",
    description: "Consumo, permisos y gobierno",
    icon: ShieldCheck,
  },
];

interface InstitutionProfileWorkspaceProps {
  workspace?: OrganizationWorkspace | null;
  activeSection: InstitutionProfileSection;
  children: ReactNode;
  institutionName: string;
  isMunicipal: boolean;
  isAdministrator: boolean;
  loading?: boolean;
  plan?: string;
  onCancel: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSectionChange: (section: InstitutionProfileSection) => void;
}

export default function InstitutionProfileWorkspace({
  activeSection,
  workspace,
  children,
  institutionName,
  isMunicipal,
  isAdministrator,
  loading = false,
  plan,
  onCancel,
  onSave,
  onSectionChange,
}: InstitutionProfileWorkspaceProps) {
  const presentedSections = sections.map((section) => {
    const published = workspace?.sections.find((item) => item.id === section.id);
    return published ? {...section, label: published.label, description: published.description} : section;
  });
  const active = presentedSections.find((section) => section.id === activeSection) ?? presentedSections[0];

  return (
    <form
      onSubmit={onSave}
      className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm"
      data-testid="institution-profile-workspace"
      data-layout="viewport"
    >
      <header className="shrink-0 border-b border-border/70 bg-muted/20 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {workspace?.heading || "Perfil institucional"}
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {institutionName || (isMunicipal ? "Gobierno local" : "Organización")}
              </h2>
              <Badge variant="outline" className="rounded-md">
                {workspace?.organization_label || (isMunicipal ? "Gobierno" : "Organización")}
              </Badge>
              {plan ? (
                <Badge variant="secondary" className="rounded-md capitalize">
                  {plan}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 hidden max-w-3xl text-sm leading-5 text-muted-foreground sm:block">
              {workspace?.description || "Configuración administrativa separada de la operación diaria. Cada sección guarda el mismo registro institucional."}
            </p>
          </div>
          <Badge variant={isAdministrator ? "default" : "outline"} className={cn("w-fit rounded-md", !isAdministrator && "!bg-muted !text-foreground border-border")}>
            {isAdministrator ? "Administración habilitada" : "Solo lectura operativa"}
          </Badge>
        </div>
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="min-h-0 min-w-0 border-b border-border/70 bg-muted/10 p-2 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3">
          <nav
            aria-label="Secciones del perfil institucional"
            className="flex min-w-0 max-w-full snap-x gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0"
          >
            {presentedSections.map((section) => {
              const Icon = section.icon;
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionChange(section.id)}
                  aria-current={selected ? "page" : undefined}
                  data-testid={`institution-profile-section-${section.id}`}
                  className={cn(
                    "flex min-w-[12rem] snap-start items-start gap-3 rounded-xl border px-3 py-3 text-left motion-safe:transition lg:w-full lg:min-w-0",
                    selected
                      ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
                      : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background",
                      selected ? "border-primary/30 text-primary" : "border-border/70",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{section.label}</span>
                    <span className="mt-0.5 hidden text-xs leading-4 text-muted-foreground lg:block">
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-background/35">
          <div className="shrink-0 border-b border-border/60 px-4 py-3 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Configuración</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{active.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
            {workspace && (activeSection === "channels" || activeSection === "general") ? (
              <p className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm leading-6 text-foreground"
                data-testid="organization-profile-guidance">
                {activeSection === "channels" ? workspace.continuity.note : workspace.domain_note}
              </p>
            ) : null}
          </div>
          <fieldset
            disabled={!isAdministrator || loading}
            aria-disabled={!isAdministrator || loading}
            className="m-0 min-h-0 min-w-0 flex-1 overflow-y-auto border-0 p-0 disabled:cursor-not-allowed disabled:opacity-70"
            data-testid="institution-profile-scroll"
          >
            <div className="px-4 py-5 sm:px-6" data-testid={`institution-profile-panel-${activeSection}`}>
              {children}
            </div>
          </fieldset>
        </section>
      </div>

      <footer className="z-10 flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs leading-5 text-muted-foreground">
          Los cambios quedan auditados por la sesión y la organización activa.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar cambios
          </Button>
          <Button type="submit" disabled={loading || !isAdministrator}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </footer>
    </form>
  );
}
