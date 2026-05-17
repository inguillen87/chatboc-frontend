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
  LogOut,
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
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Package,
  PieChart,
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
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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
import TicketsPanel from '@/pages/TicketsPanel';
import EstadisticasPage from '@/pages/EstadisticasPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import UsuariosPage from '@/pages/UsuariosPage';
import SmartPedidosWrapper from '@/pages/SmartPedidosWrapper';
import InternalUsers from '@/pages/InternalUsers';
import IncidentsMap from '@/pages/IncidentsMap';
import BackofficeCommandCenter from '@/components/backoffice/BackofficeCommandCenter';
import CatalogManagementPage from '@/pages/admin/CatalogManagementPage';
import { getTicketStats, getHeatmapDataset, HeatmapDataset } from "@/services/statsService";
import AnalyticsHeatmap from "@/components/analytics/Heatmap";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import MiniChatWidgetPreview from "@/components/ui/MiniChatWidgetPreview"; // Importar el nuevo componente
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useUser } from "@/hooks/useUser";
import { normalizeRole } from "@/utils/roles";
import { useMunicipalPosts } from "@/hooks/useMunicipalPosts";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { TENANT_ROUTE_PREFIXES } from "@/utils/tenantPaths";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { apiFetch, getErrorMessage, ApiError } from "@/utils/api"; // Importa apiFetch y getErrorMessage
import { toLocalISOString } from "@/utils/fecha";
import { fmtAR } from "@/utils/date";
import { suggestMappings, SystemField, DEFAULT_SYSTEM_FIELDS } from "@/utils/columnMatcher";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { TicketStatsResponse, HeatPoint } from "@/services/statsService";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import MapLibreMap from "@/components/MapLibreMap";
import {
  CatalogVectorSyncStatus,
  fetchCatalogVectorSyncStatus,
} from '@/services/catalogService';
import { requestDocumentPreview } from '@/services/documentIntelligenceService';
import { mergeAndSortStrings } from '@/utils/collections';
import ImportWizard from "@/components/catalog/ImportWizard";


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

const slugify = (value?: string | null) => {
  if (!value) return null;
  const normalized = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
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


type ProfileTabValue =
  | "perfil"
  | "tickets"
  | "pedidos"
  | "estadisticas"
  | "analytics"
  | "catalogo"
  | "usuarios"
  | "empleados"
  | "mapas";

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
        "group flex min-h-[148px] w-full flex-col justify-between rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-55",
      )}
    >
      <div className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-semibold text-foreground">{item.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        {enabled ? item.actionLabel : "No disponible"}
        {enabled ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}
      </span>
    </button>
  );
};

