import React, { useMemo } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Package,
  Settings2,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ProfileWorkspaceTabValue =
  | "perfil"
  | "tickets"
  | "pedidos"
  | "estadisticas"
  | "analytics"
  | "catalogo"
  | "usuarios"
  | "empleados"
  | "mapas";

type WorkspaceModule = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tab?: ProfileWorkspaceTabValue;
  action?: () => void;
};

type WorkspaceModuleGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  modules: WorkspaceModule[];
};

export type ProfileWorkspaceCapabilities = {
  operation: boolean;
  participation: boolean;
  territory: boolean;
  contacts: boolean;
  reports: boolean;
  analytics: boolean;
  catalog: boolean;
  team: boolean;
};

export const resolveProfileWorkspaceCapabilities = ({
  status,
  enabledModuleIds,
  featureSurveys,
  operationAccess,
  surveyAccess,
  territoryAccess,
  contactsAccess,
  reportsAccess,
  analyticsAccess,
  catalogAccess,
  teamAccess,
}: {
  status: "idle" | "loading" | "ready" | "denied" | "error";
  enabledModuleIds: ReadonlySet<string>;
  featureSurveys: boolean;
  operationAccess: boolean;
  surveyAccess: boolean;
  territoryAccess: boolean;
  contactsAccess: boolean;
  reportsAccess: boolean;
  analyticsAccess: boolean;
  catalogAccess: boolean;
  teamAccess: boolean;
}): ProfileWorkspaceCapabilities => {
  const contractReady = status === "ready";
  const backendAllows = (moduleId: string) => contractReady && enabledModuleIds.has(moduleId);

  return {
    operation: operationAccess && backendAllows("operations"),
    participation: featureSurveys && surveyAccess && backendAllows("surveys"),
    territory: territoryAccess && backendAllows("maps"),
    contacts: contactsAccess && backendAllows("people"),
    reports: reportsAccess && backendAllows("reports"),
    analytics: analyticsAccess && backendAllows("advanced_analytics"),
    // Navigation v1 does not model catalog yet; it still requires a valid contract and role access.
    catalog: contractReady && catalogAccess,
    team: teamAccess && backendAllows("people"),
  };
};

interface ProfileWorkspaceNavigationProps {
  activeTab: ProfileWorkspaceTabValue;
  capabilities: ProfileWorkspaceCapabilities;
  isMunicipal: boolean;
  onOpenSurveys: () => void;
  onTabChange: (tab: ProfileWorkspaceTabValue) => void;
}

