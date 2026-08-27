import React, {
  useEffect,
  useState,
  useCallback,
  FormEvent,
  useRef,
  useMemo,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  UploadCloud,
  CheckCircle,
  XCircle,
  Check,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  Settings2, // Icono para configurar formatos
  PlusCircle, // Icono para crear nuevo
  Trash2, // Icono para eliminar
  Edit3, // Icono para editar
  FileCog, // Icono general para formatos/mapeos
  Wand2, // Icono para sugerencias
  Loader2, // Icono de carga
  Megaphone, // Icono para promociones
  ArrowRight,
  BarChart3,
  Clock3,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Package,
  Sparkles,
  UserCog,
  Users,
  Vote,
} from "lucide-react";
import { EventForm } from "@/components/admin/EventForm";
import { PromotionForm, PromotionFormValues } from "@/components/admin/PromotionForm";
import { AgendaPasteForm } from "@/components/admin/AgendaPasteForm";
import MunicipioIcon from "@/components/ui/MunicipioIcon";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import BackofficeCommandCenter from '@/components/backoffice/BackofficeCommandCenter';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import type { ChannelActivationContract } from '@/api/v2/channelActivation';
import PlanUsagePanel from '@/components/profile/PlanUsagePanel';
import ProfileWorkspaceNavigation, {
  resolveProfileWorkspaceCapabilities,
  type ProfileWorkspaceTabValue,
} from '@/components/profile/ProfileWorkspaceNavigation';
import InstitutionProfileWorkspace, {
  normalizeInstitutionProfileSection,
  type InstitutionProfileSection,
} from '@/components/profile/InstitutionProfileWorkspace';
import { FEATURE_ENCUESTAS } from '@/config/featureFlags';
import { getTicketStats, getHeatmapDataset, HeatmapDataset } from "@/services/statsService";
import AnalyticsHeatmap from "@/components/analytics/Heatmap";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import MiniChatWidgetPreview from "@/components/ui/MiniChatWidgetPreview"; // Importar el nuevo componente
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useUser } from "@/hooks/useUser";
import IdentityAvatar from "@/components/identity/IdentityAvatar";
import { normalizeRole } from "@/utils/roles";
import { useMunicipalPosts } from "@/hooks/useMunicipalPosts";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { hasAuthenticatedChatbocSession } from "@/utils/sessionLogout";
import { TENANT_ROUTE_PREFIXES } from "@/utils/tenantPaths";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { apiFetch, getErrorMessage, ApiError } from "@/utils/api"; // Importa apiFetch y getErrorMessage
import { buildLoginPathWithNext } from "@/utils/authRedirect";
import { toLocalISOString } from "@/utils/fecha";
import { fmtAR } from "@/utils/date";
import { suggestMappings, SystemField, DEFAULT_SYSTEM_FIELDS } from "@/utils/columnMatcher";
import Papa from 'papaparse';
import { TicketStatsResponse, HeatPoint } from "@/services/statsService";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import MapLibreMap from "@/components/LazyMapLibreMap";
import {
  CatalogVectorSyncStatus,
  fetchCatalogVectorSyncStatus,
} from '@/services/catalogService';
import { requestDocumentPreview } from '@/services/documentIntelligenceService';
import { mergeAndSortStrings } from '@/utils/collections';
import ImportWizard from "@/components/catalog/ImportWizard";
import { resolveConsentedAvatar } from "@/utils/avatarConsent";
import { uploadProfileAvatar } from "@/services/profileAvatarService";
import {
  normalizeOperationalTenantSlug,
  resolveOperationalTenantSlug,
} from "@/utils/tenantIdentity";

const TicketsPanel = React.lazy(() => import('@/pages/TicketsPanel'));
const EstadisticasPage = React.lazy(() => import('@/pages/EstadisticasPage'));
const AnalyticsPage = React.lazy(() => import('@/pages/analytics/AnalyticsPage'));
const UsuariosPage = React.lazy(() => import('@/pages/UsuariosPage'));
const SmartPedidosWrapper = React.lazy(() => import('@/pages/SmartPedidosWrapper'));
const InternalUsers = React.lazy(() => import('@/pages/InternalUsers'));
const IncidentsMap = React.lazy(() => import('@/pages/IncidentsMap'));
const CatalogManagementPage = React.lazy(() => import('@/pages/admin/CatalogManagementPage'));

const ProfileTabFallback = ({ label = "Cargando modulo operativo..." }: { label?: string }) => (
  <div className="flex min-h-[320px] w-full items-center justify-center rounded-xl border border-border/70 bg-card/80 p-6 text-center">
    <div>
      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">Preparando la vista sin bloquear el resto del panel.</p>
    </div>
  </div>
);


// Durante el desarrollo usamos "/api" para evitar problemas de CORS.
// Por defecto, usa esa ruta si no se proporciona ninguna variable de entorno.
const PROVINCIAS = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

const MODAL_PREVIEW_ROWS = 6;

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const slugify = (value?: string | number | null) => {
  if (!value) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
};

const titleCaseFromSlug = (value?: string | number | null) => {
  const slug = slugify(value);
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const resolvePanelDisplayName = (user: any, tenantSlug?: string | null) => {
  const direct =
    user?.nombre_empresa ||
    user?.empresa ||
    user?.tenant?.nombre ||
    user?.tenant?.name ||
    user?.tenant?.display_name ||
    user?.name;

  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const fallbackName = titleCaseFromSlug(tenantSlug || user?.tenant_slug || user?.tenantSlug);
  if (fallbackName && user?.tipo_chat === "municipio") {
    return `Municipalidad de ${fallbackName}`;
  }

  return fallbackName;
};

const humanizeDocumentSource = (value?: string | null): string => {
  if (!value) return 'documento';
  const normalized = value.toLowerCase();
  switch (normalized) {
    case 'pdf':
      return 'PDF';
    case 'excel':
    case 'xls':
    case 'xlsx':
      return 'Excel';
    case 'csv':
      return 'CSV';
    case 'image':
      return 'Imagen';
    case 'audio':
      return 'Audio';
    case 'text':
      return 'Texto';
    default:
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
};

const buildPreviewRecords = (columns: string[], rows: any[]): Record<string, string>[] => {
  if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => {
    const normalizedRow: Record<string, string> = {};

    columns.forEach((columnName, columnIndex) => {
      if (!columnName) {
        return;
      }

      let value: unknown = '';
      if (Array.isArray(row)) {
        value = row[columnIndex];
      } else if (row && typeof row === 'object' && columnName in row) {
        value = (row as Record<string, unknown>)[columnName];
      }

      normalizedRow[columnName] =
        value === null || value === undefined || value === ''
          ? ''
          : String(value);
    });

    return normalizedRow;
  });
};
const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];


type ProfileTabValue = ProfileWorkspaceTabValue;

const PROFILE_TAB_VALUES = new Set<ProfileTabValue>([
  "perfil",
  "tickets",
  "pedidos",
  "estadisticas",
  "analytics",
  "catalogo",
  "usuarios",
  "empleados",
  "mapas",
]);

const normalizeProfileTabValue = (value: string | null): ProfileTabValue | null => {
  if (!value) return null;
  return PROFILE_TAB_VALUES.has(value as ProfileTabValue) ? (value as ProfileTabValue) : null;
};

type ControlCenterCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  actionLabel: string;
  tab?: ProfileTabValue;
  path?: string;
  enabled?: boolean;
};

type BackofficeNavigationModule = {
  id?: string;
  label?: string;
  title?: string;
  description?: string;
  route?: string;
  path?: string;
  enabled?: boolean;
  priority?: number;
};

type BackofficeNavigationResponse = {
  contract_version?: string;
  modules?: BackofficeNavigationModule[];
  request_id?: string;
};

type ProfileIdentitySnapshot = {
  nombre_empresa: string;
  plan: string;
  rubro: string;
  logo_url: string;
  avatar_url: string;
  avatar_source: string;
  avatar_consent: boolean;
  tenant_slug: string | null;
};

const WorkspacePanel = ({
  active,
  label,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  active: boolean;
  label: string;
}) => {
  if (!active) return null;

  return (
    <section role="region" aria-label={label} {...props}>
      {children}
    </section>
  );
};

const ControlCenterCardButton = ({
  item,
  onOpen,
}: {
  item: ControlCenterCard;
  onOpen: (item: ControlCenterCard) => void;
}) => {
  const Icon = item.icon;
  const enabled = item.enabled !== false;

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => onOpen(item)}
      className={cn(
        "group flex min-h-[128px] w-full flex-col justify-between rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-55",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <span className="mt-3 inline-flex items-center gap-2 pl-12 text-xs font-semibold text-primary">
        {enabled ? item.actionLabel : "No disponible"}
        {enabled ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}
      </span>
    </button>
  );
};