const DataModeCard = ({
  title,
  description,
  bullets,
  actionLabel,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  bullets: string[];
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) => (
  <div className="flex flex-col rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
      {bullets.map((bullet) => (
        <li key={bullet} className="flex gap-2">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
    <Button type="button" variant="outline" className="mt-4 justify-between" onClick={onClick}>
      {actionLabel}
      <ArrowRight className="h-4 w-4" />
    </Button>
  </div>
);

export default function Perfil() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useUser(); // Usa refreshUser del hook
  const isPyme = user?.tipo_chat === "pyme";
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
  });
  const storedTenantSlug = useMemo(() => slugify(safeLocalStorage.getItem("tenantSlug")), []);
  const derivedTenantSlug = useMemo(() => {
    const candidates = [
      (user as any)?.tenantSlug,
      (user as any)?.tenant_slug,
      (perfil as any)?.tenant_slug,
      (perfil as any)?.slug,
      (perfil as any)?.endpoint,
      (perfil as any)?.municipio,
      (user as any)?.tenant,
      (user as any)?.empresa,
      (user as any)?.nombre_empresa,
      storedTenantSlug,
      user?.name,
      user?.email?.split("@")[0],
    ];

    for (const candidate of candidates) {
      const normalized = slugify(candidate);
      if (normalized) return normalized;
    }

    return null;
  }, [perfil, storedTenantSlug, user]);
  const isAdminUser = useMemo(
    () => (user?.rol || "").toLowerCase() === "admin",
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
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [activeEventTab, setActiveEventTab] = useState<
    "event" | "news" | "paste" | "promotion"
  >("event");
  const requestedProfileTab = searchParams.get("tab") as ProfileTabValue | null;
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTabValue>(requestedProfileTab || "perfil");
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
  const isStaff = normalizedRole === 'admin' || normalizedRole === 'empleado';
  const canViewAnalytics =
    isStaff || user?.tipo_chat === 'pyme' || user?.tipo_chat === 'municipio';
  const esMunicipio = (user?.tipo_chat || perfil.rubro) === "municipio" || perfil.rubro === "municipios";
  const [backofficeNavigation, setBackofficeNavigation] = useState<BackofficeNavigationResponse | null>(null);

  const {
    posts: municipalPosts,
    isLoading: isLoadingMunicipalPosts,
    error: municipalPostsError,
    filters: municipalPostsFilters,
    meta: municipalPostsMeta,
    setFilters: updateMunicipalPostFilters,
    loadMore: loadMoreMunicipalPosts,
    refresh: refreshMunicipalPosts,
  } = useMunicipalPosts({ limit: 10, enabled: esMunicipio });

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
      if (tab === "perfil") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (requestedProfileTab && requestedProfileTab !== activeProfileTab) {
      setActiveProfileTab(requestedProfileTab);
    }
  }, [activeProfileTab, requestedProfileTab]);

  useEffect(() => {
    if (!derivedTenantSlug) {
      setBackofficeNavigation(null);
      return;
    }

    let cancelled = false;
    const loadBackofficeNavigation = async () => {
      try {
        const data = await apiFetch<BackofficeNavigationResponse>(
          `/api/app/backoffice/navigation?tenant_slug=${encodeURIComponent(derivedTenantSlug)}`,
        );
        if (cancelled) return;
        if (data?.contract_version === 'backoffice.navigation.v1' && Array.isArray(data.modules)) {
          setBackofficeNavigation(data);
          return;
        }
        setBackofficeNavigation(null);
      } catch {
        if (!cancelled) setBackofficeNavigation(null);
      }
    };

    void loadBackofficeNavigation();
    return () => {
      cancelled = true;
    };
  }, [derivedTenantSlug]);

  useEffect(() => {
    const checkPromotionStatus = async () => {
      try {
        const data = await apiFetch<any>('/api/whatsapp/promocionar');
        const last = data?.ultimo_envio || data?.last_sent || data?.lastSent;
        const today = new Date().toISOString().slice(0, 10);
        if ((data?.can_send === false) || (data?.disponible === false)) {
          setHasSentPromotionToday(true);
        } else if (last && last.slice(0, 10) === today) {
          setHasSentPromotionToday(true);
        }
      } catch {
        const lastPromotionDate = safeLocalStorage.getItem('lastPromotionDate');
        const today = new Date().toISOString().slice(0, 10);
        if (lastPromotionDate === today) {
          setHasSentPromotionToday(true);
        }
      }
    };
    checkPromotionStatus();
  }, []);

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



  // fetchPerfil actualizado para usar apiFetch
  const fetchPerfil = useCallback(async () => { // Ya no necesita 'token' como argumento
    setLoadingGuardar(true);
    setError(null);
    setMensaje(null);
    try {
      const data = await apiFetch<any>("/me"); // Usa apiFetch, que maneja el token

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

      setPerfil((prev) => ({
        ...prev,
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

      // Actualizar localStorage y contexto del usuario antes de otras llamadas que dependan de él
      await refreshUser();

    } catch (err) {
      // El manejo de 401 es global en apiFetch, que redirigirá la página.
      // Solo necesitamos manejar otros errores que no sean de autenticación.
      setError(getErrorMessage(err, "Error al cargar el perfil."));
    } finally {
      setLoadingGuardar(false);
    }
  }, [navigate, refreshUser]); // Añadir navigate y refreshUser a las dependencias

  const fetchMapData = useCallback(async () => {
    setIsMapLoading(true);
    try {
      const tipo = user?.tipo_chat ?? getCurrentTipoChat();

      const [stats, heatmapDataset, categoryData] = await Promise.all([
        getTicketStats({ tipo }),
        getHeatmapDataset({ tipo }),
        apiFetch<{ categorias: { id: number; nombre: string }[] }>(
          '/municipal/categorias',
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
          description: 'No hay puntos reales disponibles para mostrar con los filtros actuales.',
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
    } finally {
      setIsMapLoading(false);
    }
  }, [user?.tipo_chat]);


  useEffect(() => {
    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      navigate("/login"); // Usar navigate para la redirección
      return;
    }
    void (async () => {
      await fetchPerfil();
    })();
  }, [fetchPerfil, navigate]);

  useEffect(() => {
    if (!canViewAnalytics) {
      return;
    }

    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      return;
    }

    void fetchMapData();
  }, [canViewAnalytics, fetchMapData]);

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
    if (!isPyme) {
      setVectorSyncStatus(null);
      return;
    }
    if (user?.id) {
      refreshVectorSyncStatus();
    }
  }, [user?.id, isPyme, refreshVectorSyncStatus]);

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
    setPerfil((prev) => ({ ...prev, [id]: value }));
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

  const handleGuardar = async (e: FormEvent) => { // Tipado de 'e'
    e.preventDefault();
    setMensaje(null);
    setError(null);
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
      horario_json: JSON.stringify(horariosParaBackend), // Convertir a string JSON
    };
    try {
      // Usa apiFetch, que maneja Content-Type y Authorization
      const data = await apiFetch<any>("/perfil", {
        method: "PUT",
        body: payload,
      });
      
      const successMsg = data.mensaje || "Cambios guardados correctamente ✔️";
      await fetchPerfil(); // Refrescar el perfil después de guardar
      setMensaje(successMsg);
    } catch (err) {
      setError(getErrorMessage(err, "Error al guardar el perfil."));
    } finally {
      setLoadingGuardar(false);
    }
  };

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

  const moduleRouteToTarget = (route?: string | null): Pick<ControlCenterCard, 'tab' | 'path'> => {
    if (!route) return {};
    const tabMatch = route.match(/[?&]tab=([^&]+)/);
    const tab = tabMatch?.[1] as ProfileTabValue | undefined;
    if (tab && ['perfil', 'tickets', 'pedidos', 'estadisticas', 'analytics', 'catalogo', 'usuarios', 'empleados', 'mapas'].includes(tab)) {
      return { tab };
    }
    return { path: route };
  };

  const backendControlCards = useMemo<ControlCenterCard[]>(() => {
    const modules = backofficeNavigation?.modules;
    if (!Array.isArray(modules) || modules.length === 0) return [];
    return modules
      .filter((module) => module.enabled !== false)
      .slice()
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .map((module) => {
        const id = module.id || module.label || module.route || 'module';
        return {
          id,
          title: module.label || module.title || id,
          description: module.description || 'Modulo publicado por backend.',
          icon: resolveBackofficeModuleIcon(id),
          actionLabel: 'Abrir',
          enabled: module.enabled !== false,
          ...moduleRouteToTarget(module.route || module.path),
        };
      });
  }, [backofficeNavigation?.modules]);

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

  const primaryControlCards: ControlCenterCard[] = [
    {
      id: "operations",
      title: esMunicipio ? "Operar reclamos" : "Operar conversaciones",
      description: esMunicipio
        ? "Entrar a reclamos, estados, ubicaciones y seguimiento diario."
        : "Ver tickets, pedidos, ventas y conversaciones que requieren accion.",
      icon: ClipboardList,
      actionLabel: "Abrir operacion",
      tab: "tickets",
    },
    {
      id: "reports",
      title: "Reportes claros",
      description: "Resumen operativo, mapas de calor, prioridades y datos listos para revisar.",
      icon: BarChart3,
      actionLabel: "Ver reportes",
      tab: "estadisticas",
    },
    {
      id: "surveys",
      title: "Encuestas y sondeos",
      description: "Gestionar participacion, votaciones, comentarios y resultados en vivo.",
      icon: Vote,
      actionLabel: "Abrir encuestas",
      path: "/admin/encuestas",
    },
    {
      id: "people",
      title: "Personas y accesos",
      description: "Usuarios, empleados, permisos y responsables del equipo.",
      icon: Users,
      actionLabel: "Gestionar personas",
      tab: isStaff ? "empleados" : "usuarios",
    },
  ];

  const secondaryControlCards: ControlCenterCard[] = [
    {
      id: "catalog",
      title: "Catalogo e inventario",
      description: "Productos, recursos, stock, importaciones y calidad del catalogo publicados por backend.",
      icon: Package,
      actionLabel: "Abrir catalogo",
      tab: "catalogo",
    },
    {
      id: "ai-analytics",
      title: "Analitica avanzada e IA",
      description: "Investigacion, segmentos, resumen ejecutivo y exportaciones para equipos avanzados.",
      icon: Sparkles,
      actionLabel: "Abrir analitica",
      tab: "analytics",
      enabled: canViewAnalytics,
    },
    {
      id: "maps",
      title: "Mapa operativo",
      description: "Ver zonas calientes, puntos georreferenciados y capas territoriales disponibles.",
      icon: MapPinned,
      actionLabel: "Abrir mapas",
      tab: isStaff ? "mapas" : "estadisticas",
    },
    {
      id: "users",
      title: "Usuarios finales",
      description: "Consultar contactos, cuentas, actividad y datos de relacion con la organizacion.",
      icon: UserCog,
      actionLabel: "Ver usuarios",
      tab: "usuarios",
    },
  ];
  const controlCardsFromBackend = backendControlCards.length > 0;
  const renderedPrimaryControlCards = controlCardsFromBackend
    ? backendControlCards.slice(0, 4)
    : primaryControlCards;
  const renderedSecondaryControlCards = controlCardsFromBackend
    ? backendControlCards.slice(4)
    : secondaryControlCards;
  const backofficeScope = esMunicipio ? 'municipio' : user?.tipo_chat || perfil.rubro || 'pyme';

  return (
    <div className="flex min-h-screen flex-col bg-background px-2 py-6 text-foreground dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 sm:px-4 md:px-6 lg:px-8">
      <div className="mx-auto mb-5 w-full max-w-7xl px-2 pt-16 sm:pt-0">
        <Button
          variant="outline"
          className="float-right h-10 rounded-lg border-destructive px-5 text-sm text-destructive hover:bg-destructive/10"
          onClick={() => {
            safeLocalStorage.clear();
            navigate("/login"); // Usa navigate para la redirección
          }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
        <div className="clear-both rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="mt-1 inline-block align-middle">
                <MunicipioIcon />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Centro de control</p>
                <h1 className="mt-1 text-2xl font-extrabold leading-tight text-foreground sm:text-3xl md:text-4xl">
                  {perfil.nombre_empresa || "Panel de Empresa"}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Operacion, personas, encuestas y reportes en un solo lugar. La configuracion queda disponible, pero
                  el panel prioriza lo que el equipo necesita resolver hoy.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Badge variant="secondary" className="capitalize">{perfil.rubro || "Rubro no especificado"}</Badge>
              <Badge variant="outline">{plan === "full" ? "Plan Full" : plan === "pro" ? "Plan Pro" : "Plan activo"}</Badge>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto mb-5 w-full max-w-7xl space-y-5 px-2">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {renderedPrimaryControlCards.map((item) => (
            <ControlCenterCardButton key={item.id} item={item} onOpen={openControlCenterItem} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Que mirar primero</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {renderedSecondaryControlCards.map((item) => (
                <ControlCenterCardButton key={item.id} item={item} onOpen={openControlCenterItem} />
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChart className="h-5 w-5 text-primary" />
                Estadisticas vs analitica
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <DataModeCard
                title="Estadisticas"
                description="Vista diaria para equipos administrativos."
                bullets={["Que paso", "Que esta pendiente", "Donde actuar ahora"]}
                actionLabel="Ver tablero simple"
                icon={BarChart3}
                onClick={() => updateProfileTab("estadisticas")}
              />
              <DataModeCard
                title="Analitica IA"
                description="Capa avanzada para investigar y presentar."
                bullets={["Resumen ejecutivo", "Segmentos y mapas", "Exportacion PDF/CSV"]}
                actionLabel="Abrir investigacion"
                icon={Sparkles}
                onClick={() => updateProfileTab("analytics")}
              />
            </CardContent>
          </Card>
        </div>

        <BackofficeCommandCenter tenantSlug={derivedTenantSlug} scope={backofficeScope} />
      </section>

      <Tabs value={activeProfileTab} onValueChange={(value) => updateProfileTab(value as ProfileTabValue)} className="w-full max-w-7xl mx-auto">
        <div className="sticky top-0 z-30 -mx-2 border-y border-border/60 bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:rounded-xl sm:border">
        <TabsList className={`grid h-auto w-full gap-1 ${canViewAnalytics ? "grid-cols-2 sm:grid-cols-4 xl:grid-cols-9" : "grid-cols-2 sm:grid-cols-4 xl:grid-cols-8"}`}>
          <TabsTrigger value="perfil">Inicio</TabsTrigger>
          <TabsTrigger value="tickets">{esMunicipio ? 'Reclamos' : 'Tickets'}</TabsTrigger>
          <TabsTrigger value="pedidos">{esMunicipio ? 'Gestión' : 'Ventas'}</TabsTrigger>
          <TabsTrigger value="estadisticas">Reportes</TabsTrigger>
          {canViewAnalytics && <TabsTrigger value="analytics">Analitica IA</TabsTrigger>}
          <TabsTrigger value="catalogo">Catalogo</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          {isStaff && <TabsTrigger value="empleados">Empleados</TabsTrigger>}
          {isStaff && <TabsTrigger value="mapas">Mapas</TabsTrigger>}
        </TabsList>
        </div>
        <TabsContent value="perfil">
          <div className="w-full mx-auto flex flex-col md:flex-row gap-6 md:gap-8 px-2 items-stretch mt-6">
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
              {/* Versión colapsable para mobile (Plan y Uso) */}
              <div className="md:hidden">
                <Accordion type="single" collapsible defaultValue="plan">
                  <AccordionItem value="plan" className="border-b border-border">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold text-primary">
                      Plan y Uso
                    </AccordionTrigger>
                    <AccordionContent>
                      <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
                        <CardContent className="space-y-3">
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>Plan actual:</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "bg-primary text-primary-foreground capitalize",
                              )}
                            >
                              {perfil?.plan || "N/A"}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">
                              Consultas usadas este mes:
                            </p>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={porcentaje}
                                className="h-3 bg-muted [&>div]:bg-primary"
                                aria-label={`${porcentaje.toFixed(0)}% de consultas usadas`}
                              />
                              <span className="text-xs text-muted-foreground min-w-[70px] text-right">
                                {perfil?.preguntas_usadas} /
                                {limitePlan === Infinity ? '∞' : limitePlan}
                              </span>
                            </div>
                          </div>
                          {perfil.plan !== "full" && perfil.plan !== "pro" && (
                            <div className="space-y-2 mt-3">
                              <Button
                                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                                onClick={() =>
                                  window.open(
                                    "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849763daeb0197658791ee00b1",
                                    "_blank",
                                  )
                                }
                              >
                                Mejorar a FULL ($350.000/mes)
                              </Button>
                              <Button
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                                onClick={() =>
                                  window.open(
                                    "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849764e81a01976585767f0040",
                                    "_blank",
                                  )
                                }
                              >
                                Mejorar a PRO ($300.000/mes)
                              </Button>
                            </div>
                          )}
                          {(perfil.plan === "pro" || perfil.plan === "full") && (
                            <div className="text-primary bg-primary/10 rounded p-3 font-medium text-sm mt-3">
                              ¡Tu plan está activo! <br />
                              <span className="text-muted-foreground">
                                La renovación se realiza cada mes. Si vence el pago, vas a
                                ver los links aquí para renovarlo.
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            Una vez realizado el pago, tu cuenta se actualiza
                            automáticamente.
                            <br />
                            Si no ves el cambio en unos minutos, comunicate con soporte..
                          </div>
                        </CardContent>
                      </Card>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Versión desktop (Plan y Uso) */}
              <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm hidden md:block">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-primary">
                    Plan y Uso
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>Plan actual:</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "bg-primary text-primary-foreground capitalize",
                      )}
                    >
                      {perfil?.plan || "N/A"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Consultas usadas este mes:
                    </p>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={porcentaje}
                        className="h-3 bg-muted [&>div]:bg-primary"
                        aria-label={`${porcentaje.toFixed(0)}% de consultas usadas`}
                      />
                      <span className="text-xs text-muted-foreground min-w-[70px] text-right">
                        {perfil?.preguntas_usadas} /
                        {limitePlan === Infinity ? '∞' : limitePlan}
                      </span>
                    </div>
                  </div>
                  {perfil.plan !== "full" && perfil.plan !== "pro" && (
                    <div className="space-y-2 mt-3">
                      <Button
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                        onClick={() =>
                          window.open(
                            "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849763daeb0197658791ee00b1",
                            "_blank",
                          )
                        }
                      >
                        Mejorar a FULL ($350.000/mes)
                      </Button>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        onClick={() =>
                          window.open(
                            "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849764e81a01976585767f0040",
                            "_blank",
                          )
                        }
                      >
                        Mejorar a PRO ($300.000/mes)
                      </Button>
                    </div>
                  )}
                  {(perfil.plan === "pro" || perfil.plan === "full") && (
                    <div className="text-primary bg-primary/10 rounded p-3 font-medium text-sm mt-3">
                      ¡Tu plan está activo! <br />
                      <span className="text-muted-foreground">
                        La renovación se realiza cada mes. Si vence el pago, vas a
                        ver los links aquí para renovarlo.
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    Una vez realizado el pago, tu cuenta se actualiza
                    automáticamente.
                    <br />
                    Si no ves el cambio en unos minutos, comunicate con soporte..
                  </div>
                </CardContent>
              </Card>

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
        </TabsContent>
        <TabsContent value="tickets">
          <TicketsPanel />
        </TabsContent>
        <TabsContent value="estadisticas">
          <EstadisticasPage />
        </TabsContent>
        {canViewAnalytics && (
          <TabsContent value="analytics">
            <AnalyticsPage />
          </TabsContent>
        )}
        <TabsContent value="catalogo">
          <CatalogManagementPage tenantSlugOverride={derivedTenantSlug} embedded />
        </TabsContent>
        <TabsContent value="pedidos">
          <SmartPedidosWrapper />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsuariosPage />
        </TabsContent>
        {isStaff && (
          <TabsContent value="empleados">
            <InternalUsers />
          </TabsContent>
        )}
        {isStaff && (
          <TabsContent value="mapas">
            <IncidentsMap />
          </TabsContent>
        )}
      </Tabs>


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
