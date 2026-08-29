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
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 p-3 md:p-4" data-testid="crm-people-workspace">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <header className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">CRM municipal</p>
              <Badge variant={isConnected ? "default" : "outline"} className="gap-1.5">
                <Activity className="h-3 w-3" />
                {isConnected ? "En vivo" : "Sincronización 30 s"}
              </Badge>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">Personas y relaciones</h1>
            <p className="mt-1 text-sm text-muted-foreground">Vista operativa compacta para encontrar, entender y actuar sobre cada contacto.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>Volver</Button>
          </div>
        </header>

        <div className="grid grid-cols-2 divide-x divide-y divide-border/70 md:grid-cols-4 md:divide-y-0">
          {metrics.slice(0, 4).map((metric) => (
            <div key={metric.label} className="min-w-0 px-4 py-3">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{metric.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{metric.helper}</p>
            </div>
          ))}
        </div>
      </section>

      <nav className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card p-1" aria-label="Áreas del CRM">
        {viewItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.value;
          return (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={active ? "secondary" : "ghost"}
              className={cn("shrink-0 gap-2", active && "bg-primary/10 text-blue-700 dark:text-blue-300")}
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
        <section className="min-h-[520px] overflow-hidden rounded-2xl border border-border/70 bg-card">
          <ScrollArea className="h-[min(72dvh,760px)]">
            <div className="p-4 md:p-5">{auxiliaryPanel}</div>
          </ScrollArea>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border/70 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:max-w-2xl">
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
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm">
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

          <div className="flex flex-col gap-2 border-b border-border/70 bg-muted/15 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto" role="group" aria-label="Vistas operativas de personas">
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
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-8 items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 text-xs">
                <Checkbox
                  checked={allVisibleSelected ? true : selectedVisibleCount > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) => onSetSelected(visibleIds, Boolean(checked))}
                  aria-label="Seleccionar personas visibles"
                  disabled={visiblePeople.length === 0}
                />
                Seleccionar vista
              </label>
              <Select value={peopleSort} onValueChange={(value) => onPeopleSortChange(value as CrmPeopleSort)}>
                <SelectTrigger className="h-8 w-[178px] bg-background text-xs" aria-label="Ordenar personas">
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
              "grid h-[min(72dvh,760px)] min-h-[560px] grid-cols-1",
              contextOpen
                ? "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_280px]"
                : "lg:grid-cols-[320px_minmax(0,1fr)]",
            )}
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
                  <header className="border-b border-border/70 bg-card px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <IdentityAvatar
                          name={selectedPerson.nombre || selectedPerson.email || selectedPerson.telefono || "Contacto"}
                          avatarUrl={selectedPerson.avatarUrl}
                          source={selectedPerson.avatarSource}
                          consented={selectedPerson.avatarConsent}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-bold">{selectedPerson.nombre}</h2>
                            <Badge variant="outline">{channelLabel(selectedPerson.canal)}</Badge>
                            <Badge variant="outline" className={selectedTone(score)}>CRM {score}%</Badge>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{selectedPerson.motivo || intentLabel(selectedPerson.lastIntent)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => onOpenTicketDesk(selectedPerson)}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Abrir conversación
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Más acciones">
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
                          className="xl:hidden"
                          aria-label="Abrir panel contextual"
                          onClick={() => setMobileContextOpen(true)}
                        >
                          <PanelRightOpen className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </header>

                  <Tabs defaultValue="resumen" className="flex min-h-0 flex-1 flex-col">
                    <div className="overflow-x-auto border-b border-border/70 bg-card px-4">
                      <TabsList className="h-11 w-max rounded-none bg-transparent p-0">
                        <TabsTrigger value="resumen" className="h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Resumen</TabsTrigger>
                        <TabsTrigger value="interacciones" className="h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Interacciones</TabsTrigger>
                        <TabsTrigger value="casos" className="h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Casos</TabsTrigger>
                        <TabsTrigger value="consentimiento" className="h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Consentimiento</TabsTrigger>
                      </TabsList>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                      <TabsContent value="resumen" className="m-0 p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <section className="rounded-xl border border-border/70 bg-card p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" />Resumen operativo</div>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                              {selectedPerson.resumen || selectedPerson.lastMessageExcerpt || selectedPerson.profileExcerpt || "Todavía no hay un resumen disponible. Se completa con actividad real del contacto."}
                            </p>
                          </section>
                          <section className="rounded-xl border border-border/70 bg-card p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Phone className="h-4 w-4 text-primary" />Datos de contacto</div>
                            <dl className="mt-3 space-y-3 text-sm">
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Teléfono</dt><dd className="font-medium">{selectedPerson.telefono || "Sin teléfono"}</dd></div>
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="max-w-[65%] truncate font-medium">{hasRealEmail(selectedPerson) ? selectedPerson.email : "Sin email real"}</dd></div>
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{hasExplicitWhatsApp(selectedPerson) ? "Canal explícito" : "No verificado"}</dd></div>
                            </dl>
                          </section>
                          <section className="rounded-xl border border-border/70 bg-card p-4 md:col-span-2">
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

          <div className="flex items-center justify-between border-t border-border/70 px-3 py-2 text-xs text-muted-foreground lg:hidden">
            <span>Deslizá la lista desde el selector de persona.</span>
            <div className="flex items-center gap-1"><ChevronLeft className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5" /></div>
          </div>
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