const ModuleMenuItem = ({
  activeTab,
  module,
  onTabChange,
}: {
  activeTab: ProfileWorkspaceTabValue;
  module: WorkspaceModule;
  onTabChange: (tab: ProfileWorkspaceTabValue) => void;
}) => {
  const Icon = module.icon;
  const isActive = Boolean(module.tab && module.tab === activeTab);

  return (
    <DropdownMenuItem
      className="group flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5"
      aria-current={isActive ? "page" : undefined}
      onSelect={() => {
        if (module.tab) onTabChange(module.tab);
        else module.action?.();
      }}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground",
          isActive && "border-primary/30 bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
          {module.label}
          {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
        </span>
        <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{module.description}</span>
      </span>
    </DropdownMenuItem>
  );
};

export default function ProfileWorkspaceNavigation({
  activeTab,
  capabilities,
  isMunicipal,
  onOpenSurveys,
  onTabChange,
}: ProfileWorkspaceNavigationProps) {
  const groups = useMemo<WorkspaceModuleGroup[]>(() => {
    const intelligenceModules: WorkspaceModule[] = [];

    if (capabilities.reports) {
      intelligenceModules.push({
        id: "reports",
        label: "Reportes ejecutivos",
        description: "Indicadores, tendencias y exportaciones.",
        icon: BarChart3,
        tab: "estadisticas",
      });
    }

    if (capabilities.analytics) {
      intelligenceModules.push({
        id: "analytics",
        label: "Analítica avanzada",
        description: "Segmentación, hallazgos y análisis asistido.",
        icon: Sparkles,
        tab: "analytics",
      });
    }

    const workspaceGroups: WorkspaceModuleGroup[] = [
      {
        id: "operations",
        label: "Operación",
        icon: ClipboardList,
        modules: capabilities.operation
          ? [
              {
                id: "tickets",
                label: isMunicipal ? "Reclamos" : "Tickets",
                description: "Cola, conversación y resolución guiada.",
                icon: ClipboardList,
                tab: "tickets",
              },
              {
                id: "management",
                label: isMunicipal ? "Tareas y gestión" : "Ventas y pedidos",
                description: isMunicipal
                  ? "Seguimiento de tareas, responsables y servicios."
                  : "Pedidos, estados y operación comercial.",
                icon: Settings2,
                tab: "pedidos",
              },
            ]
          : [],
      },
      {
        id: "participation",
        label: "Participación",
        icon: Vote,
        modules: capabilities.participation
          ? [
              {
                id: "surveys",
                label: "Encuestas y votaciones",
                description: "Crear, publicar y revisar participación.",
                icon: Vote,
                action: onOpenSurveys,
              },
            ]
          : [],
      },
      {
        id: "territory",
        label: "Territorio",
        icon: MapPinned,
        modules: capabilities.territory
          ? [
              {
                id: "maps",
                label: "Mapa operativo",
                description: "Casos georreferenciados, zonas y prioridades.",
                icon: MapPinned,
                tab: "mapas",
              },
            ]
          : [],
      },
      {
        id: "citizens",
        label: isMunicipal ? "Ciudadanía" : "Contactos",
        icon: Users,
        modules: capabilities.contacts
          ? [
              {
                id: "users",
                label: isMunicipal ? "Personas y contactos" : "Clientes y contactos",
                description: "Identidad, historial, consentimiento y contexto CRM.",
                icon: Users,
                tab: "usuarios",
              },
            ]
          : [],
      },
      {
        id: "intelligence",
        label: "Inteligencia",
        icon: BarChart3,
        modules: intelligenceModules,
      },
      {
        id: "administration",
        label: "Administración",
        icon: Settings2,
        modules: [
          ...(capabilities.catalog
            ? [
                {
                  id: "catalog",
                  label: isMunicipal ? "Servicios y catálogo" : "Catálogo e inventario",
                  description: "Oferta publicada, recursos y disponibilidad.",
                  icon: Package,
                  tab: "catalogo" as ProfileWorkspaceTabValue,
                },
              ]
            : []),
          ...(capabilities.team
            ? [
                {
                  id: "team",
                  label: "Equipo y permisos",
                  description: "Roles, alcance operativo y accesos.",
                  icon: Users,
                  tab: "empleados" as ProfileWorkspaceTabValue,
                },
              ]
            : []),
        ],
      },
    ];

    return workspaceGroups.filter((group) => group.modules.length > 0);
  }, [
    capabilities.analytics,
    capabilities.catalog,
    capabilities.contacts,
    capabilities.operation,
    capabilities.participation,
    capabilities.reports,
    capabilities.team,
    capabilities.territory,
    isMunicipal,
    onOpenSurveys,
  ]);

  const activeModule = groups
    .flatMap((group) => group.modules)
    .find((module) => module.tab === activeTab);
  const activeGroup = groups.find((group) => group.modules.some((module) => module.tab === activeTab));

  return (
    <nav
      aria-label="Módulos del centro de control"
      className="rounded-xl border border-border/70 bg-card/95 p-1 shadow-sm backdrop-blur"
      data-testid="profile-workspace-navigation"
    >
      <div className="hidden items-center gap-1 lg:flex">
        <Button
          type="button"
          variant={activeTab === "perfil" ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-9 shrink-0 gap-2 rounded-lg px-3 text-sm",
            activeTab === "perfil" && "bg-primary/10 text-primary hover:bg-primary/15",
          )}
          aria-current={activeTab === "perfil" ? "page" : undefined}
          onClick={() => onTabChange("perfil")}
        >
          <LayoutDashboard className="h-4 w-4" />
          Inicio
        </Button>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isActive = group.id === activeGroup?.id;
          const currentModule = isActive ? activeModule : undefined;

          return (
            <DropdownMenu key={group.id}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-9 min-w-0 gap-2 rounded-lg px-3 text-sm",
                    isActive && "bg-primary/10 text-primary hover:bg-primary/15",
                  )}
                  aria-label={`Abrir menú ${group.label}`}
                  data-active={isActive ? "true" : "false"}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span>{group.label}</span>
                  {currentModule ? (
                    <span className="hidden max-w-32 truncate text-xs font-normal text-muted-foreground 2xl:inline">
                      · {currentModule.label}
                    </span>
                  ) : null}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80 p-2">
                <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {group.modules.map((module) => (
                  <ModuleMenuItem
                    key={module.id}
                    activeTab={activeTab}
                    module={module}
                    onTabChange={onTabChange}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <Button
          type="button"
          variant={activeTab === "perfil" ? "secondary" : "ghost"}
          size="icon"
          className={cn("h-9 w-9 shrink-0 rounded-lg", activeTab === "perfil" && "bg-primary/10 text-primary")}
          aria-label="Abrir Inicio"
          aria-current={activeTab === "perfil" ? "page" : undefined}
          onClick={() => onTabChange("perfil")}
        >
          <LayoutDashboard className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-0 flex-1 justify-between rounded-lg px-3"
              aria-label="Abrir menú de módulos"
            >
              <span className="min-w-0 truncate text-sm font-semibold">
                {activeModule?.label || "Módulos"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto p-2">
            {groups.map((group, index) => (
              <React.Fragment key={group.id}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </DropdownMenuLabel>
                {group.modules.map((module) => (
                  <ModuleMenuItem
                    key={module.id}
                    activeTab={activeTab}
                    module={module}
                    onTabChange={onTabChange}
                  />
                ))}
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
