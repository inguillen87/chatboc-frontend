import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Megaphone,
  MessageCircle,
  Maximize2,
  MoreHorizontal,
  Minimize2,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { CrmPeopleChannelFilter } from "./useCrmPeopleDirectory";
import {
  useCrmContactHistory,
  type CrmContactCase,
} from "./useCrmContactHistory";
import CrmPersonRecordRibbon from "./CrmPersonRecordRibbon";
import { ContactTasksEntry } from "@/features/crm/tasks/ContactTasks";
import { ContactFollowUpButton } from "@/features/crm/followup/ContactFollowUpDialog";
import {
  buildCrmOperationalSummary,
  type CrmOperationalSummary,
} from "./crmOperationalSummary";

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
  piiMasked?: boolean;
  possibleDuplicate?: boolean;
  directorySource?: string | null;
}

interface WorkspaceMetric {
  label: string;
  value: number | string;
  helper: string;
}

interface MetricSummaryProps {
  metrics: WorkspaceMetric[];
  className?: string;
  compact?: boolean;
  showHelper?: boolean;
  testId?: string;
}

const MetricSummary = ({
  metrics,
  className,
  compact = false,
  showHelper = true,
  testId,
}: MetricSummaryProps) => (
  <dl
    className={cn(
      "grid grid-cols-2",
      compact ? "gap-1.5" : "divide-x divide-border/70 md:grid-cols-4",
      className,
    )}
    data-testid={testId}
  >
    {metrics.slice(0, 4).map((metric) => (
      <div
        key={metric.label}
        className={cn(
          "min-w-0",
          compact
            ? "rounded-lg border border-border/70 bg-background/70 px-2.5 py-2"
            : "px-4 py-3",
        )}
      >
        <dt
          className={cn(
            "truncate font-semibold uppercase tracking-[0.12em] text-muted-foreground",
            compact ? "text-[9px] leading-3" : "text-[11px]",
          )}
        >
          {metric.label}
        </dt>
        <dd className={cn("font-bold tracking-tight", compact ? "mt-0.5 text-base" : "mt-1 text-2xl")}>
          {metric.value}
        </dd>
        {showHelper ? (
          <dd className={cn("truncate text-muted-foreground", compact ? "mt-0.5 text-[10px]" : "mt-0.5 text-xs")}>
            {metric.helper}
          </dd>
        ) : null}
      </div>
    ))}
  </dl>
);

interface CrmPeopleWorkspaceProps {
  embedded?: boolean;
  tenantSlug?: string | null;
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
  channelFilter?: CrmPeopleChannelFilter;
  onChannelFilterChange?: (value: CrmPeopleChannelFilter) => void;
  peopleTotal?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  directoryIsLegacy?: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onOpenTicketDesk: (exactHref: string) => void;
  isConnected: boolean;
  metrics: WorkspaceMetric[];
  getPersonKey: (person: CrmPeopleRecord) => string;
  hasRealEmail: (person: CrmPeopleRecord) => boolean;
  hasExplicitWhatsApp: (person: CrmPeopleRecord) => boolean;
  whatsappUrl: (person: CrmPeopleRecord) => string | null;
  dataQualityScore: (person: CrmPeopleRecord) => number;
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
  { value: "review", label: "Revisión de datos" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "complete", label: "Calidad alta" },
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

const caseValueLabel = (value?: string | null) => {
  const normalized = (value || "").trim();
  return normalized
    ? normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;
};

const caseSourceLabel = (caseItem: CrmContactCase) => {
  const labels = {
    TenantTicket: "Caso institucional",
    MunicipioTicket: "Reclamo municipal",
    PymeTicket: "Caso empresarial",
  } as const;
  return labels[caseItem.sourceModel];
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
  qualityScore: number;
  operationalSummary: CrmOperationalSummary;
  formatDate: (value?: string | null) => string;
}

const ContextPanel = ({ person, qualityScore, operationalSummary, formatDate }: ContextPanelProps) => (
  <div className="space-y-4" data-testid="crm-context-panel">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Estado Persona 360</p>
      <p className="mt-2 text-sm font-semibold leading-6">{operationalSummary.identityLabel}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Casos e interacciones se muestran únicamente cuando el backend publica relaciones exactas para este tenant.
      </p>
    </div>
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      {person.piiMasked ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-muted-foreground">Calidad de datos operativa</span>
          <Badge variant="outline">No evaluable · protegida</Badge>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-muted-foreground">Calidad de datos operativa</span>
            <span className="font-mono font-bold">{qualityScore}%</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Calidad de datos operativa de la persona"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={qualityScore}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${qualityScore}%` }} />
          </div>
        </>
      )}
    </div>
    <dl className="grid gap-2 text-sm">
      <div className="rounded-xl border border-border/70 p-3">
        <dt className="text-xs text-muted-foreground">Casos exactos</dt>
        <dd className="mt-1 font-semibold">{operationalSummary.casesLabel}</dd>
      </div>
      <div className="rounded-xl border border-border/70 p-3">
        <dt className="text-xs text-muted-foreground">Última interacción</dt>
        <dd className="mt-1 font-semibold">{formatDate(operationalSummary.latestEventAt)}</dd>
        <dd className="mt-0.5 text-xs text-muted-foreground">
          {operationalSummary.latestEventVerified
            ? `${channelLabel(operationalSummary.latestEventChannel)} · ${operationalSummary.latestEventSourceLabel}`
            : operationalSummary.latestEventSourceLabel}
        </dd>
      </div>
      <div className="rounded-xl border border-border/70 p-3">
        <dt className="text-xs text-muted-foreground">Responsable / SLA</dt>
        <dd className="mt-1 font-semibold">{operationalSummary.ownerLabel}</dd>
        <dd className="mt-0.5 text-xs text-muted-foreground">
          {operationalSummary.slaLabel}
          {operationalSummary.slaDueAt ? ` · ${formatDate(operationalSummary.slaDueAt)}` : ""}
        </dd>
      </div>
      <div className="rounded-xl border border-border/70 p-3">
        <dt className="text-xs text-muted-foreground">Consentimiento</dt>
        <dd className="mt-1 font-semibold">{operationalSummary.consentLabel}</dd>
      </div>
    </dl>
    <div className="rounded-xl border border-dashed border-border/70 p-3 text-xs leading-5 text-muted-foreground">
      {person.marketing
        ? "El directorio declara consentimiento; alcance, fecha y evidencia requieren un contrato versionado antes de habilitar acciones."
        : "No se interpreta la ausencia de un booleano como rechazo. Tampoco se habilita marketing sin evidencia publicada."}
    </div>
  </div>
);

