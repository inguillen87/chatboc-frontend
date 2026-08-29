import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";

import IdentityAvatar from "@/components/identity/IdentityAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type {
  CrmPeopleQueueView,
  CrmPeopleSort,
  CrmWorkspaceView,
} from "./useCrmWorkspaceState";

export interface CrmPeopleRecord {
  id: number | string;
  contactId?: string | null;
  nombre: string;
  email: string;
  emailIsPlaceholder?: boolean;
  telefono?: string | null;
  whatsappNumber?: string | null;
  whatsappExplicit?: boolean;
  etiquetas: string[];
  canal?: string | null;
  origen?: string | null;
  createdAt?: string | null;
  lastSeen?: string | null;
  marketing?: boolean;
  profileExcerpt?: string | null;
  resumen?: string | null;
  motivo?: string | null;
  lastIntent?: string | null;
  leadTemperature?: string | null;
  leadScore?: number;
  conversationStatus?: string | null;
  suggestedActions?: string[];
  interactionCount?: number | null;
  lastMessageExcerpt?: string | null;
  avatarUrl?: string | null;
  avatarSource?: string | null;
  avatarConsent?: boolean | string | number | null;
  totalOrders?: number;
  ltv?: number;
}

interface WorkspaceMetric {
  label: string;
  value: number | string;
  helper: string;
}

interface CrmPeopleWorkspaceProps {
  embedded?: boolean;
  activeView: CrmWorkspaceView;
  onViewChange: (view: CrmWorkspaceView) => void;
  people: CrmPeopleRecord[];
  selectedContactId: string | null;
  onSelectContact: (contactId: string | null) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: number | string) => void;
  onSetSelected: (ids: Array<number | string>, selected: boolean) => void;
  onClearSelected: () => void;
  queueView: CrmPeopleQueueView;
  onQueueViewChange: (view: CrmPeopleQueueView) => void;
  peopleSort: CrmPeopleSort;
  onPeopleSortChange: (sort: CrmPeopleSort) => void;
  search: string;
  onSearchChange: (value: string) => void;
  marketingOnly: boolean;
  onMarketingOnlyChange: (value: boolean) => void;
  onRefresh: () => void;
  onBack: () => void;
  onOpenTicketDesk: (person: CrmPeopleRecord) => void;
  isConnected: boolean;
  metrics: WorkspaceMetric[];
  getPersonKey: (person: CrmPeopleRecord) => string;
  hasRealEmail: (person: CrmPeopleRecord) => boolean;
  hasExplicitWhatsApp: (person: CrmPeopleRecord) => boolean;
  whatsappUrl: (person: CrmPeopleRecord) => string | null;
  profileScore: (person: CrmPeopleRecord) => number;
  nextAction: (person: CrmPeopleRecord) => string;
  formatDate: (value?: string | null) => string;
  copyToClipboard: (value?: string | null, label?: string) => void;
  segmentsPanel: React.ReactNode;
  campaignsPanel: React.ReactNode;
  activityPanel: React.ReactNode;
}

const viewItems: Array<{
  value: CrmWorkspaceView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "personas", label: "Personas", icon: Users },
  { value: "segmentos", label: "Segmentos", icon: Filter },
  { value: "campanas", label: "Campañas", icon: Megaphone },
  { value: "actividad", label: "Actividad", icon: Activity },
];

const queueViewItems: Array<{ value: CrmPeopleQueueView; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "review", label: "Revisión CRM" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "complete", label: "Perfiles completos" },
];