export default function Perfil() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, setUser } = useUser();
  const isPyme = user?.tipo_chat === "pyme";
  const [perfil, setPerfil] = useState({
    nombre_empresa: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    pais: "Argentina",
    latitud: null,
    longitud: null,
    link_web: "",
    plan: "gratis",
    preguntas_usadas: 0,
    limite_preguntas: 100,
    rubro: "",
    horarios_ui: DIAS.map((_, idx) => ({
      abre: "09:00",
      cierra: "20:00",
      cerrado: idx === 5 || idx === 6,
    })),
    logo_url: "",
    avatar_url: "",
    avatar_source: "",
    avatar_consent: false,
  });
  const [profileChannelActivation, setProfileChannelActivation] = useState<
    ChannelActivationContract | null | undefined
  >(undefined);
  const storedTenantSlug = useMemo(
    () => normalizeOperationalTenantSlug(safeLocalStorage.getItem("tenantSlug")),
    [],
  );
  const isAdminUser = useMemo(
    () => ['superadmin', 'tenant_admin'].includes(String(normalizeRole(user?.rol))),
    [user?.rol],
  );
  const isProOrFullPlan = useMemo(
    () => perfil.plan === "pro" || perfil.plan === "full",
    [perfil.plan],
  );
  const location = useLocation();
  const tenantPrefix = useMemo(() => {
    const currentPath = location.pathname ?? "";
    return TENANT_ROUTE_PREFIXES.find((prefix) => currentPath.startsWith(`/${prefix}/`)) ?? null;
  }, [location.pathname]);
  const routeTenantSlug = useMemo(() => {
    const segments = (location.pathname || "").split("/").filter(Boolean);
    if (
      segments.length < 2 ||
      !TENANT_ROUTE_PREFIXES.includes(
        segments[0].toLowerCase() as (typeof TENANT_ROUTE_PREFIXES)[number],
      )
    ) {
      return null;
    }
    try {
      return normalizeOperationalTenantSlug(decodeURIComponent(segments[1]));
    } catch {
      return normalizeOperationalTenantSlug(segments[1]);
    }
  }, [location.pathname]);
  const userTenantSlug = normalizeOperationalTenantSlug(
    (user as any)?.tenantSlug ||
      (user as any)?.tenant_slug ||
      (user as any)?.tenant?.slug ||
      (user as any)?.tenant?.tenant_slug,
  );
  const verifiedProfileTenantSlug = normalizeOperationalTenantSlug(
    (perfil as any)?.tenant_slug || (perfil as any)?.slug,
  );
  const verifiedActivationTenantSlug = normalizeOperationalTenantSlug(
    profileChannelActivation?.tenant?.slug,
  );
  const sessionActivationTenantSlug = normalizeOperationalTenantSlug(
    (user as any)?.channel_activation?.tenant?.slug,
  );
  const profileTenantScope =
    routeTenantSlug ||
    sessionActivationTenantSlug ||
    userTenantSlug ||
    storedTenantSlug ||
    verifiedActivationTenantSlug ||
    verifiedProfileTenantSlug;
  const derivedTenantSlug = useMemo(
    () =>
      routeTenantSlug ||
      sessionActivationTenantSlug ||
      userTenantSlug ||
      verifiedActivationTenantSlug ||
      verifiedProfileTenantSlug ||
      resolveOperationalTenantSlug({ user: user as any, perfil: perfil as any, storedTenantSlug }),
    [
      perfil,
      routeTenantSlug,
      sessionActivationTenantSlug,
      storedTenantSlug,
      user,
      userTenantSlug,
      verifiedActivationTenantSlug,
      verifiedProfileTenantSlug,
    ],
  );
  const profileIdentityScope = user
    ? `${user.id ?? user.email ?? "verified-user"}:${profileTenantScope || "default-tenant"}`
    : null;

  useEffect(() => {
    // Never carry a verified channel contract across tenant identities while
    // the next scoped profile is loading.
    setProfileChannelActivation(undefined);
  }, [profileIdentityScope]);
  const buildMappingPath = useCallback(
    (path: string) =>
      tenantPrefix && derivedTenantSlug ? `/${tenantPrefix}/${derivedTenantSlug}${path}` : path,
    [derivedTenantSlug, tenantPrefix],
  );
  const [modoHorario, setModoHorario] = useState("comercial");
  const [archivo, setArchivo] = useState<File | null>(null); // Tipado para archivo
  const [resultadoCatalogo, setResultadoCatalogo] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null); // Mensaje de éxito
  const [error, setError] = useState<string | null>(null); // Mensaje de error
  const [profileReady, setProfileReady] = useState(false);
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<
    "event" | "news" | "paste" | "promotion"
  >("event");
  const requestedProfileTab = normalizeProfileTabValue(searchParams.get("tab"));
  const requestedProfileSection = searchParams.get("section");
  const shouldHighlightChannelSetup = searchParams.get("setup") === "channels";
  const hasInstitutionalDeepLink = Boolean(requestedProfileSection || shouldHighlightChannelSetup);
  const requestedWorkspaceTab: ProfileTabValue | null = hasInstitutionalDeepLink
    ? "perfil"
    : requestedProfileTab;
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTabValue>(
    requestedWorkspaceTab || "perfil",
  );
  const activeInstitutionSection = normalizeInstitutionProfileSection(
    shouldHighlightChannelSetup ? "channels" : requestedProfileSection,
  );
  const isInstitutionProfileOpen = Boolean(requestedProfileSection || shouldHighlightChannelSetup);
  const [isChannelSetupOpen, setIsChannelSetupOpen] = useState(shouldHighlightChannelSetup);
  const [isSubmittingPromotion, setIsSubmittingPromotion] = useState(false);
  const [hasSentPromotionToday, setHasSentPromotionToday] = useState(false);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [pendingGeocode, setPendingGeocode] = useState<string | null>(null);
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState<string | null>(null);
  const [geocodingStatus, setGeocodingStatus] = useState<"idle" | "loading">("idle");
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const normalizedRole = String(normalizeRole(user?.rol));
  const isStaff = ['superadmin', 'tenant_admin', 'employee'].includes(normalizedRole);
  const isTenantAdministrator = ['superadmin', 'tenant_admin'].includes(normalizedRole);
  const isAnalyticsViewer = normalizedRole === 'analytics_viewer';
  const isCatalogManager = normalizedRole === 'catalog_manager';
  const canManageBilling = isTenantAdministrator;
  const canViewAnalytics = isStaff || isAnalyticsViewer;
  const canViewReports = isStaff || isAnalyticsViewer;
  const canViewTerritory = isStaff;
  const canViewContacts = isStaff;
  const canViewCatalog = isTenantAdministrator || isCatalogManager;
  const canManageTeam = isTenantAdministrator;
  const canAccessSurveys = FEATURE_ENCUESTAS && isStaff;
  const esMunicipio = (user?.tipo_chat || perfil.rubro) === "municipio" || perfil.rubro === "municipios";
  const [backofficeNavigation, setBackofficeNavigation] = useState<BackofficeNavigationResponse | null>(null);
  const [backofficeNavigationStatus, setBackofficeNavigationStatus] = useState<
    'idle' | 'loading' | 'ready' | 'denied' | 'error'
  >('idle');
  const [backofficeNavigationRevision, setBackofficeNavigationRevision] = useState(0);
  const loadedProfileScopeRef = useRef<string | null>(null);
  const backofficeNavigationScopeRef = useRef<string | null>(null);
  const promotionStatusScopeRef = useRef<string | null>(null);
  const mapDataScopeRef = useRef<string | null>(null);
  const mapDataInFlightScopeRef = useRef<string | null>(null);
  const enabledBackendModuleIds = useMemo(() => {
    if (backofficeNavigation?.contract_version !== 'backoffice.navigation.v1') {
      return new Set<string>();
    }

    return new Set(
      (backofficeNavigation.modules || [])
        .filter((module) => module.enabled !== false)
        .map((module) => String(module.id || '').trim().toLowerCase())
        .filter(Boolean),
    );
  }, [backofficeNavigation]);
  const workspaceCapabilities = useMemo(
    () =>
      resolveProfileWorkspaceCapabilities({
        status: backofficeNavigationStatus,
        enabledModuleIds: enabledBackendModuleIds,
        featureSurveys: FEATURE_ENCUESTAS,
        operationAccess: isStaff,
        surveyAccess: canAccessSurveys,
        territoryAccess: canViewTerritory,
        contactsAccess: canViewContacts,
        reportsAccess: canViewReports,
        analyticsAccess: canViewAnalytics,
        catalogAccess: canViewCatalog,
        teamAccess: canManageTeam,
        billingAccess: canManageBilling,
      }),
    [
      backofficeNavigationStatus,
      canAccessSurveys,
      canManageTeam,
      canManageBilling,
      canViewAnalytics,
      canViewCatalog,
      canViewContacts,
      canViewReports,
      canViewTerritory,
      enabledBackendModuleIds,
      isStaff,
    ],
  );
  const allowedWorkspaceTabs = useMemo(() => {
    const tabs = new Set<ProfileTabValue>(['perfil']);
    if (workspaceCapabilities.operation) {
      tabs.add('tickets');
      tabs.add('pedidos');
    }
    if (workspaceCapabilities.reports) tabs.add('estadisticas');
    if (workspaceCapabilities.analytics) tabs.add('analytics');
    if (workspaceCapabilities.catalog) tabs.add('catalogo');
    if (workspaceCapabilities.contacts) tabs.add('usuarios');
    if (workspaceCapabilities.team) tabs.add('empleados');
    if (workspaceCapabilities.territory) tabs.add('mapas');
    return tabs;
  }, [workspaceCapabilities]);
  const hasAnyWorkspaceCapability = Object.values(workspaceCapabilities).some(Boolean);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!hasAuthenticatedChatbocSession()) {
      return;
    }

    const persistedTenantSlug =
      (user as any)?.tenantSlug ||
      (user as any)?.tenant_slug ||
      (user as any)?.tenant?.slug ||
      (user as any)?.tenant?.tenant_slug;

    if (persistedTenantSlug) {
      safeLocalStorage.setItem("tenantSlug", persistedTenantSlug);
    }

    if (profileReady) {
      return;
    }

    const userRecord = user as any;
    const seededName = resolvePanelDisplayName(userRecord, persistedTenantSlug);
    const seededRubro =
      userRecord?.tipo_chat === "municipio"
        ? "municipio"
        : typeof userRecord?.rubro === "string"
          ? userRecord.rubro.toLowerCase()
          : "";

    setPerfil((prev) => ({
      ...prev,
      tenant_slug: persistedTenantSlug || (prev as any).tenant_slug,
      slug: persistedTenantSlug || (prev as any).slug,
      nombre_empresa: prev.nombre_empresa || seededName || "",
      telefono: prev.telefono || userRecord?.telefono || "",
      plan: prev.plan === "gratis" ? (userRecord?.plan || prev.plan) : prev.plan,
      rubro: prev.rubro || seededRubro,
      logo_url: prev.logo_url || userRecord?.logo_url || "",
      avatar_url: prev.avatar_url || userRecord?.avatar_url || userRecord?.picture || "",
      avatar_source: prev.avatar_source || userRecord?.avatar_source || "",
      avatar_consent:
        prev.avatar_consent ||
        Boolean(userRecord?.avatar_consent ?? userRecord?.profile_picture_consent ?? false),
    }));

    setProfileReady(true);
  }, [profileReady, user]);

  const {
    posts: municipalPosts,
    isLoading: isLoadingMunicipalPosts,
    error: municipalPostsError,
    filters: municipalPostsFilters,
    meta: municipalPostsMeta,
    setFilters: updateMunicipalPostFilters,
    loadMore: loadMoreMunicipalPosts,
    refresh: refreshMunicipalPosts,
  } = useMunicipalPosts({ limit: 10, enabled: false });

  const handleTipoPostFilterChange = useCallback(
    (value: string) => {
      const normalized = value === "all" ? undefined : (value as "evento" | "noticia");
      void updateMunicipalPostFilters({ tipoPost: normalized });
    },
    [updateMunicipalPostFilters],
  );

  const handleMonthFilterChange = useCallback(
    (value: string) => {
      const nextValue = value?.trim();
      if (nextValue) {
        void updateMunicipalPostFilters({
          month: nextValue,
          fromDate: undefined,
          toDate: undefined,
        });
      } else {
        void updateMunicipalPostFilters({ month: undefined });
      }
    },
    [updateMunicipalPostFilters],
  );

  const handleFromDateChange = useCallback(
    (value: string) => {
      const nextValue = value?.trim();
      if (nextValue) {
        void updateMunicipalPostFilters({
          fromDate: nextValue,
          month: undefined,
        });
      } else {
        void updateMunicipalPostFilters({ fromDate: undefined });
      }
    },
    [updateMunicipalPostFilters],
  );

  const handleToDateChange = useCallback(
    (value: string) => {
      const nextValue = value?.trim();
      if (nextValue) {
        void updateMunicipalPostFilters({
          toDate: nextValue,
          month: undefined,
        });
      } else {
        void updateMunicipalPostFilters({ toDate: undefined });
      }
    },
    [updateMunicipalPostFilters],
  );

  const handleResetPostFilters = useCallback(() => {
    void updateMunicipalPostFilters({
      month: undefined,
      fromDate: undefined,
      toDate: undefined,
      tipoPost: undefined,
      offset: 0,
    });
  }, [updateMunicipalPostFilters]);

  const hasActiveMunicipalPostFilters =
    Boolean(
      municipalPostsFilters.month ||
        municipalPostsFilters.fromDate ||
        municipalPostsFilters.toDate ||
        municipalPostsFilters.tipoPost,
    );
  const maptilerKey = import.meta.env.VITE_MAPTILER_KEY || "";

  const updateProfileTab = useCallback(
    (tab: ProfileTabValue) => {
      setActiveProfileTab(tab);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("section");
      if (tab === "perfil") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const openPlanAndBilling = useCallback(() => {
    setActiveProfileTab("perfil");
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "perfil");
    next.set("section", "plan");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updateInstitutionSection = useCallback(
    (section: InstitutionProfileSection) => {
      setActiveProfileTab("perfil");
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", "perfil");
      next.set("section", section === "plan-security" ? "plan" : section);
      if (section !== "channels") next.delete("setup");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (requestedWorkspaceTab && requestedWorkspaceTab !== activeProfileTab) {
      setActiveProfileTab(requestedWorkspaceTab);
    }
  }, [activeProfileTab, requestedWorkspaceTab]);

  useEffect(() => {
    if (!hasInstitutionalDeepLink || requestedProfileTab === "perfil") return;

    // Canonicalize the URL without ever mounting the workspace named by a
    // stale `tab` parameter. This prevents TicketsPanel from firing requests
    // while a direct link to Perfil > Canales is resolving.
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "perfil");
    setSearchParams(next, { replace: true });
  }, [hasInstitutionalDeepLink, requestedProfileTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (backofficeNavigationStatus === 'idle' || backofficeNavigationStatus === 'loading') return;
    if (allowedWorkspaceTabs.has(activeProfileTab)) return;

    if (requestedProfileSection || shouldHighlightChannelSetup) {
      // Institutional deep links must survive authorization resolving after the
      // first render. Canonicalize the parent workspace without discarding the
      // requested section/setup query parameters.
      setActiveProfileTab("perfil");
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", "perfil");
      setSearchParams(next, { replace: true });
      return;
    }

    updateProfileTab("perfil");
  }, [
    activeProfileTab,
    allowedWorkspaceTabs,
    backofficeNavigationStatus,
    requestedProfileSection,
    searchParams,
    setSearchParams,
    shouldHighlightChannelSetup,
    updateProfileTab,
  ]);

  useEffect(() => {
    if ((!requestedProfileSection && !shouldHighlightChannelSetup) || activeProfileTab === "perfil") return;

    // A deep link to an institutional section owns the active workspace. Keep
    // the requested section/setup intact while canonicalizing the parent tab.
    setActiveProfileTab("perfil");
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "perfil");
    setSearchParams(next, { replace: true });
  }, [
    activeProfileTab,
    requestedProfileSection,
    searchParams,
    setSearchParams,
    shouldHighlightChannelSetup,
  ]);

  useEffect(() => {
    if (!user || !hasAuthenticatedChatbocSession()) {
      setBackofficeNavigation(null);
      setBackofficeNavigationStatus('idle');
      backofficeNavigationScopeRef.current = null;
      return;
    }

    if (!derivedTenantSlug || !profileIdentityScope) {
      setBackofficeNavigation(null);
      setBackofficeNavigationStatus('error');
      backofficeNavigationScopeRef.current = null;
      return;
    }

    const requestedScope = `${profileIdentityScope}:${normalizedRole || 'unassigned-role'}:${derivedTenantSlug}`;
    if (backofficeNavigationScopeRef.current === requestedScope) {
      return;
    }

    backofficeNavigationScopeRef.current = requestedScope;
    setBackofficeNavigation(null);
    setBackofficeNavigationStatus('loading');
    const loadBackofficeNavigation = async () => {
      try {
        const data = await apiFetch<BackofficeNavigationResponse>(
          `/api/app/backoffice/navigation?tenant_slug=${encodeURIComponent(derivedTenantSlug)}`,
          { tenantSlug: derivedTenantSlug },
        );
        if (backofficeNavigationScopeRef.current !== requestedScope) {
          return;
        }
        if (data?.contract_version === 'backoffice.navigation.v1' && Array.isArray(data.modules)) {
          setBackofficeNavigation(data);
          setBackofficeNavigationStatus('ready');
          return;
        }
        setBackofficeNavigation(null);
        setBackofficeNavigationStatus('error');
      } catch (error) {
        if (backofficeNavigationScopeRef.current !== requestedScope) {
          return;
        }
        backofficeNavigationScopeRef.current = null;
        setBackofficeNavigation(null);
        setBackofficeNavigationStatus(
          error instanceof ApiError && (error.status === 401 || error.status === 403)
            ? 'denied'
            : 'error',
        );
      }
    };

    void loadBackofficeNavigation();
  }, [backofficeNavigationRevision, derivedTenantSlug, normalizedRole, profileIdentityScope, user]);

  const handleSubmitPost = async (values: any) => {
    setIsSubmittingEvent(true);
    try {
      const formData = new FormData();

      formData.append('titulo', values.title);
      if (values.subtitle) formData.append('subtitulo', values.subtitle);
      if (values.description) formData.append('contenido', values.description);
      formData.append('tipo_post', values.tipo_post);
      if (values.imageUrl) formData.append('imagen_url', values.imageUrl);
      if (values.startDate) {
        const start = new Date(values.startDate);
        if (values.startTime) {
          const [h, m] = values.startTime.split(':').map(Number);
          start.setHours(h || 0, m || 0, 0, 0);
        }
        formData.append('fecha_evento_inicio', toLocalISOString(start));
      }
      if (values.endDate) {
        const end = new Date(values.endDate);
        if (values.endTime) {
          const [h, m] = values.endTime.split(':').map(Number);
          end.setHours(h || 0, m || 0, 0, 0);
        }
        formData.append('fecha_evento_fin', toLocalISOString(end));
      }
      if (values.location?.address) formData.append('direccion', values.location.address);
      if (values.link) formData.append('enlace', values.link);
      if (values.facebook) formData.append('facebook', values.facebook);
      if (values.instagram) formData.append('instagram', values.instagram);
      if (values.youtube) formData.append('youtube', values.youtube);

      if (values.flyer && values.flyer.length > 0) {
        formData.append('flyer_image', values.flyer[0]);
      }

      await apiFetch('/municipal/posts', {
        method: 'POST',
        body: formData,
      });

      toast({
        title: "Éxito",
        description: "El evento/noticia ha sido creado correctamente.",
      });

      setIsEventModalOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al crear el evento",
        description: getErrorMessage(error, "No se pudo guardar el evento. Intenta de nuevo."),
      });
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleSubmitPromotion = async (values: PromotionFormValues) => {
    setIsSubmittingPromotion(true);
    try {
      const body = {
        titulo: values.title,
        descripcion: values.description,
        link: values.link,
        url_imagen: values.imageUrl || undefined,
      };

      const resp = await apiFetch<{ enviados?: number }>('/api/whatsapp/promocionar', {
        method: 'POST',
        body,
      });

      toast({
        title: 'Éxito',
        description: resp.enviados ? `La promoción se ha enviado a ${resp.enviados} contactos.` : 'La promoción se ha enviado correctamente.',
      });
      const today = new Date().toISOString().slice(0, 10);
      safeLocalStorage.setItem('lastPromotionDate', today);
      setHasSentPromotionToday(true);
      setIsEventModalOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        toast({
          variant: 'destructive',
          title: 'Límite diario superado',
          description: 'Ya se envió una promoción hoy. Intenta nuevamente mañana.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al enviar la promoción',
          description: getErrorMessage(error, 'No se pudo enviar la promoción. Intenta de nuevo.'),
        });
      }
    } finally {
      setIsSubmittingPromotion(false);
    }
  };

  const handlePromoteEvent = async (values: any) => {
    await handleSubmitPromotion({
      title: values.title,
      description: values.description || '',
      link: values.link || '',
      imageUrl: values.imageUrl || '',
    });
  };

  const [heatmapData, setHeatmapData] = useState<HeatPoint[]>([]);
  const [heatmapDetails, setHeatmapDetails] = useState<HeatmapDataset | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableBarrios, setAvailableBarrios] = useState<string[]>([]);
  const [availableTipos, setAvailableTipos] = useState<string[]>([]);

  const municipalityCoords =
    typeof perfil.latitud === "number" &&
    typeof perfil.longitud === "number" &&
    !Number.isNaN(perfil.latitud) &&
    !Number.isNaN(perfil.longitud)
      ? ([perfil.longitud, perfil.latitud] as [number, number])
      : undefined;
  const hasValidLocation = Boolean(municipalityCoords);
  const locationMarker = municipalityCoords;
  const showLocationCard = Boolean(
    (perfil.direccion && perfil.direccion.trim().length > 0) ||
      hasValidLocation ||
      geocodingStatus === "loading" ||
      geocodingError,
  );

  // --- Estados para el nuevo modal de carga de catálogo ---
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedColumns, setParsedColumns] = useState<string[]>([]);
  const [suggestedMappings, setSuggestedMappings] = useState<Record<string, string | null>>({});
  const [fileProcessingError, setFileProcessingError] = useState<string | null>(null);
  const [systemFields] = useState<SystemField[]>(DEFAULT_SYSTEM_FIELDS);
  const [previewRecords, setPreviewRecords] = useState<Record<string, string>[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
  const [analysisSource, setAnalysisSource] = useState<string | null>(null);
  const [analysisConfidence, setAnalysisConfidence] = useState<number | null>(null);
  const [analysisEngine, setAnalysisEngine] = useState<string | null>(null);
  // --- Fin de estados para el modal ---

  const previewColumnNames = parsedColumns.length > 0
    ? parsedColumns
    : previewRecords.length > 0
      ? Object.keys(previewRecords[0])
      : [];


  // Estados para la gestión de mapeos
  interface MappingConfig {
    id: string; // o number, según tu backend
    name: string;
    is_default?: boolean;
    isDefault?: boolean;
    // Podríamos añadir más detalles si fueran necesarios en la lista, como fileType o ultimaModificacion
  }
  const [mappingConfigs, setMappingConfigs] = useState<MappingConfig[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [showManageMappingsDialog, setShowManageMappingsDialog] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<MappingConfig | null>(null);
  const [vectorSyncStatus, setVectorSyncStatus] = useState<CatalogVectorSyncStatus | null>(null);
  const [loadingVectorSync, setLoadingVectorSync] = useState(false);

  const formatVectorSyncDate = (value: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };



  const fetchPerfil = useCallback(async ({
    tenantSlug,
    isCurrent = () => true,
  }: {
    tenantSlug?: string | null;
    isCurrent?: () => boolean;
  } = {}): Promise<ProfileIdentitySnapshot | null> => {
    setLoadingGuardar(true);
    setError(null);
    setMensaje(null);
    try {
      // Keep the contract explicit. Preview/static hosts only proxy `/api/*`;
      // a bare `/me` can otherwise be swallowed by the SPA fallback and return
      // index.html, which in turn degrades the workspace to a generic tenant.
      const data = await apiFetch<any>("/api/me", { tenantSlug });
      if (!isCurrent()) {
        return null;
      }

      const channelActivation = data.channel_activation;
      setProfileChannelActivation(
        channelActivation?.contract_version === 'tenant.channel_activation.v1'
          ? (channelActivation as ChannelActivationContract)
          : null,
      );

      const latitud = parseCoordinate(data.latitud ?? data.lat);
      const longitud = parseCoordinate(data.longitud ?? data.lng);
      const direccion = data.direccion || "";

      let horariosUi = DIAS.map((_, idx) => ({
        abre: "09:00",
        cierra: "20:00",
        cerrado: idx === 5 || idx === 6,
      }));
      if (
        data.horario_json &&
        Array.isArray(data.horario_json) &&
        data.horario_json.length === DIAS.length
      ) {
        horariosUi = data.horario_json.map((h, idx) => ({
          dia: DIAS[idx],
          abre: h.abre || "09:00",
          cierra: h.cierra || "20:00",
          cerrado:
            typeof h.cerrado === "boolean" ? h.cerrado : idx === 5 || idx === 6,
        }));
      }
      const resolvedPlan =
        data.plan ||
        data.tenant?.plan ||
        data.tenant_plan ||
        "gratis";
      const resolvedProfileTenantSlug =
        data.tenant_slug ||
        data.tenantSlug ||
        data.tenant?.slug ||
        data.tenant?.tenant_slug ||
        data.endpoint ||
        null;

      if (resolvedProfileTenantSlug) {
        safeLocalStorage.setItem("tenantSlug", resolvedProfileTenantSlug);
      }

      const profileAvatarUrl = data.avatar_url || data.picture || "";
      const profileAvatar = resolveConsentedAvatar(data, {
        avatarUrl: profileAvatarUrl,
        source: data.avatar_source,
        consented: data.avatar_consent ?? data.profile_picture_consent,
      });

      setPerfil((prev) => ({
        ...prev,
        tenant_slug: resolvedProfileTenantSlug || (prev as any).tenant_slug,
        slug:
          data.slug ||
          data.tenant?.slug ||
          data.tenant_slug ||
          data.tenantSlug ||
          (prev as any).slug,
        nombre_empresa: data.nombre_empresa || "",
        telefono: data.telefono || "",
        direccion,
        ciudad: data.ciudad || "",
        provincia: data.provincia || "",
        pais: data.pais || "Argentina",
        latitud,
        longitud,
        link_web: data.link_web || "",
        plan: resolvedPlan,
        preguntas_usadas: data.preguntas_usadas ?? 0,
        limite_preguntas: data.limite_preguntas ?? 100,
        rubro: data.rubro?.toLowerCase() || "",
        logo_url: data.logo_url || "",
        avatar_url: profileAvatar.avatarUrl || "",
        avatar_source: profileAvatar.source || "",
        avatar_consent: profileAvatar.consented,
        horarios_ui: horariosUi,
      }));

      const trimmedAddress = direccion.trim();
      const hasCoordinates = latitud !== null && longitud !== null;
      setLastGeocodedAddress(trimmedAddress ? trimmedAddress : null);
      setIsManualLocation(hasCoordinates);
      setPendingGeocode(!hasCoordinates && trimmedAddress ? trimmedAddress : null);
      setGeocodingError(null);
      if (geocodeAbortRef.current) {
        geocodeAbortRef.current.abort();
        geocodeAbortRef.current = null;
      }
      setGeocodingStatus("idle");

      return {
        nombre_empresa: data.nombre_empresa || "",
        plan: resolvedPlan,
        rubro: data.rubro?.toLowerCase() || "",
        logo_url: data.logo_url || "",
        avatar_url: profileAvatar.avatarUrl || "",
        avatar_source: profileAvatar.source || "",
        avatar_consent: profileAvatar.consented,
        tenant_slug: resolvedProfileTenantSlug,
      };
    } catch (err) {
      if (isCurrent()) {
        setError(getErrorMessage(err, "Error al cargar el perfil."));
      }
      return null;
    } finally {
      if (isCurrent()) {
        setLoadingGuardar(false);
        setProfileReady(true);
      }
    }
  }, []);

  const fetchMapData = useCallback(async (tenantSlug?: string | null) => {
    setIsMapLoading(true);
    try {
      const tipo = user?.tipo_chat ?? getCurrentTipoChat();

      const [stats, heatmapDataset, categoryData] = await Promise.all([
        getTicketStats({ tipo }),
        getHeatmapDataset({ tipo }),
        apiFetch<{ categorias: { id: number; nombre: string }[] }>(
          '/municipal/categorias',
          { tenantSlug },
        ).catch((err) => {
          console.warn('Error fetching categories for heatmap filters:', err);
          return null;
        }),
      ]);

      const statsHeatmapDataset = stats.heatmapDataset;
      const statsHeatmap = statsHeatmapDataset?.points ?? stats.heatmap ?? [];
      const heatmapPoints = heatmapDataset?.points ?? [];

      let combinedHeatmap = heatmapPoints.length > 0 ? heatmapPoints : statsHeatmap;
      const usedFallback = combinedHeatmap.length === 0;

      if (usedFallback) {
        toast({
          title: 'Mapa sin datos',
          description: 'No hay puntos disponibles para mostrar con los filtros actuales.',
        });
      }

      setHeatmapData(combinedHeatmap);
      setHeatmapDetails(
        heatmapPoints.length > 0
          ? heatmapDataset ?? { points: combinedHeatmap }
          : statsHeatmapDataset ?? { points: combinedHeatmap },
      );

      const barriosFromHeatmap = Array.from(
        new Set(combinedHeatmap.map((d) => d.barrio).filter((b): b is string => Boolean(b))),
      );
      const barrios = mergeAndSortStrings(barriosFromHeatmap, []);
      setAvailableBarrios(barrios);

      const tiposFromHeatmap = Array.from(
        new Set(combinedHeatmap.map((d) => d.tipo_ticket).filter((t): t is string => Boolean(t))),
      );
      const tipos = mergeAndSortStrings(tiposFromHeatmap, []);
      setAvailableTipos(tipos);

      const categoriasFromHeatmap = Array.from(
        new Set(combinedHeatmap.map((d) => d.categoria).filter((c): c is string => Boolean(c))),
      );

      const categoriasFromApi =
        categoryData && Array.isArray(categoryData.categorias)
          ? categoryData.categorias.map((c) => c.nombre)
          : [];

      const mergedCategorias = mergeAndSortStrings(categoriasFromApi, categoriasFromHeatmap);
      const finalCategorias = mergedCategorias;
      setAvailableCategories(finalCategorias);

      return true;
    } catch (error) {
      console.error("Error fetching map data:", error);
      toast({
        variant: "destructive",
        title: "Error al cargar datos del mapa",
        description: getErrorMessage(error),
      });
      setHeatmapData([]);
      setHeatmapDetails({ points: [] });
      setAvailableBarrios([]);
      setAvailableTipos([]);
      setAvailableCategories([]);
      return false;
    } finally {
      setIsMapLoading(false);
    }
  }, [user?.tipo_chat]);


  useEffect(() => {
    if (!hasAuthenticatedChatbocSession()) {
      navigate(buildLoginPathWithNext(location.pathname, location.search), { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!hasAuthenticatedChatbocSession() || !profileIdentityScope) {
      return;
    }

    if (loadedProfileScopeRef.current === profileIdentityScope) {
      return;
    }

    let cancelled = false;
    const requestedScope = profileIdentityScope;
    void fetchPerfil({
      tenantSlug: profileTenantScope,
      isCurrent: () => !cancelled,
    }).then((snapshot) => {
      if (snapshot && !cancelled) {
        loadedProfileScopeRef.current = requestedScope;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchPerfil, profileIdentityScope, profileTenantScope]);

  // Función para cargar las configuraciones de mapeo
  const fetchMappingConfigs = useCallback(async () => {
    if (!user?.id) return; // Asegurarse que tenemos el ID de la organización
    setLoadingMappings(true);
    const entityType = isPyme ? 'pymes' : 'municipal';
    try {
      const data = await apiFetch<MappingConfig[]>(`/${entityType}/${user.id}/catalog-mappings`);
      setMappingConfigs(data || []);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al cargar configuraciones de mapeo",
        description: getErrorMessage(err),
      });
      setMappingConfigs([]); // Asegurar que sea un array vacío en caso de error
    } finally {
      setLoadingMappings(false);
    }
  }, [isPyme, user?.id]);

  const refreshVectorSyncStatus = useCallback(async () => {
    if (!user?.id || !isPyme) {
      setVectorSyncStatus(null);
      return;
    }
    setLoadingVectorSync(true);
    try {
      const status = await fetchCatalogVectorSyncStatus(user.id);
      setVectorSyncStatus(status);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo obtener el estado del catálogo',
        description: getErrorMessage(err),
      });
    } finally {
      setLoadingVectorSync(false);
    }
  }, [user?.id, isPyme]);

  // Cargar mapeos cuando el diálogo se va a mostrar
  useEffect(() => {
    if (showManageMappingsDialog && user?.id) {
      fetchMappingConfigs();
    }
  }, [showManageMappingsDialog, user?.id, fetchMappingConfigs]);

  useEffect(() => {
    if (!isPyme || activeProfileTab !== "catalogo") {
      setVectorSyncStatus(null);
      return;
    }
    if (user?.id) {
      refreshVectorSyncStatus();
    }
  }, [activeProfileTab, user?.id, isPyme, refreshVectorSyncStatus]);

  useEffect(() => {
    if (!pendingGeocode) {
      return;
    }

    const addressToGeocode = pendingGeocode;

    if (!maptilerKey) {
      setGeocodingError(
        "No se pudo obtener la ubicación automáticamente. Configurá la clave de MapTiler para habilitar esta función.",
      );
      setPendingGeocode(null);
      return;
    }

    const controller = new AbortController();
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
    }
    geocodeAbortRef.current = controller;

    const fetchCoords = async () => {
      try {
        setGeocodingStatus("loading");
        setGeocodingError(null);
        const response = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(addressToGeocode)}.json?key=${maptilerKey}&language=es&limit=1`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Geocode request failed with status ${response.status}`);
        }

        const data = await response.json();
        const feature = Array.isArray(data?.features) ? data.features[0] : null;
        const coords = Array.isArray(feature?.center)
          ? feature.center
          : Array.isArray(feature?.geometry?.coordinates)
            ? feature.geometry.coordinates
            : null;

        if (
          Array.isArray(coords) &&
          coords.length >= 2 &&
          typeof coords[0] === "number" &&
          typeof coords[1] === "number" &&
          !Number.isNaN(coords[0]) &&
          !Number.isNaN(coords[1])
        ) {
          const [lng, lat] = coords;
          setPerfil((prev) => ({
            ...prev,
            latitud: lat,
            longitud: lng,
          }));
          setLastGeocodedAddress(addressToGeocode);
          setIsManualLocation(false);
          return;
        }

        throw new Error("No coordinates found for the provided address");
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          return;
        }
        console.error("Failed to geocode address:", error);
        setGeocodingError("No se pudo obtener la ubicación para la dirección ingresada.");
        setLastGeocodedAddress(null);
        setPerfil((prev) => ({
          ...prev,
          latitud: null,
          longitud: null,
        }));
      } finally {
        if (!controller.signal.aborted) {
          setGeocodingStatus("idle");
          setPendingGeocode(null);
          geocodeAbortRef.current = null;
        }
      }
    };

    void fetchCoords();

    return () => {
      controller.abort();
    };
  }, [pendingGeocode, maptilerKey]);

  useEffect(() => {
    return () => {
      if (geocodeAbortRef.current) {
        geocodeAbortRef.current.abort();
      }
    };
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { // Tipado de 'e'
    const { id, value } = e.target;
    setPerfil((prev) => ({
      ...prev,
      [id]: value,
      ...(id === "avatar_url"
        ? {
            avatar_source: value.trim() ? "profile_url" : "",
            avatar_consent: value.trim() ? prev.avatar_consent : false,
          }
        : {}),
    }));
  };

  const handleAddressOptionChange = (option: { label: string; value: string } | null) => {
    const value = option?.value ?? "";
    setPerfil((prev) => ({
      ...prev,
      direccion: value,
      latitud: option ? prev.latitud : null,
      longitud: option ? prev.longitud : null,
    }));
    if (!option) {
      setPendingGeocode(null);
      setLastGeocodedAddress(null);
    }
    setGeocodingError(null);
    setIsManualLocation(false);
  };

  const handleAddressSelect = (address: string) => {
    const trimmed = address.trim();
    setPerfil((prev) => ({
      ...prev,
      direccion: address,
      latitud: trimmed.length === 0 ? null : prev.latitud,
      longitud: trimmed.length === 0 ? null : prev.longitud,
    }));
    setGeocodingError(null);

    if (trimmed.length === 0) {
      setPendingGeocode(null);
      setLastGeocodedAddress(null);
      setIsManualLocation(false);
      return;
    }

    if (isManualLocation && trimmed === (lastGeocodedAddress ?? trimmed)) {
      return;
    }

    if (trimmed === lastGeocodedAddress) {
      return;
    }

    setIsManualLocation(false);
    setPendingGeocode(trimmed);
  };

  const handleMapSelect = (lat: number, lng: number, address?: string) => {
    const updatedAddress = (address ?? perfil.direccion ?? "").trim();

    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
      geocodeAbortRef.current = null;
    }

    setPerfil((prev) => ({
      ...prev,
      latitud: lat,
      longitud: lng,
      direccion: address ?? prev.direccion,
    }));

    if (updatedAddress) {
      setLastGeocodedAddress(updatedAddress);
    }

    setPendingGeocode(null);
    setGeocodingStatus("idle");
    setGeocodingError(null);
    setIsManualLocation(true);
  };


  const handleHorarioChange = (index: number, field: string, value: string | boolean) => { // Tipado
    const nuevosHorarios = perfil.horarios_ui.map((h, idx) =>
      idx === index ? { ...h, [field]: value } : h,
    );
    setPerfil((prev) => ({ ...prev, horarios_ui: nuevosHorarios }));
  };
  const setHorarioComercial = () => {
    setModoHorario("comercial");
    setPerfil((prev) => ({
      ...prev,
      horarios_ui: DIAS.map((_, idx) => ({
        abre: "09:00",
        cierra: "20:00",
        cerrado: idx === 5 || idx === 6,
      })),
    }));
    setHorariosOpen(false);
  };
  const setHorarioPersonalizado = () => {
    setModoHorario("personalizado");
    setHorariosOpen(true);
  };

  const handleProfileAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isTenantAdministrator) {
      setError("No tenés permisos para modificar la identidad institucional.");
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Usa una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5 MB.");
      return;
    }

    setAvatarUploading(true);
    setError(null);
    setMensaje(null);
    try {
      const uploaded = await uploadProfileAvatar(file);
      setPerfil((prev) => ({
        ...prev,
        avatar_url: uploaded.avatarUrl,
        avatar_source: uploaded.avatarSource || "profile_upload",
        avatar_consent: Boolean(uploaded.avatarConsent && uploaded.avatarUrl),
      }));
      setMensaje("Imagen personal actualizada correctamente.");
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir la imagen personal."));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleGuardar = async (e: FormEvent) => { // Tipado de 'e'
    e.preventDefault();
    setMensaje(null);
    setError(null);

    if (!isTenantAdministrator) {
      setError("No tenés permisos para modificar el perfil institucional.");
      return;
    }

    const requiredGeneralFields = [
      ["nombre institucional", perfil.nombre_empresa],
      ["teléfono de contacto", perfil.telefono],
      ["sitio institucional", perfil.link_web],
    ] as const;
    const missingGeneralFields = requiredGeneralFields
      .filter(([, value]) => !value.trim())
      .map(([label]) => label);
    if (missingGeneralFields.length > 0) {
      setError(`Completá ${missingGeneralFields.join(", ")} antes de guardar.`);
      updateInstitutionSection("general");
      return;
    }

    try {
      const institutionalUrl = new URL(perfil.link_web);
      if (!["http:", "https:"].includes(institutionalUrl.protocol)) throw new Error("invalid_protocol");
    } catch {
      setError("Ingresá un sitio institucional válido, por ejemplo https://municipio.gob.ar.");
      updateInstitutionSection("general");
      return;
    }

    setLoadingGuardar(true);

    const horariosParaBackend = perfil.horarios_ui.map((h, idx) => ({
      dia: DIAS[idx],
      abre: h.cerrado ? "" : h.abre,
      cierra: h.cerrado ? "" : h.cierra,
      cerrado: h.cerrado,
    }));

    const payload = {
      nombre_empresa: perfil.nombre_empresa,
      telefono: perfil.telefono,
      direccion: perfil.direccion,
      ciudad: perfil.ciudad,
      provincia: perfil.provincia,
      pais: perfil.pais,
      latitud: perfil.latitud,
      longitud: perfil.longitud,
      link_web: perfil.link_web,
      logo_url: perfil.logo_url,
      avatar_url: perfil.avatar_consent ? perfil.avatar_url : "",
      avatar_source: perfil.avatar_consent && perfil.avatar_url ? perfil.avatar_source || "profile_url" : undefined,
      avatar_consent: Boolean(perfil.avatar_consent && perfil.avatar_url),
      profile_picture_consent: Boolean(perfil.avatar_consent && perfil.avatar_url),
      horario_json: JSON.stringify(horariosParaBackend), // Convertir a string JSON
    };
    try {
      // Usa apiFetch, que maneja Content-Type y Authorization
      const data = await apiFetch<any>("/perfil", {
        method: "PUT",
        body: payload,
      });
      
      const successMsg = data.mensaje || "Cambios guardados correctamente ✔️";
      const refreshedProfile = await fetchPerfil({ tenantSlug: profileTenantScope });
      if (user && refreshedProfile) {
        const refreshedTenantSlug = refreshedProfile.tenant_slug || profileTenantScope || undefined;
        setUser({
          ...user,
          nombre_empresa: refreshedProfile.nombre_empresa,
          plan: refreshedProfile.plan,
          rubro: refreshedProfile.rubro,
          logo_url: refreshedProfile.logo_url,
          avatar_url: refreshedProfile.avatar_url,
          picture: refreshedProfile.avatar_url,
          avatar_source: refreshedProfile.avatar_source,
          avatar_consent: refreshedProfile.avatar_consent,
          profile_picture_consent: refreshedProfile.avatar_consent,
          ...(refreshedTenantSlug
            ? {
                tenantSlug: refreshedTenantSlug,
                tenant_slug: refreshedTenantSlug,
                tenant: {
                  ...(user.tenant || {}),
                  slug: refreshedTenantSlug,
                  tenant_slug: refreshedTenantSlug,
                },
              }
            : {}),
        });
      }
      setMensaje(successMsg);
    } catch (err) {
      setError(getErrorMessage(err, "Error al guardar el perfil."));
    } finally {
      setLoadingGuardar(false);
    }
  };

  const handleCancelProfileChanges = useCallback(() => {
    setMensaje(null);
    setError(null);
    void fetchPerfil({ tenantSlug: profileTenantScope });
  }, [fetchPerfil, profileTenantScope]);

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => { // Tipado de 'e'
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0]);
    } else {
      setArchivo(null);
    }
    setResultadoCatalogo(null);
    setParsedColumns([]);
    setSuggestedMappings({});
    setPreviewRecords([]);
    setAnalysisSummary(null);
    setAnalysisWarnings([]);
    setAnalysisSource(null);
    setAnalysisConfidence(null);
    setAnalysisEngine(null);
  };

  const processFileWithMapping = async (fileToProcess: File, mappingId: string, mappingName?: string) => {
    setLoadingCatalogo(true);
    setResultadoCatalogo(null);
    const entityType = isPyme ? 'pymes' : 'municipal';

    try {
      if (!user?.id) {
        setResultadoCatalogo({ message: "Usuario no identificado.", type: "error" });
        return;
      }
      const formData = new FormData();
      formData.append("file", fileToProcess, fileToProcess.name);
      formData.append("mappingId", mappingId);

      const processingResult = await apiFetch<any>(`/${entityType}/${user?.id}/process-catalog-file`, {
        method: "POST",
        body: formData,
        omitEntityToken: true,
        suppressPanel401Redirect: true,
        preserveAuthOn401: true,
      });

      setResultadoCatalogo({
        message: processingResult.mensaje || "¡Catálogo subido, procesado y enviado al vector store!",
        type: "success",
      });
      setArchivo(null);
      setIsMappingModalOpen(false);
      refreshVectorSyncStatus();

    } catch (err) {
      const errorMessage = getErrorMessage(err, "Ocurrió un error en el proceso.");
      setResultadoCatalogo({ message: errorMessage, type: "error" });
    } finally {
      setLoadingCatalogo(false);
    }
  };

  const handleSubirArchivo = async () => {
    if (!archivo) {
      setResultadoCatalogo({
        message: "Seleccioná un archivo válido.",
        type: "error",
      });
      return;
    }
    
    setLoadingCatalogo(true);
    setResultadoCatalogo(null);

    // 1. Intentar obtener mapeos existentes para decidir el flujo
    const entityId = user?.id;
    const entityType = isPyme ? 'pymes' : 'municipal';
    if (!entityId) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo identificar la entidad." });
      setLoadingCatalogo(false);
      return;
    }

    let configs: MappingConfig[] = mappingConfigs;
    // Si mappingConfigs no se ha cargado aún (ej. el usuario no abrió el diálogo de gestión)
    // podríamos cargarlas aquí ad-hoc, o asumir que si no están cargadas, no hay ninguna.
    // Por simplicidad inicial, si no están en estado, las cargamos.
    if (configs.length === 0 && !loadingMappings) { // Evitar recargar si ya se están cargando
        try {
            configs = await apiFetch<MappingConfig[]>(`/${entityType}/${entityId}/catalog-mappings`) || [];
            setMappingConfigs(configs); // Actualizar estado si se cargan aquí
        } catch (fetchErr) {
            // No bloquear la subida si esto falla, se procederá como si no hubiera mapeos
            console.warn("No se pudieron cargar mapeos existentes antes de subir archivo:", fetchErr);
        }
    }

    // Lógica para elegir mapeo predeterminado o único
    let selectedMapping: MappingConfig | undefined;

    if (configs.length === 1) {
      selectedMapping = configs[0];
    } else if (configs.length > 1) {
      selectedMapping = configs.find(c => c.is_default || c.isDefault);
    }

    if (selectedMapping) {
      // Si encontramos un mapeo adecuado, procesamos directamente
      await processFileWithMapping(archivo, selectedMapping.id, selectedMapping.name);
    } else {
      // Si no hay mapeos o hay ambigüedad sin default, abrimos el modal para crear o configurar
      setIsMappingModalOpen(true);
      setLoadingCatalogo(false);
    }
  };

  // Lógica de parseo y guardado para el nuevo flujo del modal
  const parseFileAndSuggest = useCallback(
    async (fileToParse: File, options: { forceAi?: boolean } = {}) => {
      if (!fileToParse) return;
      setIsParsing(true);
      setFileProcessingError(null);
      setParsedColumns([]);
      setSuggestedMappings({});
      setPreviewRecords([]);
      setAnalysisSummary(null);
      setAnalysisWarnings([]);
      setAnalysisSource(null);
      setAnalysisConfidence(null);
      setAnalysisEngine(null);

      try {
        let headers: string[] = [];
        const fileType = fileToParse.name.split('.').pop()?.toLowerCase() || '';
        const isStructured = ['csv', 'txt', 'xls', 'xlsx'].includes(fileType);
        const shouldUseAi = options.forceAi || !isStructured;

        if (shouldUseAi) {
          if (!user?.id) {
            throw new Error('Necesitamos el identificador de tu cuenta para ejecutar el análisis inteligente.');
          }
          const entityType = isPyme ? 'pymes' : 'municipal';

          const preview = await requestDocumentPreview({
            entityId: user.id,
            entityType,
            file: fileToParse,
            options: {
              hasHeaders: true,
              skipRows: 0,
              useAi: true,
              aiProvider: 'openai',
              fallbackProviders: ['docai'],
            },
          });

          const normalizedHeaders = (preview.columns ?? []).map((header, index) =>
            typeof header === 'string' && header.trim()
              ? header.trim()
              : `Columna ${index + 1}`,
          );

          headers = normalizedHeaders.length > 0
            ? normalizedHeaders
            : Array.from(
                { length: Object.keys(preview.records?.[0] ?? {}).length || 0 },
                (_, index) => `Columna ${index + 1}`,
              );

          setPreviewRecords(
            buildPreviewRecords(headers, (preview.records ?? []).slice(0, MODAL_PREVIEW_ROWS)),
          );

          const combinedWarnings = [
            ...(preview.warnings ?? []),
            ...(preview.metadata?.warnings ?? []),
          ].filter((warning): warning is string => Boolean(warning && warning.trim()));

          setAnalysisWarnings(combinedWarnings);
          setAnalysisSummary(preview.summary ?? preview.metadata?.summary ?? null);
          setAnalysisSource((preview.metadata?.sourceType ?? fileType) || 'documento');
          setAnalysisConfidence(
            typeof preview.metadata?.confidence === 'number'
              ? preview.metadata.confidence
              : null,
          );
          setAnalysisEngine(preview.metadata?.engine ?? 'OpenAI');
        } else if (fileType === 'csv' || fileType === 'txt') {
          const text = await fileToParse.text();
          const result = Papa.parse<string[]>(text, { preview: MODAL_PREVIEW_ROWS + 1, skipEmptyLines: true });
          if (result.errors.length > 0) {
            throw new Error(`Error al parsear CSV: ${result.errors[0].message}`);
          }

          const rows = result.data as string[][];
          headers = (rows[0] || []).map((value, index) => value?.trim() || `Columna ${index + 1}`);
          const previewRows = rows.slice(1, MODAL_PREVIEW_ROWS + 1);
          setPreviewRecords(buildPreviewRecords(headers, previewRows));
          setAnalysisSource(fileType);
        } else if (fileType === 'xlsx' || fileType === 'xls') {
          const arrayBuffer = await fileToParse.arrayBuffer();
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];

          if (jsonData.length > 0) {
            headers = jsonData[0].map((value, index) => String(value || '').trim() || `Columna ${index + 1}`);
            const previewRows = jsonData.slice(1, MODAL_PREVIEW_ROWS + 1);
            setPreviewRecords(buildPreviewRecords(headers, previewRows));
          }
          setAnalysisSource('excel');
        } else {
          throw new Error('Tipo de archivo no soportado. Activá el análisis inteligente para procesar PDFs u otros formatos.');
        }

        if (headers.length === 0) {
          throw new Error('No se encontraron columnas/encabezados en el archivo.');
        }

        setParsedColumns(headers);
        const suggestions = suggestMappings(headers, systemFields);
        const newMappings: Record<string, string | null> = {};
        suggestions.forEach((s) => {
          newMappings[s.systemFieldKey] = s.userColumn;
        });
        setSuggestedMappings(newMappings);
      } catch (e) {
        setFileProcessingError(getErrorMessage(e, 'Error al procesar el archivo.'));
      } finally {
        setIsParsing(false);
      }
    },
    [systemFields, user?.id],
  );

  useEffect(() => {
    if (isMappingModalOpen && archivo) {
      parseFileAndSuggest(archivo);
    }
  }, [isMappingModalOpen, archivo, parseFileAndSuggest]);

  const handleConfirmAndProcess = async () => {
    if (!archivo || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "Falta el archivo o el ID de usuario." });
      return;
    }

    setLoadingCatalogo(true);
    setResultadoCatalogo(null);

    // 1. Guardar la configuración de mapeo generada automáticamente
    const mappingName = `Mapeo para ${archivo.name} (${new Date().toLocaleString()})`;
    const entityType = isPyme ? 'pymes' : 'municipal';
    const configToSave = {
      pymeId: user.id,
      name: mappingName,
      mappings: suggestedMappings,
      fileSettings: { hasHeaders: true, skipRows: 0 }, // Usamos defaults simples
    };

    try {
      // Asumimos que el backend está listo para recibir esto.
      const savedMapping = await apiFetch<any>(`/${entityType}/${user.id}/catalog-mappings`, {
        method: 'POST',
        body: configToSave,
        omitEntityToken: true,
      });

      toast({ title: "Paso 1/2: Formato guardado", description: `Se guardó la configuración "${mappingName}".` });

      // 2. Ahora, procesar el archivo usando este nuevo mapeo
      await processFileWithMapping(archivo, savedMapping.id, mappingName);

    } catch (err) {
      const errorMessage = getErrorMessage(err, "Ocurrió un error en el proceso.");
      setResultadoCatalogo({ message: errorMessage, type: "error" });
      setLoadingCatalogo(false);
      // Mantener el modal abierto en caso de error para que el usuario pueda reintentar o cancelar.
    }
  };

  const handleDeleteMapping = async () => {
    if (!mappingToDelete || !user?.id) return;
    setLoadingMappings(true); // Reutilizar loading para el diálogo
    const entityType = isPyme ? 'pymes' : 'municipal';
    try {
      await apiFetch<void>(`/${entityType}/${user.id}/catalog-mappings/${mappingToDelete.id}`, {
        method: 'DELETE',
        omitEntityToken: true,
      });
      toast({
        title: "Configuración eliminada",
        description: `El formato "${mappingToDelete.name}" fue eliminado.`,
      });
      setMappingToDelete(null);
      fetchMappingConfigs(); // Recargar la lista
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: getErrorMessage(err),
      });
    } finally {
      setLoadingMappings(false);
    }
  };


  const plan = (perfil.plan || '').toLowerCase();
  const limitePlan =
    plan === 'full'
      ? Infinity
      : plan === 'pro'
      ? perfil.limite_preguntas || 250
      : perfil.limite_preguntas;

  const porcentaje =
    limitePlan === Infinity
      ? 100
      : limitePlan > 0
      ? Math.min((perfil.preguntas_usadas / limitePlan) * 100, 100)
      : 0;

  const resolveBackofficeModuleIcon = (moduleId: string) => {
    const normalized = moduleId.toLowerCase();
    if (normalized.includes('report') || normalized.includes('stat')) return BarChart3;
    if (normalized.includes('survey') || normalized.includes('vote')) return Vote;
    if (normalized.includes('catalog') || normalized.includes('inventory') || normalized.includes('marketplace')) return Package;
    if (normalized.includes('people') || normalized.includes('user') || normalized.includes('team')) return Users;
    if (normalized.includes('map')) return MapPinned;
    if (normalized.includes('analytics') || normalized.includes('ai')) return Sparkles;
    if (normalized.includes('order') || normalized.includes('ticket') || normalized.includes('operation')) return ClipboardList;
    return LayoutDashboard;
  };

  const resolveBackofficeModuleDescription = (moduleId: string) => {
    const normalized = moduleId.trim().toLowerCase();
    if (normalized === 'operations') {
      return esMunicipio
        ? 'Casos, conversaciones y seguimiento de atención ciudadana.'
        : 'Casos, conversaciones y seguimiento comercial.';
    }
    if (normalized === 'reports') return 'Indicadores operativos, tendencias y exportaciones.';
    if (normalized === 'surveys') return 'Campañas, participación y resultados trazables.';
    if (normalized === 'people') return 'Contactos, responsables, roles y permisos.';
    if (normalized === 'maps') return 'Actividad territorial, zonas y prioridades georreferenciadas.';
    if (normalized === 'advanced_analytics') return 'Análisis ejecutivo, segmentos y hallazgos asistidos.';
    if (['catalog', 'inventory', 'marketplace'].includes(normalized)) {
      return esMunicipio
        ? 'Servicios, recursos y disponibilidad publicada.'
        : 'Productos, inventario y disponibilidad comercial.';
    }
    return 'Herramientas habilitadas para este espacio de trabajo.';
  };

  const moduleRouteToTarget = (
    moduleId: string,
    route?: string | null,
  ): Pick<ControlCenterCard, 'tab' | 'path'> => {
    const normalizedId = moduleId.trim().toLowerCase();
    if (normalizedId === 'operations') return { tab: 'tickets' };
    if (normalizedId === 'reports') return { tab: 'estadisticas' };
    if (normalizedId === 'surveys') return { path: '/admin/encuestas' };
    if (normalizedId === 'people') {
      return { tab: workspaceCapabilities.team ? 'empleados' : 'usuarios' };
    }
    if (normalizedId === 'maps') return { tab: 'mapas' };
    if (normalizedId === 'advanced_analytics') return { tab: 'analytics' };

    if (!route) return {};
    const tabMatch = route.match(/[?&]tab=([^&]+)/);
    const tab = tabMatch?.[1] as ProfileTabValue | undefined;
    if (tab && ['perfil', 'tickets', 'pedidos', 'estadisticas', 'analytics', 'catalogo', 'usuarios', 'empleados', 'mapas'].includes(tab)) {
      return { tab };
    }
    return { path: route };
  };

  const backendModuleAllowedInWorkspace = (moduleId: string) => {
    const normalizedId = moduleId.trim().toLowerCase();
    if (normalizedId === 'operations') return workspaceCapabilities.operation;
    if (normalizedId === 'reports') return workspaceCapabilities.reports;
    if (normalizedId === 'surveys') return workspaceCapabilities.participation;
    if (normalizedId === 'people') {
      return workspaceCapabilities.contacts || workspaceCapabilities.team;
    }
    if (normalizedId === 'maps') return workspaceCapabilities.territory;
    if (normalizedId === 'advanced_analytics') return workspaceCapabilities.analytics;
    if (['catalog', 'inventory', 'marketplace'].includes(normalizedId)) {
      return workspaceCapabilities.catalog;
    }
    return false;
  };

  const backendControlCards = useMemo<ControlCenterCard[]>(() => {
    const modules = backofficeNavigation?.modules;
    if (!Array.isArray(modules) || modules.length === 0) return [];
    return modules
      .filter((module) => {
        const id = String(module.id || '').trim();
        return module.enabled !== false && Boolean(id) && backendModuleAllowedInWorkspace(id);
      })
      .slice()
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .map((module) => {
        const id = module.id || module.label || module.route || 'module';
        return {
          id,
          title: module.label || module.title || id,
          description: module.description || resolveBackofficeModuleDescription(id),
          icon: resolveBackofficeModuleIcon(id),
          actionLabel: 'Abrir',
          enabled: module.enabled !== false,
          ...moduleRouteToTarget(id, module.route || module.path),
        };
      });
  }, [backofficeNavigation?.modules, esMunicipio, workspaceCapabilities]);

  const openControlCenterItem = (item: ControlCenterCard) => {
    if (item.enabled === false) return;
    if (item.tab) {
      updateProfileTab(item.tab);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (item.path) {
      navigate(item.path);
    }
  };

  const primaryControlCards: ControlCenterCard[] = ([
    {
      id: "operations",
      title: esMunicipio ? "Operar reclamos" : "Operar conversaciones",
      description: esMunicipio
        ? "Entrar a reclamos, estados, ubicaciones y seguimiento diario."
        : "Ver tickets, pedidos, ventas y conversaciones que requieren accion.",
      icon: ClipboardList,
      actionLabel: "Abrir operacion",
      tab: "tickets",
      enabled: workspaceCapabilities.operation,
    },
    {
      id: "reports",
      title: "Reportes claros",
      description: "Resumen operativo, mapas de calor, prioridades y datos listos para revisar.",
      icon: BarChart3,
      actionLabel: "Ver reportes",
      tab: "estadisticas",
      enabled: workspaceCapabilities.reports,
    },
    {
      id: "surveys",
      title: "Encuestas y sondeos",
      description: "Gestionar participacion, votaciones, comentarios y resultados en vivo.",
      icon: Vote,
      actionLabel: "Abrir encuestas",
      path: "/admin/encuestas",
      enabled: workspaceCapabilities.participation,
    },
    {
      id: "people",
      title: "Personas y accesos",
      description: "Usuarios, empleados, permisos y responsables del equipo.",
      icon: Users,
      actionLabel: "Gestionar personas",
      tab: workspaceCapabilities.team ? "empleados" : "usuarios",
      enabled: workspaceCapabilities.team || workspaceCapabilities.contacts,
    },
  ] satisfies ControlCenterCard[]).filter((item) => item.enabled !== false);

  const secondaryControlCards: ControlCenterCard[] = ([
    {
      id: "catalog",
      title: "Catalogo e inventario",
      description: "Productos, recursos, stock, importaciones y calidad del catalogo publicados por backend.",
      icon: Package,
      actionLabel: "Abrir catalogo",
      tab: "catalogo",
      enabled: workspaceCapabilities.catalog,
    },
    {
      id: "ai-analytics",
      title: "Analitica avanzada e IA",
      description: "Investigacion, segmentos, resumen ejecutivo y exportaciones para equipos avanzados.",
      icon: Sparkles,
      actionLabel: "Abrir analitica",
      tab: "analytics",
      enabled: workspaceCapabilities.analytics,
    },
    {
      id: "maps",
      title: "Mapa operativo",
      description: "Ver zonas calientes, puntos georreferenciados y capas territoriales disponibles.",
      icon: MapPinned,
      actionLabel: "Abrir mapas",
      tab: "mapas",
      enabled: workspaceCapabilities.territory,
    },
    {
      id: "users",
      title: "Usuarios finales",
      description: "Consultar contactos, cuentas, actividad y datos de relacion con la organizacion.",
      icon: UserCog,
      actionLabel: "Ver usuarios",
      tab: "usuarios",
      enabled: workspaceCapabilities.contacts,
    },
  ] satisfies ControlCenterCard[]).filter((item) => item.enabled !== false);
  const controlCardsFromBackend = backendControlCards.length > 0;
  const renderedPrimaryControlCards = controlCardsFromBackend
    ? backendControlCards.slice(0, 4)
    : primaryControlCards;
  const renderedSecondaryControlCards = controlCardsFromBackend
    ? backendControlCards.slice(4)
    : secondaryControlCards;
  const backofficeScope = esMunicipio ? 'municipio' : user?.tipo_chat || perfil.rubro || 'pyme';
  const isWorkspaceProfileTab = activeProfileTab === "tickets" || activeProfileTab === "analytics";
  const workspaceNavigation = backofficeNavigationStatus === 'ready' ? (
    <ProfileWorkspaceNavigation
      activeTab={activeProfileTab}
      activeActionId={
        activeProfileTab === "perfil" && activeInstitutionSection === "plan-security"
          ? "billing"
          : undefined
      }
      capabilities={workspaceCapabilities}
      isMunicipal={esMunicipio}
      onOpenPlan={openPlanAndBilling}
      onOpenSurveys={() => navigate("/admin/encuestas")}
      onTabChange={updateProfileTab}
    />
  ) : (
    <div
      className={cn(
        "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-sm",
        backofficeNavigationStatus === 'denied'
          ? "border-amber-500/30 bg-amber-500/5"
          : backofficeNavigationStatus === 'error'
            ? "border-destructive/30 bg-destructive/5"
            : "border-border/70 bg-card/95",
      )}
      data-testid="backoffice-navigation-status"
      role={backofficeNavigationStatus === 'loading' ? 'status' : 'alert'}
    >
      <span className="flex min-w-0 items-center gap-3">
        {backofficeNavigationStatus === 'loading' ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0">
          <span className="block font-semibold text-foreground">
            {backofficeNavigationStatus === 'denied'
              ? 'Acceso operativo no habilitado'
              : backofficeNavigationStatus === 'error'
                ? 'No pudimos verificar los módulos'
                : 'Verificando accesos del equipo'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {backofficeNavigationStatus === 'denied'
              ? 'Un administrador debe asignar alcance operativo a este perfil.'
              : backofficeNavigationStatus === 'error'
                ? 'No mostramos accesos hasta validar permisos con el servidor.'
                : 'Consultando el contrato de módulos habilitados para esta organización.'}
          </span>
        </span>
      </span>
      {backofficeNavigationStatus === 'error' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            backofficeNavigationScopeRef.current = null;
            setBackofficeNavigationRevision((revision) => revision + 1);
          }}
        >
          Reintentar
        </Button>
      ) : null}
    </div>
  );

  if (!profileReady) {
    return (
      <div className="flex min-h-screen flex-col bg-background px-2 py-6 text-foreground dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 sm:px-4 md:px-6 lg:px-8">
        <section className="mx-auto mt-24 flex w-full max-w-3xl flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/80 p-8 text-center shadow-sm">
          <Loader2 className="mb-4 h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Centro de control</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Sincronizando panel operativo</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Cargando perfil, rubro y permisos antes de mostrar reclamos, reportes y equipo.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900",
        activeProfileTab === "tickets"
          ? "h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden px-1 py-1 sm:px-2 md:px-3"
          : activeProfileTab === "analytics"
            ? "min-h-screen px-1 py-1 sm:px-2 md:px-3"
          : "min-h-screen px-2 py-4 sm:px-4 md:px-6 lg:px-8",
      )}
    >
      <div
        className={cn(
          "mx-auto w-full shrink-0",
          isWorkspaceProfileTab
            ? "mb-1 max-w-[min(2200px,calc(100vw-0.5rem))] px-1 pt-1"
            : "mb-5 max-w-7xl px-2 pt-16 sm:pt-0",
        )}
      >
        {isWorkspaceProfileTab ? (
          <div className="flex min-h-9 items-center gap-2 rounded-lg border border-border/70 bg-card/90 px-2.5 py-1.5 shadow-sm backdrop-blur sm:px-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  {activeProfileTab === "tickets" ? "Consola tickets" : "Consola analitica"}
                </p>
                <span className="hidden h-3 w-px bg-border sm:block" />
                <h1 className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base">
                  {perfil.nombre_empresa || "Panel de Empresa"}
                </h1>
              </div>
            </div>
          </div>
        ) : (
        <div className="clear-both rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="mt-1 inline-block align-middle">
                <MunicipioIcon />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Espacio de trabajo</p>
                <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
                  {perfil.nombre_empresa || "Panel de Empresa"}
                </h1>
                <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
                  Atención, relaciones, inteligencia y administración organizadas según el trabajo de cada equipo.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-14 lg:pl-0" aria-label="Contexto de la organización">
              {isTenantAdministrator ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateInstitutionSection("general")}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Perfil institucional
                </Button>
              ) : null}
              <Badge variant="outline" className="rounded-md px-2.5 py-1 text-xs font-medium">
                {esMunicipio ? "Gestión municipal" : "Gestión comercial"}
              </Badge>
              <Badge variant="secondary" className="rounded-md px-2.5 py-1 text-xs font-medium">
                {isTenantAdministrator ? "Administrador" : "Operador"}
              </Badge>
            </div>
          </div>
        </div>
        )}
      </div>

      {activeProfileTab === "perfil" ? (
        <div className="sticky top-0 z-30 mx-auto mb-5 w-full max-w-7xl bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {workspaceNavigation}
        </div>
      ) : null}

      {activeProfileTab === "perfil" && !isInstitutionProfileOpen && backofficeNavigationStatus === 'ready' && hasAnyWorkspaceCapability && (
      <section className="mx-auto mb-5 w-full max-w-7xl space-y-5 px-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Inicio</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Trabajo de hoy</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accesos priorizados por rol. Cada módulo abre directamente donde se resuelve la tarea.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-md px-2.5 py-1 text-xs font-medium">
            {renderedPrimaryControlCards.length + renderedSecondaryControlCards.length} módulos habilitados
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {renderedPrimaryControlCards.map((item) => (
            <ControlCenterCardButton key={item.id} item={item} onOpen={openControlCenterItem} />
          ))}
        </div>

        <BackofficeCommandCenter tenantSlug={derivedTenantSlug} scope={backofficeScope} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          {renderedSecondaryControlCards.length > 0 ? (
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Más áreas de trabajo</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {renderedSecondaryControlCards.map((item) => (
                  <ControlCenterCardButton key={item.id} item={item} onOpen={openControlCenterItem} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          <details
            className="group rounded-xl border border-border/70 bg-card/80 shadow-sm"
            open={isChannelSetupOpen}
            onToggle={(event) => setIsChannelSetupOpen(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Canales e integraciones
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Configuración técnica separada de la operación diaria.
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            {isChannelSetupOpen ? (
              <div className="border-t border-border/70 p-3">
                <ChannelActivationChecklist
                  tenantSlug={derivedTenantSlug}
                  initialData={
                    profileChannelActivation === undefined
                      ? (user as any)?.channel_activation || null
                      : profileChannelActivation
                  }
                  highlighted={shouldHighlightChannelSetup}
                />
              </div>
            ) : null}
          </details>
        </div>
      </section>
      )}

      <div
        className={cn(
          "mx-auto w-full",
          activeProfileTab === "tickets"
            ? "flex min-h-0 flex-1 flex-col max-w-[min(2200px,calc(100vw-0.5rem))] px-1"
            : activeProfileTab === "analytics"
              ? "max-w-[min(2200px,calc(100vw-0.5rem))] px-1"
            : "max-w-7xl",
        )}
      >
        {activeProfileTab !== "perfil" ? (
          <div
            className={cn(
              "sticky z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
              activeProfileTab === "tickets"
                ? "top-0 -mx-1 px-1 py-0.5"
                : "top-0 -mx-1 px-1 py-1",
            )}
          >
            {workspaceNavigation}
          </div>
        ) : null}
        <WorkspacePanel active={activeProfileTab === "perfil" && isInstitutionProfileOpen} label="Perfil institucional">
          <InstitutionProfileWorkspace
            activeSection={activeInstitutionSection}
            institutionName={perfil.nombre_empresa}
            isMunicipal={esMunicipio}
            isAdministrator={isTenantAdministrator}
            loading={loadingGuardar}
            plan={perfil.plan}
            onCancel={handleCancelProfileChanges}
            onSave={handleGuardar}
            onSectionChange={updateInstitutionSection}
          >
            {mensaje ? (
              <Alert className="mb-5 border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertTitle>Cambios guardados</AlertTitle>
                <AlertDescription>{mensaje}</AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="destructive" className="mb-5">
                <XCircle className="h-4 w-4" />
                <AlertTitle>No pudimos completar la operación</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {activeInstitutionSection === "general" ? (
              <div className="grid max-w-4xl gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="nombre_empresa">Nombre legal o institucional</Label>
                  <Input
                    id="nombre_empresa"
                    value={perfil.nombre_empresa}
                    onChange={handleInputChange}
                    required
                    autoComplete="organization"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Se muestra en el encabezado del espacio de trabajo y en las comunicaciones oficiales.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono institucional o de contacto — no configura WhatsApp</Label>
                  <Input
                    id="telefono"
                    placeholder="+54 9 261 000 0000"
                    value={perfil.telefono}
                    onChange={handleInputChange}
                    required
                    autoComplete="tel"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Es un dato de contacto del perfil. El número oficial de WhatsApp se vincula y verifica en Canales.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link_web">Sitio institucional</Label>
                  <Input
                    id="link_web"
                    type="url"
                    placeholder="https://municipio.gob.ar"
                    value={perfil.link_web}
                    onChange={handleInputChange}
                    required
                    autoComplete="url"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    URL pública de referencia; no modifica dominios ni despliegues.
                  </p>
                </div>
              </div>
            ) : null}

            {activeInstitutionSection === "identity" ? (
              <div className="grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo institucional</Label>
                    <Input
                      id="logo_url"
                      type="url"
                      inputMode="url"
                      placeholder="https://.../logo.png"
                      value={perfil.logo_url}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      Identidad visual de la organización. La personalización de dominio y marca se gobierna por tenant.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avatar_url">Imagen personal autorizada</Label>
                    <Input
                      id="avatar_url"
                      type="url"
                      inputMode="url"
                      placeholder="https://..."
                      value={perfil.avatar_url}
                      onChange={handleInputChange}
                      disabled={avatarUploading}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={avatarUploading} asChild>
                        <label htmlFor="avatar_file_upload">
                          <UploadCloud className="mr-2 h-4 w-4" />
                          {avatarUploading ? "Subiendo..." : "Subir imagen"}
                        </label>
                      </Button>
                      <Input
                        id="avatar_file_upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={handleProfileAvatarUpload}
                        disabled={avatarUploading}
                      />
                      <Badge variant="outline">
                        {perfil.avatar_consent && perfil.avatar_url ? "Uso autorizado" : "Fallback seguro"}
                      </Badge>
                    </div>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
                    <Checkbox
                      checked={Boolean(perfil.avatar_consent)}
                      onCheckedChange={(checked) =>
                        setPerfil((prev) => ({ ...prev, avatar_consent: Boolean(checked) }))
                      }
                      disabled={avatarUploading || !perfil.avatar_url.trim()}
                      aria-label="Autorizar imagen personal"
                    />
                    <span>
                      <span className="block font-semibold text-foreground">Autorizar uso de esta imagen</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        Solo se usa en CRM y operación con consentimiento explícito. No se obtienen fotos desde WhatsApp ni por scraping.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Vista previa</p>
                  <div className="mt-5 flex flex-col items-center gap-3 text-center">
                    <IdentityAvatar
                      name={user?.name || perfil.nombre_empresa || user?.email || "Usuario"}
                      avatarUrl={perfil.avatar_consent ? perfil.avatar_url : ""}
                      source={perfil.avatar_consent && perfil.avatar_url ? "imagen consentida" : "iniciales"}
                      consented={perfil.avatar_consent}
                      size="lg"
                    />
                    <div>
                      <p className="font-semibold text-foreground">{user?.name || "Administrador institucional"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{perfil.nombre_empresa || "Organización"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeInstitutionSection === "location" ? (
              <div className="max-w-5xl space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="direccion">Domicilio institucional</Label>
                  <AddressAutocomplete
                    id="direccion"
                    value={perfil.direccion ? { label: perfil.direccion, value: perfil.direccion } : null}
                    onChange={handleAddressOptionChange}
                    onSelect={handleAddressSelect}
                    placeholder="Ej: Av. Principal 123"
                    persistKey="perfil_direccion"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Se utiliza como referencia administrativa. No crea barrios, zonas oficiales ni puntos de reclamos.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input id="ciudad" value={perfil.ciudad} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provincia">Provincia</Label>
                    <select
                      id="provincia"
                      value={perfil.provincia}
                      onChange={handleInputChange}
                      required
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Seleccioná una provincia</option>
                      {PROVINCIAS.map((province) => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {hasValidLocation ? "Referencia geográfica disponible" : "Sin coordenadas validadas"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {geocodingStatus === "loading"
                        ? "Buscando coordenadas para el domicilio ingresado..."
                        : hasValidLocation
                          ? `${perfil.latitud?.toFixed?.(5)}, ${perfil.longitud?.toFixed?.(5)}`
                          : "Guardá una dirección válida o elegí el punto desde el mapa operativo."}
                    </p>
                    {geocodingError ? <p className="mt-1 text-xs text-destructive">{geocodingError}</p> : null}
                  </div>
                  {workspaceCapabilities.territory ? (
                    <Button type="button" variant="outline" onClick={() => updateProfileTab("mapas")}>
                      <MapPinned className="mr-2 h-4 w-4" /> Abrir mapa operativo
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeInstitutionSection === "hours" ? (
              <div className="max-w-4xl space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={modoHorario === "comercial" ? "secondary" : "outline"}
                    onClick={setHorarioComercial}
                  >
                    Horario estándar
                  </Button>
                  <Button
                    type="button"
                    variant={modoHorario === "personalizado" ? "secondary" : "outline"}
                    onClick={setHorarioPersonalizado}
                  >
                    Personalizar por día
                  </Button>
                </div>
                {modoHorario === "comercial" ? (
                  <Alert>
                    <Clock3 className="h-4 w-4" />
                    <AlertTitle>Lunes a viernes, 09:00 a 20:00</AlertTitle>
                    <AlertDescription>Sábados y domingos cerrados.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    {DIAS.map((dia, idx) => (
                      <div
                        key={dia}
                        className="grid gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 sm:grid-cols-[8rem_8rem_minmax(0,1fr)] sm:items-center"
                      >
                        <span className="font-medium text-foreground">{dia}</span>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={perfil.horarios_ui[idx].cerrado}
                            onCheckedChange={(checked) => handleHorarioChange(idx, "cerrado", Boolean(checked))}
                            aria-label={`${dia} cerrado`}
                          />
                          Cerrado
                        </label>
                        {!perfil.horarios_ui[idx].cerrado ? (
                          <div className="flex max-w-sm items-center gap-2">
                            <Input
                              type="time"
                              value={perfil.horarios_ui[idx].abre}
                              onChange={(event) => handleHorarioChange(idx, "abre", event.target.value)}
                              aria-label={`${dia} apertura`}
                            />
                            <span className="text-muted-foreground">a</span>
                            <Input
                              type="time"
                              value={perfil.horarios_ui[idx].cierra}
                              onChange={(event) => handleHorarioChange(idx, "cierra", event.target.value)}
                              aria-label={`${dia} cierre`}
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin atención programada</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeInstitutionSection === "channels" ? (
              <div className="space-y-5">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Los canales se habilitan por configuración verificada</AlertTitle>
                  <AlertDescription>
                    Guardar un teléfono en General no vincula WhatsApp ni demuestra entrega. La activación requiere número emisor, proveedor y validación operativa.
                  </AlertDescription>
                </Alert>
                <ChannelActivationChecklist
                  tenantSlug={derivedTenantSlug}
                  initialData={
                    profileChannelActivation === undefined
                      ? (user as any)?.channel_activation || null
                      : profileChannelActivation
                  }
                  highlighted={shouldHighlightChannelSetup}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  {esMunicipio ? (
                    <button
                      type="button"
                      onClick={() => navigate("/municipal/whatsapp")}
                      className="rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <p className="font-semibold text-foreground">Administrar WhatsApp institucional</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Número emisor, webhook, plantillas y estado del proveedor.</p>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => navigate(esMunicipio ? "/municipal/integrations" : derivedTenantSlug ? `/${derivedTenantSlug}/integracion` : "/integracion")}
                    className="rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <p className="font-semibold text-foreground">Integraciones y canales web</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Configuración técnica aislada de este registro institucional.</p>
                  </button>
                </div>
              </div>
            ) : null}

            {activeInstitutionSection === "plan-security" ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
                <PlanUsagePanel
                  canManageBilling={canManageBilling}
                  limit={limitePlan}
                  percentage={porcentaje}
                  plan={perfil.plan || ""}
                  used={perfil.preguntas_usadas || 0}
                />
                <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Gobierno de acceso</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Roles normalizados, permisos por módulo y trazabilidad de cambios.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-lg border border-border/70 bg-background p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Rol actual</p>
                      <p className="mt-1 font-semibold text-foreground">{isTenantAdministrator ? "Administrador del tenant" : normalizedRole || "Sin rol operativo"}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Organización</p>
                      <p className="mt-1 truncate font-semibold text-foreground">{derivedTenantSlug || "Sin tenant validado"}</p>
                    </div>
                  </div>
                  {workspaceCapabilities.team ? (
                    <Button type="button" variant="outline" className="w-full" onClick={() => updateProfileTab("empleados")}>
                      Gestionar equipo y permisos
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </InstitutionProfileWorkspace>

          {false && (
          <details
            className="group mt-3 rounded-xl border border-border/70 bg-card/80 shadow-sm"
            open={false}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Administración</span>
                <span className="mt-1 block text-base font-semibold text-foreground">Organización, planes e integraciones</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Datos institucionales, horarios, facturación y configuración técnica.
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
          <div className="mx-auto flex w-full flex-col items-stretch gap-6 border-t border-border/70 px-4 py-5 md:flex-row md:gap-8">
            {/* Columna Izquierda: Datos de la Empresa y Mapa */}
            <div className="md:w-2/3 flex flex-col gap-6 md:gap-8">
              <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex flex-col flex-grow">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-primary">
                    Datos de tu Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col flex-grow"> {/* Removed space-y-6 */}
                  <form onSubmit={handleGuardar} className="flex flex-col flex-grow space-y-6"> {/* Added flex flex-col flex-grow */}
                    <div>
                      <Label
                        htmlFor="nombre_empresa"
                        className="text-muted-foreground text-sm mb-1 block"
                      >
                        Nombre de la empresa*
                      </Label>
                      <Input
                        id="nombre_empresa"
                        value={perfil.nombre_empresa}
                        onChange={handleInputChange}
                        required
                        className="bg-input border-input text-foreground"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="telefono"
                          className="text-muted-foreground text-sm mb-1 block"
                        >
                          Teléfono* (con cód. país y área)
                        </Label>
                        <Input
                          id="telefono"
                          placeholder="+5492611234567"
                          value={perfil.telefono}
                          onChange={handleInputChange}
                          required
                          className="bg-input border-input text-foreground"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="link_web"
                          className="text-muted-foreground text-sm mb-1 block"
                        >
                          Sitio Web / Tienda Online*
                        </Label>
                        <Input
                          id="link_web"
                          type="url"
                          placeholder="https://ejemplo.com"
                          value={perfil.link_web}
                          onChange={handleInputChange}
                          required
                          className="bg-input border-input text-foreground"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label
                          htmlFor="avatar_url"
                          className="text-muted-foreground text-sm mb-1 block"
                        >
                          Imagen personal del usuario
                        </Label>
                        <div className="grid grid-cols-[auto,1fr] items-center gap-3 rounded-lg border border-input bg-input/40 p-3">
                          <IdentityAvatar
                            name={user?.name || perfil.nombre_empresa || user?.email || "Usuario"}
                            avatarUrl={perfil.avatar_consent ? perfil.avatar_url : ""}
                            source={perfil.avatar_consent && perfil.avatar_url ? "imagen consentida" : "iniciales"}
                            consented={perfil.avatar_consent}
                            size="lg"
                          />
                          <div className="space-y-2">
                            <Input
                              id="avatar_url"
                              type="text"
                              inputMode="url"
                              placeholder="https://..."
                              value={perfil.avatar_url}
                              onChange={handleInputChange}
                              className="bg-background border-input text-foreground"
                              disabled={avatarUploading}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={avatarUploading}
                                asChild
                              >
                                <label htmlFor="avatar_file_upload">
                                  <UploadCloud className="h-4 w-4" />
                                  {avatarUploading ? "Subiendo..." : "Subir imagen"}
                                </label>
                              </Button>
                              <Input
                                id="avatar_file_upload"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="sr-only"
                                onChange={handleProfileAvatarUpload}
                                disabled={avatarUploading}
                              />
                            {perfil.avatar_source ? (
                              <Badge variant="secondary" className="text-[10px]">
                                {perfil.avatar_source === "profile_upload" ? "Upload consentido" : perfil.avatar_source}
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="text-[10px]">
                              {perfil.avatar_consent && perfil.avatar_url ? "Imagen real autorizada" : "Fallback seguro"}
                            </Badge>
                            <p className="text-xs leading-5 text-muted-foreground">
                              No usamos scraping ni fotos de WhatsApp. La imagen real solo sale de upload propio,
                              URL autorizada o login social con consentimiento.
                            </p>
                          </div>
                          <label className="flex items-start gap-2 rounded-md border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                              <Checkbox
                                checked={Boolean(perfil.avatar_consent)}
                                onCheckedChange={(checked) =>
                                  setPerfil((prev) => ({ ...prev, avatar_consent: Boolean(checked) }))
                                }
                                disabled={avatarUploading || !perfil.avatar_url.trim()}
                                aria-label="Autorizar imagen personal"
                              />
                              <span>Autorizar esta imagen para identificarme en CRM, reclamos, pedidos, encuestas y chats.</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor="direccion"
                        className="text-muted-foreground text-sm mb-1 block"
                      >
                        Dirección Completa*
                      </Label>
                      <AddressAutocomplete
                        id="direccion"
                        value={
                          perfil.direccion
                            ? { label: perfil.direccion, value: perfil.direccion }
                            : null
                        }
                        onChange={handleAddressOptionChange}
                        onSelect={handleAddressSelect}
                        placeholder="Ej: Av. Principal 123"
                        className="bg-input border-input text-foreground"
                        persistKey="perfil_direccion"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="ciudad"
                          className="text-muted-foreground text-sm mb-1 block"
                        >
                          Ciudad
                        </Label>
                        <Input
                          id="ciudad"
                          value={perfil.ciudad}
                          onChange={handleInputChange}
                          className="bg-input border-input text-foreground"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="provincia"
                          className="text-muted-foreground text-sm mb-1 block"
                        >
                          Provincia*
                        </Label>
                        <select
                          id="provincia"
                          value={perfil.provincia}
                          onChange={handleInputChange}
                          required
                          className="w-full h-10 rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
                        >
                          <option value="">Selecciona una provincia</option>
                          {PROVINCIAS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>


                    <div>
                      <Label className="text-muted-foreground text-sm block mb-2">
                        Horarios de Atención
                      </Label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Button
                          type="button"
                          variant={
                            modoHorario === "comercial" ? "secondary" : "outline"
                          }
                          size="sm"
                          onClick={setHorarioComercial}
                          className="border-border hover:bg-accent"
                        >
                          Automático (Lun-V 9-20)
                        </Button>
                        <Button
                          type="button"
                          variant={
                            modoHorario === "personalizado"
                              ? "secondary"
                              : "outline"
                          }
                          size="sm"
                          onClick={setHorarioPersonalizado}
                          className="border-border hover:bg-accent flex items-center"
                        >
                          {horariosOpen ? (
                            <ChevronUp className="w-4 h-4 mr-1" />
                          ) : (
                            <ChevronDown className="w-4 h-4 mr-1" />
                          )}
                          Personalizar
                        </Button>
                      </div>
                      {modoHorario === "comercial" && (
                        <div className="text-primary bg-primary/10 rounded-md border border-primary/50 p-3 flex items-center gap-2 text-xs">
                          <Info className="w-3 h-3 inline mr-1" /> L-V: 09-20. Sáb y Dom: Cerrado.
                        </div>
                      )}
                      {modoHorario === "personalizado" && horariosOpen && (
                        <div className="border border-border rounded-lg p-4 mt-2 bg-card/60 space-y-3">
                          {DIAS.map((dia, idx) => (
                            <div
                              key={dia}
                              className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[100px_auto_1fr] items-center gap-x-2 gap-y-1 text-sm"
                            >
                              <span className="font-medium text-foreground col-span-3 sm:col-span-1">
                                {dia}
                              </span>
                              <div className="flex items-center gap-2 col-span-3 sm:col-span-1 sm:justify-self-end">
                                <Label
                                  htmlFor={`cerrado-${idx}`}
                                  className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    id={`cerrado-${idx}`}
                                    checked={perfil.horarios_ui[idx].cerrado}
                                    onChange={(e) =>
                                      handleHorarioChange(
                                        idx,
                                        "cerrado",
                                        e.target.checked,
                                      )
                                    }
                                    className="form-checkbox h-4 w-4 text-primary bg-input border-border rounded focus:ring-primary cursor-pointer"
                                  />{" "}
                                  Cerrado
                                </Label>
                              </div>
                              {!perfil.horarios_ui[idx].cerrado && (
                                <div className="flex items-center gap-1 col-span-3 sm:col-span-1 sm:justify-self-start">
                                  <Input
                                    type="time"
                                    value={perfil.horarios_ui[idx].abre}
                                    className="w-full sm:w-28 bg-input border-input text-foreground h-9 text-xs rounded-md shadow-sm"
                                    onChange={(e) =>
                                      handleHorarioChange(
                                        idx,
                                        "abre",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  <span className="text-muted-foreground mx-1">-</span>
                                  <Input
                                    type="time"
                                    value={perfil.horarios_ui[idx].cierra}
                                    className="w-full sm:w-28 bg-input border-input text-foreground h-9 text-xs rounded-md shadow-sm"
                                    onChange={(e) =>
                                      handleHorarioChange(
                                        idx,
                                        "cierra",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                              )}
                              {perfil.horarios_ui[idx].cerrado && (
                                <div className="hidden sm:block sm:col-span-1"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      disabled={loadingGuardar}
                      type="submit"
                      className="w-full mt-auto bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-base rounded-lg shadow"
                    >
                      {loadingGuardar ? "Guardando Cambios..." : "Guardar Cambios"}
                    </Button>
                    {mensaje && (
                      <div className="mt-3 text-sm text-green-700 bg-green-100 p-3 rounded-md flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> {mensaje}
                      </div>
                    )}
                    {error && (
                      <div className="mt-3 text-sm text-destructive-foreground bg-destructive p-3 rounded-md flex items-center gap-2">
                        <XCircle className="w-4 h-4" /> {error}
                      </div>
                    )}
                    {geocodingError && (
                      <div className="mt-4 text-sm text-destructive-foreground bg-destructive/10 p-3 rounded-md">
                        {geocodingError}
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
              {canViewAnalytics && (
                isMapLoading ? (
                  <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex items-center justify-center h-[600px]">
                    <p className="text-muted-foreground">Cargando mapa de calor...</p>
                  </Card>
                ) : (
                  <AnalyticsHeatmap
                    initialHeatmapData={heatmapData}
                    adminLocation={municipalityCoords}
                    availableCategories={availableCategories}
                    availableBarrios={availableBarrios}
                    availableTipos={availableTipos}
                    metadata={heatmapDetails?.metadata?.map?.heatmap}
                    onSelect={handleMapSelect}
                  />
                )
              )}
            </div>

            {/* Columna Derecha: Plan, Catálogo, Integración */}
            <div className="md:w-1/3 flex flex-col gap-6 md:gap-8">
              <PlanUsagePanel
                canManageBilling={canManageBilling}
                limit={limitePlan}
                percentage={porcentaje}
                plan={perfil.plan || ""}
                used={perfil.preguntas_usadas || 0}
              />

              {/* Cargar Catálogo Wizard */}
              <div className="flex flex-col gap-6 flex-grow">
                <ImportWizard
                  tenantId={Number(user?.id)}
                  tenantSlug={derivedTenantSlug || undefined}
                  onComplete={() => {
                    refreshVectorSyncStatus();
                    toast({ title: "Catálogo actualizado", description: "El proceso de importación ha finalizado." });
                  }}
                />

                {isPyme && (
                  <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold text-primary">Estado de Sincronización</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Estado en Qdrant</span>
                          <Badge
                            variant={
                              loadingVectorSync
                                ? 'secondary'
                                : vectorSyncStatus?.status === 'ready'
                                  ? 'success'
                                  : vectorSyncStatus?.status === 'error'
                                    ? 'destructive'
                                    : 'outline'
                            }
                          >
                            {loadingVectorSync
                              ? 'Sincronizando...'
                              : vectorSyncStatus?.status === 'ready'
                                ? 'Listo'
                                : vectorSyncStatus?.status === 'processing'
                                  ? 'Procesando'
                                  : vectorSyncStatus?.status === 'pending'
                                    ? 'Pendiente'
                                    : vectorSyncStatus?.status === 'error'
                                      ? 'Error'
                                      : 'Sin datos'}
                          </Badge>
                        </div>
                        {loadingVectorSync ? (
                          <p className="text-xs text-muted-foreground">Consultando sincronización...</p>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground">
                              {vectorSyncStatus?.message || 'Tus catálogos se indexan para búsquedas de precios y promociones.'}
                            </p>
                            {vectorSyncStatus?.lastSyncedAt && (
                              <p className="text-xs text-muted-foreground">
                                Última actualización: {formatVectorSyncDate(vectorSyncStatus.lastSyncedAt)}
                              </p>
                            )}
                            {typeof vectorSyncStatus?.documentCount === 'number' && (
                              <p className="text-xs text-muted-foreground">
                                Documentos indexados: {vectorSyncStatus.documentCount}
                              </p>
                            )}
                            {vectorSyncStatus?.lastSourceFileName && (
                              <p className="text-xs text-muted-foreground truncate">
                                Archivo más reciente: {vectorSyncStatus.lastSourceFileName}
                              </p>
                            )}
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={refreshVectorSyncStatus}
                          disabled={loadingVectorSync || !user?.id}
                        >
                          Actualizar estado
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Gestión de Eventos y Noticias Card */}
              {isStaff && esMunicipio && (
                <>
                  <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex flex-col flex-grow">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-primary">
                        Gestión de Eventos y Noticias
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col flex-grow">
                      <p className="text-sm text-muted-foreground">
                        Crea y gestiona los eventos, anuncios y noticias que se mostrarán a tus usuarios en el chat.
                      </p>
                      <div className="flex-grow" />
                      <div className="flex flex-col gap-2 mt-auto">
                        <Button
                          onClick={() => {
                            setActiveEventTab("event");
                            setIsEventModalOpen(true);
                          }}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5"
                        >
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Crear Nuevo Evento / Noticia
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActiveEventTab("paste");
                            setIsEventModalOpen(true);
                          }}
                          className="w-full py-2.5"
                        >
                          <UploadCloud className="w-4 h-4 mr-2" />
                          Subir Información
                        </Button>
                        <Button
                          onClick={() => {
                            setActiveEventTab("promotion");
                            setIsEventModalOpen(true);
                          }}
                          disabled={hasSentPromotionToday}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5"
                        >
                          <Megaphone className="w-4 h-4 mr-2" />
                          Promocionar en WhatsApp
                        </Button>
                        {hasSentPromotionToday && (
                          <p className="text-xs text-muted-foreground text-center">
                            Ya enviaste una promoción hoy. Podrás enviar otra mañana.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex flex-col flex-grow">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-lg font-semibold text-primary">
                        Publicaciones recientes
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Consulta las noticias y eventos almacenados en la base de datos, aplicando filtros por fecha o tipo.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="municipal-posts-month">Mes</Label>
                          <Input
                            id="municipal-posts-month"
                            type="month"
                            value={municipalPostsFilters.month ?? ""}
                            onChange={(event) => handleMonthFilterChange(event.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="municipal-posts-from">Desde</Label>
                          <Input
                            id="municipal-posts-from"
                            type="date"
                            value={municipalPostsFilters.fromDate ?? ""}
                            onChange={(event) => handleFromDateChange(event.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="municipal-posts-to">Hasta</Label>
                          <Input
                            id="municipal-posts-to"
                            type="date"
                            value={municipalPostsFilters.toDate ?? ""}
                            onChange={(event) => handleToDateChange(event.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="municipal-posts-type">Tipo</Label>
                          <Select
                            value={municipalPostsFilters.tipoPost ?? "all"}
                            onValueChange={handleTipoPostFilterChange}
                          >
                            <SelectTrigger id="municipal-posts-type">
                              <SelectValue placeholder="Todos los tipos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="evento">Eventos</SelectItem>
                              <SelectItem value="noticia">Noticias</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void refreshMunicipalPosts()}
                          disabled={isLoadingMunicipalPosts}
                        >
                          {isLoadingMunicipalPosts && municipalPosts.length === 0 ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Actualizando...
                            </>
                          ) : (
                            "Actualizar"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleResetPostFilters}
                          disabled={!hasActiveMunicipalPostFilters || isLoadingMunicipalPosts}
                        >
                          Limpiar filtros
                        </Button>
                        <div className="ml-auto flex flex-col text-right text-xs text-muted-foreground">
                          <span>
                            Total: {municipalPostsMeta.totalCount} · Límite: {municipalPostsMeta.limit} · Offset: {municipalPostsMeta.offset}
                          </span>
                          <span>
                            {municipalPostsMeta.hasMore ? "Hay más resultados disponibles" : "Mostrando todos los resultados cargados"}
                          </span>
                        </div>
                      </div>

                      {municipalPostsError && (
                        <Alert variant="destructive">
                          <AlertTitle>Error al cargar las publicaciones</AlertTitle>
                          <AlertDescription>{municipalPostsError}</AlertDescription>
                        </Alert>
                      )}

                      {isLoadingMunicipalPosts && municipalPosts.length === 0 && !municipalPostsError && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Cargando publicaciones...</span>
                        </div>
                      )}

                      <div className="space-y-3">
                        {municipalPosts.length === 0 && !isLoadingMunicipalPosts && !municipalPostsError ? (
                          <p className="text-sm text-muted-foreground">
                            No hay publicaciones para los filtros seleccionados.
                          </p>
                        ) : (
                          municipalPosts.map((post) => {
                            const mainLink = post.url || post.enlace || post.link;
                            const rawContent =
                              typeof post.contenido === "string"
                                ? post.contenido.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
                                : "";
                            const summary =
                              rawContent.length > 220 ? `${rawContent.slice(0, 220)}…` : rawContent;
                            const creationDate =
                              (post.tipo_post === "evento" && post.fecha_evento_inicio) ||
                              (post.tipo_post === "evento" && !post.fecha_evento_inicio ? post.fecha_evento_fin : undefined) ||
                              (post as any)?.created_at ||
                              (post as any)?.createdAt ||
                              (post as any)?.updated_at ||
                              (post as any)?.updatedAt;

                            let dateLabel = "Sin fecha definida";
                            if (post.tipo_post === "evento") {
                              if (post.fecha_evento_inicio && post.fecha_evento_fin) {
                                const startLabel = fmtAR(post.fecha_evento_inicio);
                                const endLabel = fmtAR(post.fecha_evento_fin);
                                dateLabel = `Del ${startLabel} al ${endLabel}`;
                              } else if (post.fecha_evento_inicio) {
                                const startLabel = fmtAR(post.fecha_evento_inicio);
                                dateLabel = `Inicio: ${startLabel}`;
                              } else if (post.fecha_evento_fin) {
                                const endLabel = fmtAR(post.fecha_evento_fin);
                                dateLabel = `Fin: ${endLabel}`;
                              } else if (creationDate) {
                                const createdLabel = fmtAR(creationDate);
                                dateLabel = `Publicado: ${createdLabel}`;
                              }
                            } else if (creationDate) {
                              const createdLabel = fmtAR(creationDate);
                              dateLabel = `Publicado: ${createdLabel}`;
                            }

                            return (
                              <div
                                key={post.id}
                                className="rounded-lg border border-border/70 bg-muted/10 p-4 transition hover:bg-muted/20"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-foreground">
                                      {post.titulo || "Publicación sin título"}
                                    </p>
                                    {post.subtitulo && (
                                      <p className="text-sm text-muted-foreground">{post.subtitulo}</p>
                                    )}
                                  </div>
                                  <Badge
                                    variant={post.tipo_post === "evento" ? "default" : "secondary"}
                                    className="capitalize"
                                  >
                                    {post.tipo_post}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p>
                                {summary && (
                                  <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
                                )}
                                {mainLink && (
                                  <a
                                    href={mainLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline"
                                  >
                                    Ver detalle
                                  </a>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {municipalPostsMeta.hasMore && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void loadMoreMunicipalPosts()}
                            disabled={isLoadingMunicipalPosts}
                          >
                            {isLoadingMunicipalPosts ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
                              </>
                            ) : (
                              "Cargar más"
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Tarjeta de Integración */}
              <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex flex-col flex-grow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-primary">
                    Integrá Chatboc a tu web
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col flex-grow">
                  {isProOrFullPlan && isAdminUser ? (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      onClick={() => {
                        const integrationPath = derivedTenantSlug
                          ? `/${derivedTenantSlug}/integracion`
                          : "/integracion";

                        navigate(integrationPath);
                      }}
                    >
                      Ir a la guía de integración
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-muted text-muted-foreground cursor-not-allowed"
                      disabled
                      title={
                        !isProOrFullPlan
                          ? "Solo para clientes con Plan PRO o FULL"
                          : "Solo administradores pueden gestionar la integración"
                      }
                      style={{ pointerEvents: "none" }}
                    >
                      {!isProOrFullPlan
                        ? "Plan PRO requerido para activar integración"
                        : "Acceso disponible solo para administradores"}
                    </Button>
                  )}
                  <div className="flex-grow flex items-center justify-center p-4">
                    <MiniChatWidgetPreview />
                  </div>
                  <div className="text-xs text-muted-foreground mt-auto pt-2">
                    Accedé a los códigos e instrucciones para pegar el widget de
                    Chatboc en tu web solo si tu plan es PRO o superior y tenés
                    rol de administrador.
                    <br />
                    Cualquier duda, escribinos a{" "}
                    <a
                      href="mailto:info@chatboc.ar"
                      className="underline text-primary"
                    >
                      Info@chatboc.ar
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          </details>
          )}
        </WorkspacePanel>
        <WorkspacePanel
          active={activeProfileTab === "tickets" && workspaceCapabilities.operation}
          label={esMunicipio ? "Centro de reclamos" : "Centro de tickets"}
          data-testid="profile-ticket-workspace"
          className="mt-1 flex min-h-0 flex-1 basis-0 overflow-hidden pb-0 [&_[data-testid=tickets-panel-root]]:!h-full [&_[data-testid=tickets-panel-root]]:!min-h-0"
        >
          <React.Suspense fallback={<ProfileTabFallback label="Cargando mesa de reclamos..." />}>
            <TicketsPanel tenantSlugOverride={derivedTenantSlug} embedded />
          </React.Suspense>
        </WorkspacePanel>
        <WorkspacePanel active={activeProfileTab === "estadisticas" && workspaceCapabilities.reports} label="Reportes ejecutivos">
          <React.Suspense fallback={<ProfileTabFallback label="Cargando reportes..." />}>
            <EstadisticasPage />
          </React.Suspense>
        </WorkspacePanel>
        {workspaceCapabilities.analytics && (
          <WorkspacePanel active={activeProfileTab === "analytics" && workspaceCapabilities.analytics} label="Analítica avanzada">
            <React.Suspense fallback={<ProfileTabFallback label="Cargando analitica IA..." />}>
              <AnalyticsPage />
            </React.Suspense>
          </WorkspacePanel>
        )}
        <WorkspacePanel active={activeProfileTab === "catalogo" && workspaceCapabilities.catalog} label="Catálogo y servicios">
          <React.Suspense fallback={<ProfileTabFallback label="Cargando catalogo..." />}>
            <CatalogManagementPage tenantSlugOverride={derivedTenantSlug} embedded />
          </React.Suspense>
        </WorkspacePanel>
        <WorkspacePanel active={activeProfileTab === "pedidos" && workspaceCapabilities.operation} label={esMunicipio ? "Tareas y gestión" : "Ventas y pedidos"}>
          <React.Suspense fallback={<ProfileTabFallback label="Cargando gestion..." />}>
            <SmartPedidosWrapper />
          </React.Suspense>
        </WorkspacePanel>
        <WorkspacePanel active={activeProfileTab === "usuarios" && workspaceCapabilities.contacts} label={esMunicipio ? "Personas y contactos" : "Clientes y contactos"}>
          <React.Suspense fallback={<ProfileTabFallback label="Cargando usuarios..." />}>
            <UsuariosPage />
          </React.Suspense>
        </WorkspacePanel>
        {workspaceCapabilities.team && (
          <WorkspacePanel active={activeProfileTab === "empleados" && workspaceCapabilities.team} label="Equipo y permisos">
            <React.Suspense fallback={<ProfileTabFallback label="Cargando empleados..." />}>
              <InternalUsers />
            </React.Suspense>
          </WorkspacePanel>
        )}
        {workspaceCapabilities.territory && (
          <WorkspacePanel active={activeProfileTab === "mapas" && workspaceCapabilities.territory} label="Mapa operativo">
            <React.Suspense fallback={<ProfileTabFallback label="Cargando mapas..." />}>
              <IncidentsMap />
            </React.Suspense>
          </WorkspacePanel>
        )}
      </div>


       {/* --- Modal para Crear Evento/Noticia --- */}
      <Dialog
        open={isEventModalOpen}
        onOpenChange={(open) => {
          setIsEventModalOpen(open);
          if (!open) setActiveEventTab("event");
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-primary"/>
              Crear Nuevo Evento o Noticia
            </DialogTitle>
            <DialogDescription>
              Completa los detalles a continuación. Los campos marcados con * son obligatorios.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[70vh] overflow-y-auto px-2">
            <Tabs value={activeEventTab} onValueChange={setActiveEventTab}>
              <TabsList className="mb-4 grid w-full grid-cols-4">
                <TabsTrigger value="event">Evento</TabsTrigger>
                <TabsTrigger value="news">Noticia</TabsTrigger>
                <TabsTrigger value="paste">Subir Información</TabsTrigger>
                <TabsTrigger value="promotion">Promocionar</TabsTrigger>
              </TabsList>
              <TabsContent value="event">
                <EventForm
                  fixedTipoPost="evento"
                  onCancel={() => setIsEventModalOpen(false)}
                  isSubmitting={isSubmittingEvent}
                  onSubmit={handleSubmitPost}
                  onPromote={handlePromoteEvent}
                  isPromoting={isSubmittingPromotion}
                  disablePromote={hasSentPromotionToday}
                />
              </TabsContent>
              <TabsContent value="news">
                <EventForm
                  fixedTipoPost="noticia"
                  onCancel={() => setIsEventModalOpen(false)}
                  isSubmitting={isSubmittingEvent}
                  onSubmit={handleSubmitPost}
                  onPromote={handlePromoteEvent}
                  isPromoting={isSubmittingPromotion}
                  disablePromote={hasSentPromotionToday}
                />
              </TabsContent>
              <TabsContent value="paste">
                <AgendaPasteForm onCancel={() => setIsEventModalOpen(false)} />
              </TabsContent>
              <TabsContent value="promotion">
                <PromotionForm
                  onCancel={() => setIsEventModalOpen(false)}
                  isSubmitting={isSubmittingPromotion}
                  onSubmit={handleSubmitPromotion}
                />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