interface RecordNavigatorProps {
  currentIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}

const RecordNavigator = ({
  currentIndex,
  total,
  onPrevious,
  onNext,
}: RecordNavigatorProps) => {
  const hasCurrent = currentIndex >= 0 && total > 0;
  const currentPosition = hasCurrent ? currentIndex + 1 : 0;

  return (
    <div
      className="flex h-8 shrink-0 items-center overflow-hidden rounded-lg border border-border/70 bg-background"
      role="group"
      aria-label="Navegar personas filtradas"
      data-testid="crm-person-record-navigator"
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-none border-r border-border/70"
        onClick={onPrevious}
        disabled={!hasCurrent || currentIndex === 0}
        aria-label="Persona anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span
        className="sr-only min-w-[4.5rem] px-2 text-center text-[11px] font-semibold tabular-nums text-muted-foreground sm:not-sr-only sm:block"
        aria-live="polite"
        aria-atomic="true"
      >
        {currentPosition} de {total}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-none border-l border-border/70"
        onClick={onNext}
        disabled={!hasCurrent || currentIndex >= total - 1}
        aria-label="Persona siguiente"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
};

export default function CrmPeopleWorkspace({
  embedded = false,
  tenantSlug,
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
  channelFilter = "all",
  onChannelFilterChange,
  peopleTotal = people.length,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  directoryIsLegacy = false,
  onRefresh,
  onBack,
  onOpenTicketDesk,
  isConnected,
  metrics,
  getPersonKey,
  hasRealEmail,
  hasExplicitWhatsApp,
  whatsappUrl,
  dataQualityScore,
  formatDate,
  copyToClipboard,
  segmentsPanel,
  campaignsPanel,
  activityPanel,
}: CrmPeopleWorkspaceProps) {
  const [contextOpen, setContextOpen] = React.useState(false);
  const [mobileContextOpen, setMobileContextOpen] = React.useState(false);
  const [detailFocusMode, setDetailFocusMode] = React.useState(false);
  const [activePersonTab, setActivePersonTab] = React.useState("resumen");
  const [caseActionLoading, setCaseActionLoading] = React.useState(false);

  const scoredPeople = React.useMemo(
    () => people.map((person) => ({ person, score: dataQualityScore(person) })),
    [dataQualityScore, people],
  );
  const effectivePeopleSort: CrmPeopleSort = hasMore ? "recent" : peopleSort;
  const queueViewCounts = React.useMemo(
    () => ({
      all: scoredPeople.length,
      review: scoredPeople.filter(({ person, score }) => person.piiMasked || score < 75).length,
      whatsapp: scoredPeople.filter(({ person }) => hasExplicitWhatsApp(person)).length,
      complete: scoredPeople.filter(({ person, score }) => !person.piiMasked && score >= 75).length,
    }),
    [hasExplicitWhatsApp, scoredPeople],
  );
  const visiblePeople = React.useMemo(() => {
    const filtered = scoredPeople.filter(({ person, score }) => {
      if (queueView === "review") return person.piiMasked || score < 75;
      if (queueView === "whatsapp") return hasExplicitWhatsApp(person);
      if (queueView === "complete") return !person.piiMasked && score >= 75;
      return true;
    });
    if (!hasMore) {
      filtered.sort((a, b) => {
        if (effectivePeopleSort === "name") return a.person.nombre.localeCompare(b.person.nombre, "es");
        if (effectivePeopleSort === "score-desc") return b.score - a.score;
        if (effectivePeopleSort === "score-asc") return a.score - b.score;
        const aTime = a.person.lastSeen ? Date.parse(a.person.lastSeen) : 0;
        const bTime = b.person.lastSeen ? Date.parse(b.person.lastSeen) : 0;
        if (aTime !== bTime) return bTime - aTime;
        return a.person.nombre.localeCompare(b.person.nombre, "es");
      });
    }
    return filtered.map(({ person }) => person);
  }, [effectivePeopleSort, hasExplicitWhatsApp, hasMore, queueView, scoredPeople]);

  const selectedPerson = React.useMemo(
    () => people.find((person) => getPersonKey(person) === selectedContactId) || null,
    [getPersonKey, people, selectedContactId],
  );
  const qualityScore = selectedPerson ? dataQualityScore(selectedPerson) : 0;
  const contactHistory = useCrmContactHistory({
    tenantSlug,
    contactId: selectedPerson?.contactId,
    enabled: activeView === "personas",
  });
  const operationalSummary = React.useMemo(
    () => selectedPerson
      ? buildCrmOperationalSummary({
        person: selectedPerson,
        history: contactHistory.data,
        isLoading: contactHistory.isLoading,
        error: contactHistory.error,
      })
      : null,
    [contactHistory.data, contactHistory.error, contactHistory.isLoading, selectedPerson],
  );
  const selectedCaseContactId = selectedPerson?.contactId || null;
  const selectedCaseScopeKey = selectedCaseContactId && tenantSlug
    ? `${tenantSlug.trim().toLowerCase()}:${selectedCaseContactId}`
    : null;
  const selectedCaseScopeKeyRef = React.useRef(selectedCaseScopeKey);
  selectedCaseScopeKeyRef.current = selectedCaseScopeKey;
  const exactCases = React.useMemo(
    () => contactHistory.data?.cases || [],
    [contactHistory.data?.cases],
  );
  const recentInteractions = React.useMemo(
    () => [...(contactHistory.data?.interactions || [])]
      .sort((a, b) => {
        const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
        const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      })
      .slice(0, 3),
    [contactHistory.data?.interactions],
  );
  const recentExactCases = React.useMemo(
    () => [...exactCases]
      .sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt ? Date.parse(a.updatedAt || a.createdAt || "") : 0;
        const bTime = b.updatedAt || b.createdAt ? Date.parse(b.updatedAt || b.createdAt || "") : 0;
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      })
      .slice(0, 3),
    [exactCases],
  );
  const casesContractVerified = contactHistory.data?.casesContractStatus === "verified";
  const hasVerifiedZeroCases = Boolean(
    casesContractVerified
      && contactHistory.data?.casesTotalIsExact
      && contactHistory.data.casesTotal === 0
      && contactHistory.data.casesRejected === 0
      && !contactHistory.data.casesTruncated,
  );
  const hasOneAuthoritativeCase = Boolean(
    casesContractVerified
      && contactHistory.data?.casesTotalIsExact
      && contactHistory.data.casesTotal === 1
      && exactCases.length === 1
      && contactHistory.data.casesRejected === 0
      && !contactHistory.data.casesTruncated,
  );
  const visibleCaseCountLabel = contactHistory.data?.casesTotalIsExact
    ? String(contactHistory.data.casesTotal)
    : `${exactCases.length}+`;
  const caseCountSummary = contactHistory.data?.casesRejected
    ? `${contactHistory.data.casesTotal} informados · ${exactCases.length} verificables`
    : contactHistory.data?.casesTotalIsExact
      ? `${contactHistory.data.casesTotal} exactos`
      : contactHistory.data?.casesTruncated
        ? `${exactCases.length} verificables · vista parcial`
        : `${exactCases.length}+ verificables`;
  const caseActionLabel = !selectedPerson?.contactId
    ? "Sin caso exacto"
    : caseActionLoading || contactHistory.isLoading
      ? "Verificando casos"
      : contactHistory.data && !casesContractVerified
        ? "Casos no disponibles"
        : hasVerifiedZeroCases
          ? "Sin caso exacto"
          : hasOneAuthoritativeCase
            ? "Abrir caso"
            : casesContractVerified && (exactCases.length > 0 || (contactHistory.data?.casesTotal || 0) > 0)
              ? `Ver ${visibleCaseCountLabel} casos`
              : casesContractVerified
                ? "Revisar vínculos"
              : "Ver casos";
  const caseActionDisabled = Boolean(
    !selectedPerson?.contactId
      || caseActionLoading
      || contactHistory.isLoading
      || (contactHistory.data && (!casesContractVerified || hasVerifiedZeroCases)),
  );
  const handleCaseAction = React.useCallback(async () => {
    const requestedScopeKey = selectedCaseScopeKey;
    if (!requestedScopeKey) {
      setActivePersonTab("casos");
      return;
    }
    setCaseActionLoading(true);
    try {
      const history = contactHistory.data || (await contactHistory.refetch()).data || null;
      if (selectedCaseScopeKeyRef.current !== requestedScopeKey) return;
      const canOpenOnlyCase = history?.casesContractStatus === "verified"
        && history.casesTotalIsExact
        && history.casesTotal === 1
        && history.cases.length === 1
        && history.casesRejected === 0
        && !history.casesTruncated;
      if (canOpenOnlyCase) {
        onOpenTicketDesk(history.cases[0].href);
        return;
      }
      setActivePersonTab("casos");
    } finally {
      setCaseActionLoading(false);
    }
  }, [contactHistory.data, contactHistory.refetch, onOpenTicketDesk, selectedCaseScopeKey]);
  const listViewportRef = React.useRef<HTMLDivElement>(null);
  const desktopList = useVirtualizer({
    count: visiblePeople.length,
    getScrollElement: () => listViewportRef.current,
    estimateSize: () => 98,
    overscan: 8,
    initialRect: { width: 320, height: 760 },
  });
  const selectedVisibleIndex = React.useMemo(
    () => visiblePeople.findIndex((person) => getPersonKey(person) === selectedContactId),
    [getPersonKey, selectedContactId, visiblePeople],
  );
  const navigateVisiblePerson = React.useCallback((offset: -1 | 1) => {
    const nextIndex = selectedVisibleIndex + offset;
    const nextPerson = visiblePeople[nextIndex];
    if (!nextPerson) return;

    onSelectContact(getPersonKey(nextPerson));
    desktopList.scrollToIndex(nextIndex, { align: "auto" });
  }, [desktopList, getPersonKey, onSelectContact, selectedVisibleIndex, visiblePeople]);
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
    // Preserve an explicit deep link while more cursor pages may still contain
    // the resolvable contact. Automatic selection only applies to an empty URL.
    if (!selectionIsVisible && (!selectedContactId || !hasMore)) onSelectContact(getPersonKey(visiblePeople[0]));
  }, [activeView, getPersonKey, hasMore, onSelectContact, selectedContactId, visiblePeople]);

  React.useEffect(() => {
    if (activeView !== "personas") setDetailFocusMode(false);
  }, [activeView]);

  React.useEffect(() => {
    if (hasMore && peopleSort !== "recent") onPeopleSortChange("recent");
  }, [hasMore, onPeopleSortChange, peopleSort]);

  React.useEffect(() => {
    if (!detailFocusMode) return undefined;
    const exitFocusMode = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && event.key === "Escape") setDetailFocusMode(false);
    };
    document.addEventListener("keydown", exitFocusMode);
    return () => document.removeEventListener("keydown", exitFocusMode);
  }, [detailFocusMode]);

  const visibleIds = React.useMemo(
    () => visiblePeople.filter((person) => !person.piiMasked).map((person) => person.id),
    [visiblePeople],
  );
  const selectedVisibleCount = React.useMemo(
    () => visiblePeople.filter((person) => !person.piiMasked && selectedIds.has(String(person.id))).length,
    [selectedIds, visiblePeople],
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

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
          <div className={cn("min-w-0", embedded && "shrink-0")}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">CRM municipal</p>
              <Badge
                variant={isConnected ? "default" : "outline"}
                className={cn("gap-1.5", embedded && "px-1.5 sm:px-2.5")}
                aria-label={isConnected ? "Transporte de eventos conectado" : "Actualización manual disponible"}
              >
                <Activity className="h-3 w-3" />
                <span className={cn(embedded && "sr-only sm:not-sr-only")}>
                  {isConnected ? "Transporte conectado" : "Actualización manual"}
                </span>
              </Badge>
            </div>
            <h1 className={cn("mt-1 font-bold tracking-tight", embedded ? "text-base sm:text-lg md:text-xl" : "text-xl md:text-2xl")}>Personas y relaciones</h1>
            <p className={cn("mt-1 text-sm text-muted-foreground", embedded && "hidden")}>Vista operativa compacta para encontrar, entender y actuar sobre cada contacto.</p>
          </div>
          {embedded ? (
            <MetricSummary
              metrics={metrics}
              compact
              showHelper={false}
              className="mx-3 hidden min-w-0 flex-1 grid-cols-4 2xl:grid"
              testId="crm-overview-metrics-inline"
            />
          ) : null}
          <div className={cn("flex flex-wrap items-center gap-2", embedded && "shrink-0 gap-1 sm:gap-2")}>
            {embedded ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 gap-2 p-0 sm:w-auto sm:px-3 2xl:hidden"
                    aria-label="Ver indicadores CRM"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only">Indicadores</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Resumen del directorio
                  </p>
                  <MetricSummary
                    metrics={metrics}
                    compact
                    testId="crm-overview-metrics-popover"
                  />
                </PopoverContent>
              </Popover>
            ) : null}
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

        {!embedded ? (
          <MetricSummary metrics={metrics} testId="crm-overview-metrics" />
        ) : null}
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
              <Select
                value={channelFilter}
                onValueChange={(value) => onChannelFilterChange?.(value as CrmPeopleChannelFilter)}
                disabled={!onChannelFilterChange}
              >
                <SelectTrigger className={cn("bg-background", embedded ? "h-8 w-[132px] text-xs sm:h-9" : "h-9 w-[160px]")} aria-label="Filtrar personas por canal">
                  <SelectValue placeholder="Todos los canales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los canales</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="widget">Widget</SelectItem>
                  <SelectItem value="voice">Voz</SelectItem>
                  <SelectItem value="unknown">Sin canal</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline">
                {visiblePeople.length === people.length
                  ? !hasMore && peopleTotal === people.length
                    ? `${people.length} resultados`
                    : `${people.length} de ${peopleTotal}`
                  : !hasMore && peopleTotal === people.length
                    ? `${visiblePeople.length} de ${people.length}`
                    : `${visiblePeople.length} visibles · ${people.length} cargadas`}
              </Badge>
              {directoryIsLegacy ? <Badge variant="outline">Compatibilidad heredada</Badge> : null}
              {hasMore && onLoadMore ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("gap-2", embedded && "h-8")}
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoadingMore && "animate-spin")} />
                  {isLoadingMore ? "Cargando" : "Cargar más"}
                </Button>
              ) : null}
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
            <div className={cn("min-w-0 items-center gap-1 overflow-x-auto", embedded ? "hidden sm:flex" : "flex")} role="group" aria-label={hasMore ? `Vistas operativas sobre ${people.length} personas cargadas` : "Vistas operativas de personas"}>
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
            {hasMore ? <Badge variant="outline" className="shrink-0">Vistas sobre {people.length} cargadas</Badge> : null}
            <div className={cn("items-center gap-2", embedded ? "grid grid-cols-2 sm:flex" : "flex flex-wrap")}>
              <label className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 text-xs">
                <Checkbox
                  checked={allVisibleSelected ? true : selectedVisibleCount > 0 ? "indeterminate" : false}
                  onCheckedChange={(checked) => onSetSelected(visibleIds, Boolean(checked))}
                  aria-label="Seleccionar personas visibles"
                  disabled={visibleIds.length === 0}
                />
                Seleccionar vista
              </label>
              <Select value={effectivePeopleSort} onValueChange={(value) => onPeopleSortChange(value as CrmPeopleSort)} disabled={hasMore}>
                <SelectTrigger
                  className={cn("h-8 bg-background text-xs", embedded ? "w-full sm:w-[178px]" : "w-[178px]")}
                  aria-label={hasMore ? `Orden backend por actividad reciente sobre ${people.length} personas cargadas` : "Ordenar personas"}
                  title={hasMore ? "Nombre y calidad se habilitan al completar la carga del directorio." : undefined}
                >
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Actividad reciente</SelectItem>
                  <SelectItem value="name">Nombre A–Z</SelectItem>
                  <SelectItem value="score-desc">Mayor calidad de datos</SelectItem>
                  <SelectItem value="score-asc">Menor calidad de datos</SelectItem>
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
              detailFocusMode
                ? "lg:grid-cols-1"
                : contextOpen
                  ? "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_280px]"
                  : "lg:grid-cols-[320px_minmax(0,1fr)]",
            )}
            data-testid="crm-people-grid"
            data-focus-mode={detailFocusMode ? "detail" : "split"}
          >
            {!detailFocusMode ? (
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
                        const personScore = dataQualityScore(person);
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
                                aria-label={person.piiMasked ? `Datos protegidos: ${person.nombre} no es seleccionable` : `Seleccionar ${person.nombre}`}
                                disabled={person.piiMasked}
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
                                  {person.piiMasked ? (
                                    <span className="rounded-full border border-blue-500/30 bg-blue-500/5 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300" aria-label="Calidad de datos no evaluable por protección">
                                      Protegida
                                    </span>
                                  ) : (
                                    <span
                                      className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold", selectedTone(personScore))}
                                      aria-label={`Calidad de datos ${personScore}%`}
                                    >
                                      {personScore}%
                                    </span>
                                  )}
                                </span>
                                {person.piiMasked || person.possibleDuplicate ? (
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {person.piiMasked ? <Badge variant="outline" className="h-5 px-1.5 text-[9px]">Datos protegidos</Badge> : null}
                                    {person.possibleDuplicate ? <Badge variant="outline" className="h-5 border-amber-500/40 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">Revisar identidad</Badge> : null}
                                  </span>
                                ) : null}
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
            ) : null}

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
                            {selectedPerson.piiMasked ? <Badge variant="outline">Datos protegidos</Badge> : null}
                            {selectedPerson.possibleDuplicate ? <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">Revisar identidad</Badge> : null}
                            {selectedPerson.piiMasked ? (
                              <Badge variant="outline" className="shrink-0 border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300">Calidad no evaluable</Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn("shrink-0", selectedTone(qualityScore), embedded && "px-1.5 text-[10px] sm:px-2.5 sm:text-xs")}
                                aria-label={`Calidad de datos ${qualityScore}%`}
                              >
                                Calidad {qualityScore}%
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{selectedPerson.motivo || intentLabel(selectedPerson.lastIntent)}</p>
                        </div>
                      </div>
                      <div className={cn("flex flex-wrap items-center gap-2", embedded && "shrink-0 gap-1 sm:gap-2")}>
                        {tenantSlug && selectedPerson.contactId && !selectedPerson.piiMasked && !selectedPerson.possibleDuplicate && (
                          <ContactFollowUpButton key={JSON.stringify([tenantSlug,selectedPerson.contactId])} identity={{tenantSlug,contactId:selectedPerson.contactId}} onSaved={() => void contactHistory.refetch()} />
                        )}
                        {tenantSlug && selectedPerson.contactId && !selectedPerson.piiMasked && !selectedPerson.possibleDuplicate && <ContactTasksEntry key={JSON.stringify([tenantSlug,selectedPerson.contactId])} identity={{tenantSlug,contactId:selectedPerson.contactId}} />}
                        <RecordNavigator
                          currentIndex={selectedVisibleIndex}
                          total={visiblePeople.length}
                          onPrevious={() => navigateVisiblePerson(-1)}
                          onNext={() => navigateVisiblePerson(1)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant={detailFocusMode ? "secondary" : "outline"}
                          className={cn("hidden gap-2 lg:inline-flex", embedded && "h-8 w-8 p-0 2xl:w-auto 2xl:px-3")}
                          onClick={() => setDetailFocusMode((current) => !current)}
                          aria-label={detailFocusMode ? "Volver a vista dividida" : "Ampliar ficha de la persona"}
                          aria-pressed={detailFocusMode}
                        >
                          {detailFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                          <span className={cn(embedded && "sr-only 2xl:not-sr-only")}>
                            {detailFocusMode ? "Vista dividida" : "Ampliar ficha"}
                          </span>
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
                            <DropdownMenuItem
                              disabled={caseActionDisabled}
                              onSelect={() => void handleCaseAction()}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              {caseActionLabel}
                            </DropdownMenuItem>
                            {!selectedPerson.piiMasked && selectedPerson.telefono ? (
                              <DropdownMenuItem onSelect={() => copyToClipboard(selectedPerson.telefono, "Teléfono")}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar teléfono
                              </DropdownMenuItem>
                            ) : null}
                            {!selectedPerson.piiMasked && hasRealEmail(selectedPerson) ? (
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

                  {operationalSummary && !selectedPerson.piiMasked ? (
                    <CrmPersonRecordRibbon
                      qualityScore={qualityScore}
                      summary={operationalSummary}
                      caseActionLabel={caseActionLabel}
                      caseActionDisabled={caseActionDisabled}
                      caseActionLoading={caseActionLoading || contactHistory.isLoading}
                      onCaseAction={() => void handleCaseAction()}
                      onOpenDetails={() => setMobileContextOpen(true)}
                      formatDate={formatDate}
                      formatChannel={channelLabel}
                    />
                  ) : null}

                  <Tabs
                    value={activePersonTab}
                    onValueChange={setActivePersonTab}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div
                      className={cn("border-b border-border/70 bg-card", embedded ? "overflow-hidden px-1 sm:overflow-x-auto sm:px-4" : "overflow-x-auto px-4")}
                      data-testid="crm-person-tabs"
                    >
                      <TabsList className={cn("rounded-none bg-transparent p-0", embedded ? "grid h-10 w-full grid-cols-4 sm:flex sm:h-11 sm:w-max" : "h-11 w-max")}>
                        <TabsTrigger value="resumen" className={cn("rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>Resumen</TabsTrigger>
                        <TabsTrigger value="interacciones" className={cn("rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>Interacciones</TabsTrigger>
                        <TabsTrigger value="casos" className={cn("gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>
                          Casos
                          {casesContractVerified && exactCases.length > 0 ? (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              {exactCases.length}
                            </span>
                          ) : null}
                        </TabsTrigger>
                        <TabsTrigger value="consentimiento" className={cn("rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none", embedded ? "h-10 min-w-0 px-1 text-[10px] sm:h-11 sm:px-3 sm:text-sm" : "h-11")}>Consentimiento</TabsTrigger>
                      </TabsList>
                    </div>
                    <ScrollArea className="min-h-0 flex-1" data-testid="crm-person-scroll">
                      <TabsContent value="resumen" className={cn("m-0", embedded ? "p-2 sm:p-4" : "p-4")}>
                        <div className="grid gap-3 md:grid-cols-2">
                          {selectedPerson.piiMasked ? (
                            <section className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 md:col-span-2" role="status">
                              <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Datos protegidos · detalle requiere permiso</div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                El directorio muestra campos enmascarados. No se consulta historial, no se abren casos y no se habilitan acciones usando nombre, teléfono o email aproximados.
                              </p>
                            </section>
                          ) : null}
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
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="max-w-[65%] truncate font-medium">{selectedPerson.piiMasked ? selectedPerson.email : hasRealEmail(selectedPerson) ? selectedPerson.email : "Sin email real"}</dd></div>
                              <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-medium">{selectedPerson.piiMasked ? "Dato protegido" : hasExplicitWhatsApp(selectedPerson) ? "Canal explícito" : "No verificado"}</dd></div>
                            </dl>
                          </section>
                          <section
                            className={cn("rounded-xl border border-border/70 bg-card md:col-span-2", embedded ? "p-3 sm:p-4" : "p-4")}
                            aria-label="Actividad y casos exactos de la persona"
                            aria-busy={contactHistory.isLoading || contactHistory.isFetching}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <Activity className="h-4 w-4 text-primary" />
                                Actividad y casos vinculados
                              </div>
                              <Badge variant="outline">
                                {!selectedPerson.contactId
                                  ? "Identidad pendiente"
                                  : contactHistory.isLoading
                                    ? "Verificando"
                                    : operationalSummary?.casesLabel || "No disponible"}
                              </Badge>
                            </div>

                            {!selectedPerson.contactId ? (
                              <p className="mt-3 text-sm text-muted-foreground" role="status">
                                {selectedPerson.piiMasked
                                  ? "Datos protegidos: el directorio no publicó una identidad resoluble. El detalle requiere permiso."
                                  : "El registro no tiene una identidad persistida. No se buscan casos por nombre, teléfono ni email."}
                              </p>
                            ) : contactHistory.isLoading ? (
                              <div className="mt-3 grid gap-3 md:grid-cols-2" aria-label="Cargando Persona 360">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                              </div>
                            ) : contactHistory.error ? (
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
                                <p className="text-sm text-muted-foreground">No se pudo verificar el historial exacto.</p>
                                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void contactHistory.refetch()}>
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  Reintentar
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="min-w-0 rounded-lg border border-border/60 bg-background/40 p-3">
                                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Últimos eventos</h3>
                                  {recentInteractions.length ? (
                                    <ol className="mt-2 divide-y divide-border/60">
                                      {recentInteractions.map((interaction, index) => (
                                        <li key={`${interaction.timestamp || "sin-fecha"}-${index}`} className="py-2 first:pt-0 last:pb-0">
                                          <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
                                            <span className="truncate font-semibold">{channelLabel(interaction.channel)}</span>
                                            <time className="shrink-0 text-muted-foreground">{formatDate(interaction.timestamp)}</time>
                                          </div>
                                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{interaction.content}</p>
                                        </li>
                                      ))}
                                    </ol>
                                  ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">Sin eventos publicados para esta identidad.</p>
                                  )}
                                </div>
                                <div className="min-w-0 rounded-lg border border-border/60 bg-background/40 p-3">
                                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Casos exactos recientes</h3>
                                  {contactHistory.data?.casesContractStatus !== "verified" ? (
                                    <p className="mt-2 text-xs text-muted-foreground">El backend no publicó un contrato exacto compatible.</p>
                                  ) : recentExactCases.length ? (
                                    <ul className="mt-2 divide-y divide-border/60">
                                      {recentExactCases.map((caseItem) => (
                                        <li key={caseItem.caseKey} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                                          <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold">{caseItem.title}</p>
                                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                              {caseItem.status ? caseValueLabel(caseItem.status) : "Estado no informado"}
                                              {caseItem.assigneeName ? ` · ${caseItem.assigneeName}` : ""}
                                            </p>
                                          </div>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 shrink-0 px-2 text-xs"
                                            onClick={() => onOpenTicketDesk(caseItem.href)}
                                            aria-label={`Abrir caso ${caseItem.title}`}
                                          >
                                            Abrir
                                          </Button>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">Sin caso exacto asociado.</p>
                                  )}
                                </div>
                              </div>
                            )}
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
                        <section
                          className="rounded-xl border border-border/70 bg-card p-4"
                          aria-busy={contactHistory.isLoading}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-semibold">Historial multicanal</h3>
                            <Badge variant="outline">
                              {!selectedPerson.contactId
                                ? "Sin vínculo"
                                : contactHistory.isLoading
                                  ? "Cargando…"
                                  : contactHistory.error
                                    ? "No disponible"
                                    : `${contactHistory.data?.interactions.length || 0}${
                                      Number(selectedPerson.interactionCount || 0) > (contactHistory.data?.interactions.length || 0)
                                        ? ` de ${selectedPerson.interactionCount}`
                                        : ""
                                    } interacciones`}
                            </Badge>
                          </div>

                          {!selectedPerson.contactId ? (
                            <div className="mt-4 rounded-xl border border-dashed border-border/70 p-4" role="status">
                              <p className="text-sm font-semibold">{selectedPerson.piiMasked ? "Datos protegidos" : "Historial detallado no disponible"}</p>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                {selectedPerson.piiMasked
                                  ? "El detalle requiere permiso y una identidad resoluble publicada por el backend. No se inventan eventos para completar la vista."
                                  : "Este registro heredado todavía no tiene una identidad de contacto vinculada. No se inventan eventos para completar la vista."}
                              </p>
                            </div>
                          ) : contactHistory.isLoading ? (
                            <div className="mt-4 space-y-4" aria-label="Cargando historial multicanal">
                              {[0, 1, 2].map((item) => (
                                <div key={item} className="space-y-2 rounded-xl border border-border/60 p-3">
                                  <Skeleton className="h-4 w-36" />
                                  <Skeleton className="h-3 w-52" />
                                  <Skeleton className="h-4 w-full" />
                                </div>
                              ))}
                            </div>
                          ) : contactHistory.error ? (
                            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
                              <p className="text-sm font-semibold">No pudimos cargar el historial</p>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">{contactHistory.error}</p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-3 gap-2"
                                onClick={() => void contactHistory.refetch()}
                              >
                                <RefreshCw className={cn("h-4 w-4", contactHistory.isFetching && "animate-spin")} />
                                Reintentar
                              </Button>
                            </div>
                          ) : contactHistory.data?.interactions.length ? (
                            <ol className="mt-4 border-l border-border/70 pl-4" aria-label="Eventos del contacto">
                              {contactHistory.data.interactions.map((interaction, index) => {
                                const direction = (interaction.direction || "").toLowerCase();
                                const directionLabel = direction === "inbound"
                                  ? "Entrante"
                                  : direction === "outbound"
                                    ? "Saliente"
                                    : "Registro";
                                return (
                                  <li
                                    key={`${interaction.timestamp || "sin-fecha"}-${interaction.channel || "sin-canal"}-${index}`}
                                    className="relative pb-5 last:pb-0"
                                  >
                                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold">{directionLabel}</p>
                                      <Badge variant="secondary">{channelLabel(interaction.channel)}</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(interaction.timestamp)}</p>
                                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                                      {interaction.content}
                                    </p>
                                  </li>
                                );
                              })}
                            </ol>
                          ) : (
                            <div className="mt-4 rounded-xl border border-dashed border-border/70 p-4" role="status">
                              <p className="text-sm font-semibold">Sin eventos publicados</p>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                El backend no devolvió interacciones para esta persona. La fecha de alta y el resumen permanecen disponibles en la ficha.
                              </p>
                            </div>
                          )}
                        </section>
                      </TabsContent>
                      <TabsContent value="casos" className="m-0 p-4">
                        <section
                          className="rounded-xl border border-border/70 bg-card p-4"
                          aria-busy={contactHistory.isLoading || contactHistory.isFetching}
                          aria-label="Casos exactos del contacto"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 font-semibold">
                                <FileText className="h-4 w-4 text-primary" />
                                Casos y solicitudes
                              </div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Solo relaciones exactas publicadas por el backend para este tenant.
                              </p>
                            </div>
                            {casesContractVerified ? (
                              <Badge variant="outline">
                                {caseCountSummary}
                              </Badge>
                            ) : null}
                          </div>

                          {!selectedPerson.contactId ? (
                            <div className="mt-4 rounded-xl border border-dashed border-border/70 p-4">
                              <p className="text-sm font-semibold">{selectedPerson.piiMasked ? "Datos protegidos" : "Sin identidad CRM verificable"}</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {selectedPerson.piiMasked
                                  ? "El detalle requiere permiso. No se buscan casos por nombre, teléfono ni email enmascarados."
                                  : "No se buscan casos por nombre, teléfono ni email. Este registro necesita una identidad de contacto persistida."}
                              </p>
                            </div>
                          ) : contactHistory.isLoading ? (
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <Skeleton className="h-28 w-full" />
                              <Skeleton className="h-28 w-full" />
                            </div>
                          ) : contactHistory.error ? (
                            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
                              <p className="text-sm font-semibold">No pudimos verificar los casos</p>
                              <p className="mt-1 text-xs text-muted-foreground">{contactHistory.error}</p>
                              <Button className="mt-3 gap-2" size="sm" variant="outline" onClick={() => void contactHistory.refetch()}>
                                <RefreshCw className="h-4 w-4" />
                                Reintentar
                              </Button>
                            </div>
                          ) : !contactHistory.data ? (
                            <p className="mt-4 text-sm text-muted-foreground">Verificando relaciones exactas...</p>
                          ) : contactHistory.data.casesContractStatus !== "verified" ? (
                            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                              <p className="text-sm font-semibold">Casos exactos no disponibles</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                El backend no publicó el contrato crm.contact_cases.v1. No se realiza ninguna búsqueda aproximada.
                              </p>
                            </div>
                          ) : hasVerifiedZeroCases ? (
                            <div className="mt-4 rounded-xl border border-dashed border-border/70 p-4">
                              <p className="text-sm font-semibold">Sin caso exacto asociado</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                No existe una relación persistida por identidad de ticket para este contacto.
                              </p>
                            </div>
                          ) : exactCases.length === 0 ? (
                            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                              <p className="text-sm font-semibold">Vínculos parciales sin apertura segura</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                El backend informó referencias truncadas, inexactas o inválidas. No se abre ningún caso hasta contar con una identidad verificable.
                              </p>
                            </div>
                          ) : (
                            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                              {exactCases.map((caseItem) => (
                                <article
                                  key={caseItem.caseKey}
                                  className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-background/60 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                                        {caseSourceLabel(caseItem)}
                                      </p>
                                      <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{caseItem.title}</h3>
                                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                        {caseItem.sourceModel} · #{caseItem.ticketId}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 shrink-0 gap-1.5"
                                      aria-label={`Abrir caso ${caseItem.title}`}
                                      onClick={() => onOpenTicketDesk(caseItem.href)}
                                    >
                                      Abrir
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {caseItem.category ? <Badge variant="secondary">{caseValueLabel(caseItem.category)}</Badge> : null}
                                    {caseItem.status ? <Badge variant="outline">{caseValueLabel(caseItem.status)}</Badge> : null}
                                    {caseItem.channel ? <Badge variant="outline">{channelLabel(caseItem.channel)}</Badge> : null}
                                  </div>
                                  <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
                                    Última actividad: {formatDate(caseItem.updatedAt || caseItem.createdAt)}
                                  </p>
                                </article>
                              ))}
                            </div>
                          )}

                          {contactHistory.data?.casesRejected ? (
                            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                              {contactHistory.data.casesRejected} referencia(s) inválida(s) fueron descartadas de forma segura.
                            </p>
                          ) : null}
                          {contactHistory.data?.casesTruncated ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              La vista está limitada por el backend. Abrí el centro de reclamos para consultar el resto.
                            </p>
                          ) : null}
                        </section>
                      </TabsContent>
                      <TabsContent value="consentimiento" className="m-0 p-4">
                        <section className="rounded-xl border border-border/70 bg-card p-4">
                          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Privacidad y permisos</div>
                          {selectedPerson.piiMasked ? (
                            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
                              <div><p className="text-sm font-semibold">Datos personales</p><p className="text-xs text-muted-foreground">El directorio aplicó enmascaramiento por defecto; esta vista no solicitó PII completa.</p></div>
                              <Badge variant="outline">Protegidos</Badge>
                            </div>
                          ) : null}
                          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3">
                            <div>
                              <p className="text-sm font-semibold">Marketing</p>
                              <p className="text-xs text-muted-foreground">
                                {selectedPerson.marketing
                                  ? "El directorio declara consentimiento; alcance, fecha y evidencia no están publicados en este contrato."
                                  : "No se publicó evidencia de consentimiento ni de rechazo."}
                              </p>
                            </div>
                            <Badge variant={selectedPerson.marketing ? "default" : "outline"}>
                              {selectedPerson.marketing ? "Declarado sin trazabilidad" : "Sin evidencia publicada"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"><div><p className="text-sm font-semibold">Canal WhatsApp</p><p className="text-xs text-muted-foreground">No se infiere a partir de un teléfono genérico.</p></div><Badge variant={hasExplicitWhatsApp(selectedPerson) ? "default" : "outline"}>{hasExplicitWhatsApp(selectedPerson) ? "Explícito" : "No verificado"}</Badge></div>
                        </section>
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
                </div>
              )}
            </div>

            {!detailFocusMode && contextOpen && selectedPerson ? (
              <aside className="hidden min-h-0 border-l border-border/70 bg-card xl:block" aria-label="Panel contextual">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    {operationalSummary ? (
                      <ContextPanel
                        person={selectedPerson}
                        qualityScore={qualityScore}
                        operationalSummary={operationalSummary}
                        formatDate={formatDate}
                      />
                    ) : null}
                  </div>
                </ScrollArea>
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
            <SheetDescription>Identidad, casos exactos, actividad, SLA y evidencia disponible.</SheetDescription>
          </SheetHeader>
          {selectedPerson && operationalSummary ? (
            <div className="mt-6">
              <ContextPanel
                person={selectedPerson}
                qualityScore={qualityScore}
                operationalSummary={operationalSummary}
                formatDate={formatDate}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