const channelLabel = (value?: string | null) => {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "Sin canal";
  if (normalized.includes("whatsapp") || normalized === "wa") return "WhatsApp";
  if (normalized.includes("widget") || normalized.includes("web")) return "Widget web";
  if (normalized.includes("voice") || normalized.includes("voz")) return "Voz";
  if (normalized.includes("email")) return "Email";
  return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const intentLabel = (value?: string | null) => {
  const normalized = (value || "").trim();
  if (!normalized) return "Sin motivo declarado";
  const labels: Record<string, string> = {
    lead_hot: "Interés comercial",
    reclamo: "Reclamo",
    encuestas: "Encuestas",
    pedido_catalogo: "Pedido o catálogo",
    educacion: "Educación",
    soporte: "Soporte",
    saludo: "Primer contacto",
    consulta_general: "Consulta general",
  };
  return labels[normalized] || normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const selectedTone = (score: number) => {
  if (score >= 75) return "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  if (score >= 50) return "border-sky-600/30 bg-sky-500/10 text-sky-800 dark:text-sky-200";
  return "border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-100";
};

const EmptySelection = () => (
  <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-8 text-center">
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <UserRound className="h-7 w-7 text-muted-foreground" />
    </div>
    <h3 className="mt-4 font-semibold">Seleccioná una persona</h3>
    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
      El registro 360 concentra identidad, interacciones, casos y consentimiento sin abandonar la bandeja.
    </p>
  </div>
);

interface ContextPanelProps {
  person: CrmPeopleRecord;
  score: number;
  nextAction: string;
  formatDate: (value?: string | null) => string;
}

const ContextPanel = ({ person, score, nextAction, formatDate }: ContextPanelProps) => (
  <div className="space-y-4" data-testid="crm-context-panel">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Próxima acción</p>
      <p className="mt-2 text-sm font-semibold leading-6">{nextAction}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Priorización calculada con los datos disponibles del registro; requiere criterio del operador.
      </p>
    </div>
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-muted-foreground">Completitud CRM</span>
        <span className="font-mono font-bold">{score}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Completitud del perfil CRM"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
      </div>
    </div>
    <dl className="grid gap-2 text-sm">
      <div className="rounded-xl border border-border/70 p-3">
        <dt className="text-xs text-muted-foreground">Canal más reciente</dt>
        <dd className="mt-1 font-semibold">{channelLabel(person.canal)}</dd>
      </div>
      <div className="rounded-xl border border-border/70 p-3">
        <dt className="text-xs text-muted-foreground">Última interacción</dt>
        <dd className="mt-1 font-semibold">{formatDate(person.lastSeen)}</dd>
      </div>
      <div className="rounded-xl border border-border/70 p-3">
        <dt className="text-xs text-muted-foreground">Estado de consentimiento</dt>
        <dd className="mt-1 font-semibold">{person.marketing ? "Opt-in registrado" : "Sin opt-in de marketing"}</dd>
      </div>
    </dl>
    <div className="rounded-xl border border-dashed border-border/70 p-3 text-xs leading-5 text-muted-foreground">
      Los datos de contacto no prueban por sí solos la disponibilidad de un canal. WhatsApp solo se habilita con evidencia explícita.
    </div>
  </div>
);

export default function CrmPeopleWorkspace({
  embedded = false,
  activeView,
  onViewChange,
  people,
  selectedContactId,
  onSelectContact,
  selectedIds,
  onToggleSelected,
  onSetSelected,
  onClearSelected,
  queueView,
  onQueueViewChange,
  peopleSort,
  onPeopleSortChange,
  search,
  onSearchChange,
  marketingOnly,
  onMarketingOnlyChange,
  onRefresh,
  onBack,
  onOpenTicketDesk,
  isConnected,
  metrics,
  getPersonKey,
  hasRealEmail,
  hasExplicitWhatsApp,
  whatsappUrl,
  profileScore,
  nextAction,
  formatDate,
  copyToClipboard,
  segmentsPanel,
  campaignsPanel,
  activityPanel,
}: CrmPeopleWorkspaceProps) {
  const [contextOpen, setContextOpen] = React.useState(true);
  const [mobileContextOpen, setMobileContextOpen] = React.useState(false);

  const scoredPeople = React.useMemo(
    () => people.map((person) => ({ person, score: profileScore(person) })),
    [people, profileScore],
  );
  const queueViewCounts = React.useMemo(
    () => ({
      all: scoredPeople.length,
      review: scoredPeople.filter(({ score }) => score < 75).length,
      whatsapp: scoredPeople.filter(({ person }) => hasExplicitWhatsApp(person)).length,
      complete: scoredPeople.filter(({ score }) => score >= 75).length,
    }),
    [hasExplicitWhatsApp, scoredPeople],
  );
  const visiblePeople = React.useMemo(() => {
    const filtered = scoredPeople.filter(({ person, score }) => {
      if (queueView === "review") return score < 75;
      if (queueView === "whatsapp") return hasExplicitWhatsApp(person);
      if (queueView === "complete") return score >= 75;
      return true;
    });
    filtered.sort((a, b) => {
      if (peopleSort === "name") return a.person.nombre.localeCompare(b.person.nombre, "es");
      if (peopleSort === "score-desc") return b.score - a.score;
      if (peopleSort === "score-asc") return a.score - b.score;
      const aTime = a.person.lastSeen ? Date.parse(a.person.lastSeen) : 0;
      const bTime = b.person.lastSeen ? Date.parse(b.person.lastSeen) : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.person.nombre.localeCompare(b.person.nombre, "es");
    });
    return filtered.map(({ person }) => person);
  }, [hasExplicitWhatsApp, peopleSort, queueView, scoredPeople]);

  const selectedPerson = React.useMemo(
    () => people.find((person) => getPersonKey(person) === selectedContactId) || null,
    [getPersonKey, people, selectedContactId],
  );
  const score = selectedPerson ? profileScore(selectedPerson) : 0;
  const action = selectedPerson ? nextAction(selectedPerson) : "";
  const listViewportRef = React.useRef<HTMLDivElement>(null);
  const desktopList = useVirtualizer({
    count: visiblePeople.length,
    getScrollElement: () => listViewportRef.current,
    estimateSize: () => 82,
    overscan: 8,
    initialRect: { width: 320, height: 760 },
  });
  const mobilePeople = React.useMemo(() => {
    const limit = 250;
    const first = visiblePeople.slice(0, limit);
    if (
      !selectedPerson ||
      !visiblePeople.some((person) => getPersonKey(person) === getPersonKey(selectedPerson)) ||
      first.some((person) => getPersonKey(person) === getPersonKey(selectedPerson))
    ) {
      return first;
    }
    return [...first.slice(0, limit - 1), selectedPerson];
  }, [getPersonKey, selectedPerson, visiblePeople]);

  React.useEffect(() => {
    if (activeView !== "personas" || visiblePeople.length === 0) return;
    const selectionIsVisible = visiblePeople.some(
      (person) => getPersonKey(person) === selectedContactId,
    );
    if (!selectionIsVisible) onSelectContact(getPersonKey(visiblePeople[0]));
  }, [activeView, getPersonKey, onSelectContact, selectedContactId, visiblePeople]);

  const visibleIds = React.useMemo(
    () => visiblePeople.map((person) => person.id),
    [visiblePeople],
  );
  const selectedVisibleCount = React.useMemo(
    () => visiblePeople.filter((person) => selectedIds.has(String(person.id))).length,
    [selectedIds, visiblePeople],
  );
  const allVisibleSelected = visiblePeople.length > 0 && selectedVisibleCount === visiblePeople.length;

  const auxiliaryPanel =
    activeView === "segmentos"
      ? segmentsPanel
      : activeView === "campanas"
        ? campaignsPanel
        : activityPanel;

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1680px] flex-col",
        embedded
          ? "h-full min-h-0 max-w-none gap-1 overflow-hidden p-0"
          : "gap-3 p-3 md:p-4",
      )}
      data-testid="crm-people-workspace"
      data-layout={embedded ? "embedded" : "page"}
    >
      <section className="shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <header
          className={cn(
            "flex flex-col border-b border-border/70 xl:flex-row xl:items-center xl:justify-between",
            embedded
              ? "flex-row items-center justify-between gap-2 px-2 py-1.5 sm:px-3 sm:py-2"
              : "gap-3 px-4 py-3",
          )}
          data-testid="crm-people-overview-header"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">CRM municipal</p>
              <Badge
                variant={isConnected ? "default" : "outline"}
                className={cn("gap-1.5", embedded && "px-1.5 sm:px-2.5")}
                aria-label={isConnected ? "CRM conectado en vivo" : "CRM con sincronización cada 30 segundos"}
              >
                <Activity className="h-3 w-3" />
                <span className={cn(embedded && "sr-only sm:not-sr-only")}>
                  {isConnected ? "En vivo" : "Sincronización 30 s"}
                </span>
              </Badge>
            </div>
            <h1 className={cn("mt-1 font-bold tracking-tight", embedded ? "text-base sm:text-lg md:text-xl" : "text-xl md:text-2xl")}>Personas y relaciones</h1>
            <p className={cn("mt-1 text-sm text-muted-foreground", embedded && "hidden 2xl:block")}>Vista operativa compacta para encontrar, entender y actuar sobre cada contacto.</p>
          </div>
          <div className={cn("flex flex-wrap items-center gap-2", embedded && "shrink-0 gap-1 sm:gap-2")}>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2", embedded && "h-8 w-8 p-0 sm:w-auto sm:px-3")}
              onClick={onRefresh}
              aria-label="Actualizar personas"
            >
              <RefreshCw className="h-4 w-4" />
              <span className={cn(embedded && "sr-only sm:not-sr-only")}>Actualizar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(embedded && "h-8 w-8 gap-1 p-0 sm:w-auto sm:px-3")}
              onClick={onBack}
              aria-label="Volver al perfil"
            >
              {embedded ? <ChevronLeft className="h-4 w-4 sm:hidden" /> : null}
              <span className={cn(embedded && "sr-only sm:not-sr-only")}>Volver</span>
            </Button>
          </div>
        </header>

        <div
          className={cn(
            "grid divide-x divide-border/70",
            embedded ? "grid-cols-4 divide-y-0" : "grid-cols-2 divide-y md:grid-cols-4 md:divide-y-0",
          )}
          data-testid="crm-overview-metrics"
        >
          {metrics.slice(0, 4).map((metric) => (
            <div key={metric.label} className={cn("min-w-0", embedded ? "px-1.5 py-1 sm:px-3 sm:py-1.5" : "px-4 py-3")}>
              <p className={cn("truncate font-semibold uppercase tracking-[0.12em] text-muted-foreground", embedded ? "text-[9px] leading-3 sm:text-[11px]" : "text-[11px]")}>{metric.label}</p>
              <p className={cn("font-bold tracking-tight", embedded ? "text-base sm:text-lg" : "mt-1 text-2xl")}>{metric.value}</p>
              <p className={cn("mt-0.5 truncate text-xs text-muted-foreground", embedded && "sr-only")}>{metric.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <nav
        className={cn(
          "min-w-0 shrink-0 items-center rounded-xl border border-border/70 bg-card",
          embedded
            ? "grid grid-cols-4 gap-0.5 overflow-hidden p-0.5 sm:flex sm:gap-1 sm:overflow-x-auto"
            : "flex gap-1 overflow-x-auto p-1",
        )}
        aria-label="Áreas del CRM"
        data-testid="crm-area-navigation"
      >
        {viewItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.value;
          return (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "shrink-0 gap-2",
                embedded && "min-w-0 gap-1 px-1 text-[11px] sm:gap-2 sm:px-3 sm:text-sm",
                active && "bg-primary/10 text-blue-700 dark:text-blue-300",
              )}
              aria-current={active ? "page" : undefined}
              onClick={() => onViewChange(item.value)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {activeView !== "personas" ? (
        <section className={cn("overflow-hidden rounded-2xl border border-border/70 bg-card", embedded ? "min-h-0 flex-1" : "min-h-[520px]")}>
          <ScrollArea className={embedded ? "h-full" : "h-[min(72dvh,760px)]"}>
            <div className="p-4 md:p-5">{auxiliaryPanel}</div>
          </ScrollArea>
        </section>
      ) : (
        <section className={cn("overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm", embedded && "flex min-h-0 flex-1 flex-col")}>
          <div
            className={cn(
              "flex flex-col border-b border-border/70 lg:flex-row lg:items-center lg:justify-between",
              embedded ? "gap-1 p-2 sm:gap-2 sm:p-3" : "gap-2 p-3",
            )}
            data-testid="crm-people-search-toolbar"
          >
            <div className={cn("flex w-full min-w-0 flex-col sm:flex-row lg:max-w-2xl", embedded ? "gap-1 sm:gap-2" : "gap-2")}>
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Buscar por nombre, email o teléfono"
                  className="h-9 pl-9"
                  aria-label="Buscar personas"
                />
              </div>
              <select
                value={selectedContactId || ""}
                onChange={(event) => onSelectContact(event.target.value || null)}
                className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm lg:hidden"
                aria-label="Seleccionar persona"
              >
                {visiblePeople.length === 0 ? <option value="">Sin resultados</option> : null}
                {mobilePeople.map((person) => (
                  <option key={getPersonKey(person)} value={getPersonKey(person)}>{person.nombre}</option>
                ))}
                {visiblePeople.length > mobilePeople.length ? (
                  <option value="" disabled>Buscá para ver {visiblePeople.length - mobilePeople.length} personas más</option>
                ) : null}
              </select>
            </div>
            <div className={cn("flex flex-wrap items-center", embedded ? "gap-1 sm:gap-2" : "gap-2")}>
              <label className={cn("flex items-center gap-2 rounded-lg border border-border/70", embedded ? "h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm" : "h-9 px-3 text-sm")}>
                <Checkbox checked={marketingOnly} onCheckedChange={(value) => onMarketingOnlyChange(Boolean(value))} />
                Con opt-in
              </label>
              <Badge variant="outline">
                {visiblePeople.length === people.length
                  ? `${people.length} resultados`
                  : `${visiblePeople.length} de ${people.length}`}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden gap-2 xl:inline-flex"
                onClick={() => setContextOpen((current) => !current)}
                aria-label={contextOpen ? "Ocultar panel contextual" : "Mostrar panel contextual"}
              >
                {contextOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                Contexto
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "flex flex-col border-b border-border/70 bg-muted/15 lg:flex-row lg:items-center lg:justify-between",
              embedded ? "gap-1 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2" : "gap-2 px-3 py-2",
            )}
            data-testid="crm-queue-controls"
          >
            {embedded ? (
              <select
                value={queueView}
                onChange={(event) => onQueueViewChange(event.target.value as CrmPeopleQueueView)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs sm:hidden"
                aria-label="Vista operativa de personas"
              >
                {queueViewItems.map((item) => (
                  <option key={item.value} value={item.value}>{item.label} ({queueViewCounts[item.value]})</option>
                ))}
              </select>
            ) : null}
            <div className={cn("min-w-0 items-center gap-1 overflow-x-auto", embedded ? "hidden sm:flex" : "flex")} role="group" aria-label="Vistas operativas de personas">
              <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vista</span>
              {queueViewItems.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={queueView === item.value ? "secondary" : "ghost"}
                  className={cn(
                    "h-8 shrink-0 gap-1.5 px-2.5 text-xs",
                    queueView === item.value && "bg-background text-foreground shadow-sm",
                  )}
                  aria-pressed={queueView === item.value}
                  onClick={() => onQueueViewChange(item.value)}
                >
                  {item.label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {queueViewCounts[item.value]}
                  </span>
                </Button>
              ))}
            </div>
            <div className={cn("items-center gap-2", embedded ? "grid grid-cols-2 sm:flex" : "flex flex-wrap")}>
              <label className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 text-xs">
                <Checkbox
                  checked={allVisibleSelected ? true : selectedVisibleCount > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) => onSetSelected(visibleIds, Boolean(checked))}
                  aria-label="Seleccionar personas visibles"
                  disabled={visiblePeople.length === 0}
                />
                Seleccionar vista
              </label>
              <Select value={peopleSort} onValueChange={(value) => onPeopleSortChange(value as CrmPeopleSort)}>
                <SelectTrigger className={cn("h-8 bg-background text-xs", embedded ? "w-full sm:w-[178px]" : "w-[178px]")} aria-label="Ordenar personas">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Actividad reciente</SelectItem>
                  <SelectItem value="name">Nombre A–Z</SelectItem>
                  <SelectItem value="score-desc">Mayor completitud</SelectItem>
                  <SelectItem value="score-asc">Menor completitud</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex flex-col gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between" role="region" aria-label="Acciones sobre personas seleccionadas">
              <div className="flex items-center gap-2 text-sm">
                <Badge className="min-w-7 justify-center">{selectedIds.size}</Badge>
                <span className="font-semibold">personas seleccionadas</span>
                {selectedVisibleCount !== selectedIds.size ? (
                  <span className="text-xs text-muted-foreground">({selectedVisibleCount} en esta vista)</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 gap-2" onClick={() => onViewChange("segmentos")}>
                  <Filter className="h-3.5 w-3.5" />
                  Analizar segmento
                </Button>
                <Button type="button" size="sm" className="h-8 gap-2" onClick={() => onViewChange("campanas")}>
                  <Megaphone className="h-3.5 w-3.5" />
                  Preparar campaña
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClearSelected} aria-label="Limpiar selección">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "grid grid-cols-1",
              embedded ? "min-h-0 flex-1" : "h-[min(72dvh,760px)] min-h-[560px]",
              contextOpen
                ? "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_280px]"
                : "lg:grid-cols-[320px_minmax(0,1fr)]",
            )}
            data-testid="crm-people-grid"
          >
            <aside className="hidden min-h-0 border-r border-border/70 lg:block" aria-label="Lista de personas">
              <div ref={listViewportRef} className="h-full overflow-y-auto">
                {visiblePeople.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No hay personas para los filtros aplicados.</div>
                ) : (
                  <div className="relative w-full" style={{ height: `${desktopList.getTotalSize()}px` }}>
                    {desktopList.getVirtualItems().map((virtualRow) => {
                      const person = visiblePeople[virtualRow.index];
                      const key = getPersonKey(person);
                      const active = key === selectedContactId;
                      const personScore = profileScore(person);
                      return (
                        <div
                          key={key}
                          ref={desktopList.measureElement}
                          data-index={virtualRow.index}
                          className={cn(
                            "absolute left-0 top-0 grid w-full grid-cols-[28px_40px_minmax(0,1fr)] gap-2 border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-muted/40",
                            active && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                          )}
                          style={{ transform: `translateY(${virtualRow.start}px)` }}
                        >
                          <span className="pt-2">
                            <Checkbox
                              checked={selectedIds.has(String(person.id))}
                              onCheckedChange={() => onToggleSelected(person.id)}
                              aria-label={`Seleccionar ${person.nombre}`}
                            />
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectContact(key)}
                            className="col-span-2 grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-current={active ? "true" : undefined}
                          >
                            <IdentityAvatar
                              name={person.nombre || person.email || person.telefono || "Contacto"}
                              avatarUrl={person.avatarUrl}
                              source={person.avatarSource}
                              consented={person.avatarConsent}
                              size="md"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold">{person.nombre}</span>
                                <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold", selectedTone(personScore))}>{personScore}%</span>
                              </span>
                              <span className="mt-1 block truncate text-xs text-muted-foreground">{person.motivo || intentLabel(person.lastIntent)}</span>
                              <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <MessageCircle className="h-3 w-3" />
                                {channelLabel(person.canal)}
                                <span aria-hidden="true">·</span>
                                {formatDate(person.lastSeen)}
                              </span>
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            <div
              className="min-h-0 min-w-0 bg-background/20"
              data-testid="crm-person-detail"
            >
              {!selectedPerson ? (
                <EmptySelection />
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <header
                    className={cn("border-b border-border/70 bg-card", embedded ? "px-2 py-2 sm:px-4 sm:py-3" : "px-4 py-3")}
                    data-testid="crm-person-header"
                  >
                    <div className={cn("flex gap-3", embedded ? "items-start justify-between" : "flex-col md:flex-row md:items-start md:justify-between")}>
                      <div className={cn("flex min-w-0 items-center", embedded ? "flex-1 gap-2 sm:gap-3" : "gap-3")}>
                        <IdentityAvatar
                          name={selectedPerson.nombre || selectedPerson.email || selectedPerson.telefono || "Contacto"}
                          avatarUrl={selectedPerson.avatarUrl}
                          source={selectedPerson.avatarSource}
                          consented={selectedPerson.avatarConsent}
                          size={embedded ? "md" : "lg"}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <h2 className={cn("min-w-0 flex-1 truncate font-bold", embedded ? "text-base sm:text-lg" : "text-lg")}>{selectedPerson.nombre}</h2>
                            <Badge variant="outline" className={cn(embedded && "hidden sm:inline-flex")}>{channelLabel(selectedPerson.canal)}</Badge>
                            <Badge variant="outline" className={cn("shrink-0", selectedTone(score), embedded && "px-1.5 text-[10px] sm:px-2.5 sm:text-xs")}>CRM {score}%</Badge>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{selectedPerson.motivo || intentLabel(selectedPerson.lastIntent)}</p>
                        </div>
                      </div>
                      <div className={cn("flex flex-wrap items-center gap-2", embedded && "shrink-0 gap-1 sm:gap-2")}>
                        <Button
                          size="sm"
                          className={cn("gap-2", embedded && "h-8 w-8 p-0 sm:w-auto sm:px-3")}
                          onClick={() => onOpenTicketDesk(selectedPerson)}
                          aria-label="Abrir conversación"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className={cn(embedded && "sr-only sm:not-sr-only")}>Abrir conversación</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className={cn(embedded && "h-8 w-8")} aria-label="Más acciones">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Acciones del contacto</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => onOpenTicketDesk(selectedPerson)}>
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Abrir conversación
                            </DropdownMenuItem>
                            {selectedPerson.telefono ? (
                              <DropdownMenuItem onSelect={() => copyToClipboard(selectedPerson.telefono, "Teléfono")}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar teléfono
                              </DropdownMenuItem>
                            ) : null}
                            {hasRealEmail(selectedPerson) ? (
                              <DropdownMenuItem onSelect={() => copyToClipboard(selectedPerson.email, "Email")}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar email
                              </DropdownMenuItem>
                            ) : null}
                            {hasExplicitWhatsApp(selectedPerson) && whatsappUrl(selectedPerson) ? (
                              <DropdownMenuItem asChild>
                                <a href={whatsappUrl(selectedPerson) || undefined} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  WhatsApp externo
                                </a>
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="icon"
                          variant="outline"
                          className={cn("xl:hidden", embedded && "h-8 w-8")}
                          aria-label="Abrir panel contextual"
                          onClick={() => setMobileContextOpen(true)}
                        >
                          <PanelRightOpen className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </header>

                  <Tabs defaultValue="resumen" className="flex min-h-0 flex-1 flex-col">
                    <div
                      className={cn("border-b border-border/70 bg-card", embedded ? "overflow-hidden px-1 sm:overflow-x-auto sm:px-4" : "overflow-x-auto px-4")}
                      data-testid="crm-person-tabs"
                    >
                      <TabsList className={cn("rounded-none bg-transparent p-0", embedded ? "grid h-10 w-full grid-cols-4 sm:flex sm:h-11 sm:w-max" : "h-11 w-max")}>
                        <TabsTrigger value="resumen" className={cn("rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>Resumen</TabsTrigger>
                        <TabsTrigger value="interacciones" className={cn("rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>Interacciones</TabsTrigger>
                        <TabsTrigger value="casos" className={cn("rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>Casos</TabsTrigger>
                        <TabsTrigger value="consentimiento" className={cn("rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>Consentimiento</TabsTrigger>
                      </TabsList>
                    </div>
                    <ScrollArea className="min-h-0 flex-1" data-testid="crm-person-scroll">
                      <TabsContent value="resumen" className={cn("m-0", embedded ? "p-2 sm:p-4" : "p-4")}>
                        <div className="grid gap-3 md:grid-cols-2">
                          <section className={cn("rounded-xl border border-border/70 bg-card", embedded ? "p-3 sm:p-4" : "p-4")}>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" />Resumen operativo</div>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                              {selectedPerson.resumen || selectedPerson.lastMessageExcerpt || selectedPerson.profileExcerpt || "Todavía no hay un resumen disponible. Se completa con actividad real del contacto."}
                            </p>
                          </section>
                          <section className={cn("rounded-xl border border-border/70 bg-card", embedded ? "p-3 sm:p-4" : "p-4")}>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-primary" />Datos de contacto</div>
                            <dl className="mt-3 space-y-3 text-sm">
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Teléfono</dt><dd className="font-medium">{selectedPerson.telefono || "Sin teléfono"}</dd></div>
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="max-w-[65%] truncate font-medium">{hasRealEmail(selectedPerson) ? selectedPerson.email : "Sin email real"}</dd></div>
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{hasExplicitWhatsApp(selectedPerson) ? "Canal explícito" : "No verificado"}</dd></div>
                            </dl>
                          </section>
                          <section className={cn("rounded-xl border border-border/70 bg-card md:col-span-2", embedded ? "p-3 sm:p-4" : "p-4")}>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Tags className="h-4 w-4 text-primary" />Segmentación</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedPerson.etiquetas.length ? selectedPerson.etiquetas.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>) : <span className="text-sm text-muted-foreground">Sin etiquetas registradas.</span>}
                            </div>
                          </section>
                        </div>
                      </TabsContent>
                      <TabsContent value="interacciones" className="m-0 p-4">
                        <section className="rounded-xl border border-border/70 bg-card p-4">
                          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Historial multicanal</h3><Badge variant="outline">{selectedPerson.interactionCount || 0} interacciones</Badge></div>
                          <div className="mt-4 border-l border-border/70 pl-4">
                            <div className="relative pb-5"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" /><p className="text-sm font-semibold">Última señal registrada</p><p className="text-xs text-muted-foreground">{formatDate(selectedPerson.lastSeen)} · {channelLabel(selectedPerson.canal)}</p><p className="mt-2 text-sm text-muted-foreground">{selectedPerson.lastMessageExcerpt || "Sin extracto publicado."}</p></div>
                            <div className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground" /><p className="text-sm font-semibold">Alta del contacto</p><p className="text-xs text-muted-foreground">{formatDate(selectedPerson.createdAt)}</p></div>
                          </div>
                        </section>
                      </TabsContent>
                      <TabsContent value="casos" className="m-0 p-4">
                        <section className="rounded-xl border border-border/70 bg-card p-4">
                          <div className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-primary" />Casos y solicitudes</div>
                          <p className="mt-3 text-sm text-muted-foreground">{selectedPerson.motivo ? `Motivo asociado: ${selectedPerson.motivo}` : "No hay un caso asociado publicado en este resumen."}</p>
                          {selectedPerson.conversationStatus ? <Badge className="mt-3" variant="outline">{intentLabel(selectedPerson.conversationStatus)}</Badge> : null}
                        </section>
                      </TabsContent>
                      <TabsContent value="consentimiento" className="m-0 p-4">
                        <section className="rounded-xl border border-border/70 bg-card p-4">
                          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Privacidad y permisos</div>
                          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"><div><p className="text-sm font-semibold">Marketing</p><p className="text-xs text-muted-foreground">Consentimiento registrado por el backend.</p></div><Badge variant={selectedPerson.marketing ? "default" : "outline"}>{selectedPerson.marketing ? "Opt-in" : "Sin opt-in"}</Badge></div>
                          <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"><div><p className="text-sm font-semibold">Canal WhatsApp</p><p className="text-xs text-muted-foreground">No se infiere a partir de un teléfono genérico.</p></div><Badge variant={hasExplicitWhatsApp(selectedPerson) ? "default" : "outline"}>{hasExplicitWhatsApp(selectedPerson) ? "Explícito" : "No verificado"}</Badge></div>
                        </section>
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
                </div>
              )}
            </div>

            {contextOpen && selectedPerson ? (
              <aside className="hidden min-h-0 border-l border-border/70 bg-card xl:block" aria-label="Panel contextual">
                <ScrollArea className="h-full"><div className="p-4"><ContextPanel person={selectedPerson} score={score} nextAction={action} formatDate={formatDate} /></div></ScrollArea>
              </aside>
            ) : null}
          </div>

          {!embedded ? (
            <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-xs text-muted-foreground lg:hidden">
              <span>Deslizá la lista desde el selector de persona.</span>
              <div className="flex items-center gap-1"><ChevronLeft className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5" /></div>
            </div>
          ) : null}
        </section>
      )}

      <Sheet open={mobileContextOpen} onOpenChange={setMobileContextOpen}>
        <SheetContent side="right" className="w-[92vw] overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Contexto operativo</SheetTitle>
            <SheetDescription>Próxima acción, calidad y permisos del contacto seleccionado.</SheetDescription>
          </SheetHeader>
          {selectedPerson ? <div className="mt-6"><ContextPanel person={selectedPerson} score={score} nextAction={action} formatDate={formatDate} /></div> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
