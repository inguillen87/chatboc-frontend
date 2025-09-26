import React, {
  useEffect,
  useState,
  useCallback,
  FormEvent,
  useRef,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import UsuariosPage from '@/pages/UsuariosPage';
import InternalUsers from '@/pages/InternalUsers';
import IncidentsMap from '@/pages/IncidentsMap';
import { getTicketStats } from "@/services/statsService";
import AnalyticsHeatmap from "@/components/analytics/Heatmap";
import { useNavigate } from "react-router-dom";
import MiniChatWidgetPreview from "@/components/ui/MiniChatWidgetPreview"; // Importar el nuevo componente
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useUser } from "@/hooks/useUser";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { apiFetch, getErrorMessage, ApiError } from "@/utils/api"; // Importa apiFetch y getErrorMessage
import { toLocalISOString } from "@/utils/fecha";
import { suggestMappings, SystemField, DEFAULT_SYSTEM_FIELDS } from "@/utils/columnMatcher";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { TicketStatsResponse, HeatPoint } from "@/services/statsService";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import MapLibreMap from "@/components/MapLibreMap";


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
const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];


export default function Perfil() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser(); // Usa refreshUser del hook
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
    limite_preguntas: 50,
    rubro: "",
    horarios_ui: DIAS.map((_, idx) => ({
      abre: "09:00",
      cierra: "20:00",
      cerrado: idx === 5 || idx === 6,
    })),
    logo_url: "",
  });
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
  const [isSubmittingPromotion, setIsSubmittingPromotion] = useState(false);
  const [hasSentPromotionToday, setHasSentPromotionToday] = useState(false);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [pendingGeocode, setPendingGeocode] = useState<string | null>(null);
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState<string | null>(null);
  const [geocodingStatus, setGeocodingStatus] = useState<"idle" | "loading">("idle");
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const isStaff = ['admin', 'empleado', 'super_admin'].includes(user?.rol ?? '');
  const maptilerKey = import.meta.env.VITE_MAPTILER_KEY || "";

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
  // --- Fin de estados para el modal ---


  // Estados para la gestión de mapeos
  interface MappingConfig {
    id: string; // o number, según tu backend
    name: string;
    // Podríamos añadir más detalles si fueran necesarios en la lista, como fileType o ultimaModificacion
  }
  const [mappingConfigs, setMappingConfigs] = useState<MappingConfig[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [showManageMappingsDialog, setShowManageMappingsDialog] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<MappingConfig | null>(null);



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
        plan: data.plan || "gratis",
        preguntas_usadas: data.preguntas_usadas ?? 0,
        limite_preguntas: data.limite_preguntas ?? 50,
        rubro: data.rubro?.toLowerCase() || "",
        logo_url: data.logo_url || "",
        horarios_ui: horariosUi,
      }));

      const trimmedAddress = direccion.trim();
      setLastGeocodedAddress(trimmedAddress ? trimmedAddress : null);
      setIsManualLocation(Boolean(latitud !== null && longitud !== null));
      setPendingGeocode(null);
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
    try {
      const tipo = getCurrentTipoChat();
      const stats = await getTicketStats({ tipo });
      const points = stats.heatmap || [];
      setHeatmapData(points);

      const barrios = Array.from(new Set(points.map((d) => d.barrio).filter(Boolean))) as string[];
      setAvailableBarrios(barrios);

      const tipos = Array.from(new Set(points.map((d) => d.tipo_ticket).filter(Boolean))) as string[];
      setAvailableTipos(tipos);

      const categoryData = await apiFetch<{ categorias: { id: number; nombre: string }[] }>('/municipal/categorias');
      setAvailableCategories(
        Array.isArray(categoryData.categorias) ? categoryData.categorias.map((c) => c.nombre) : []
      );

    } catch (error) {
      console.error("Error fetching map data:", error);
      toast({
        variant: "destructive",
        title: "Error al cargar datos del mapa",
        description: getErrorMessage(error),
      });
    }
  }, []);


  useEffect(() => {
    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      navigate("/login"); // Usar navigate para la redirección
      return;
    }
    (async () => {
      await fetchPerfil();
      await fetchMapData();
    })();
  }, [fetchPerfil, fetchMapData, navigate]);

  // Función para cargar las configuraciones de mapeo
  const fetchMappingConfigs = useCallback(async () => {
    if (!user?.id) return; // Asegurarse que tenemos el ID de la PYME (user.id)
    setLoadingMappings(true);
    try {
      const data = await apiFetch<MappingConfig[]>(`/pymes/${user.id}/catalog-mappings`);
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
  }, [user?.id]);

  // Cargar mapeos cuando el diálogo se va a mostrar
  useEffect(() => {
    if (showManageMappingsDialog && user?.id) {
      fetchMappingConfigs();
    }
  }, [showManageMappingsDialog, user?.id, fetchMappingConfigs]);

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
    let pymeId = user?.id;
    if (!pymeId) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo identificar la PYME." });
      setLoadingCatalogo(false);
      return;
    }

    let configs: MappingConfig[] = mappingConfigs;
    // Si mappingConfigs no se ha cargado aún (ej. el usuario no abrió el diálogo de gestión)
    // podríamos cargarlas aquí ad-hoc, o asumir que si no están cargadas, no hay ninguna.
    // Por simplicidad inicial, si no están en estado, las cargamos.
    if (configs.length === 0 && !loadingMappings) { // Evitar recargar si ya se están cargando
        try {
            configs = await apiFetch<MappingConfig[]>(`/pymes/${pymeId}/catalog-mappings`) || [];
            setMappingConfigs(configs); // Actualizar estado si se cargan aquí
        } catch (fetchErr) {
            // No bloquear la subida si esto falla, se procederá como si no hubiera mapeos
            console.warn("No se pudieron cargar mapeos existentes antes de subir archivo:", fetchErr);
        }
    }

    // TODO: Implementar lógica para elegir mapeo predeterminado o único
    // Por ahora, si no hay mapeos, o si hay más de uno y no hay predeterminado,
    // redirigimos a la creación de mapeo con el archivo.
    const shouldGoToMappingPage = configs.length === 0; // Simplificación: siempre ir si no hay mapeos.
                                                        // Futuro: ir si hay >1 y ninguno es default, o si el usuario elige configurar.

    if (shouldGoToMappingPage) {
      // En lugar de redirigir, ahora abrimos el modal.
      setIsMappingModalOpen(true);
      // El resto de la lógica (parseo, etc.) se manejará dentro del modal y sus funciones.
    }
  };

  // Lógica de parseo y guardado para el nuevo flujo del modal
  const parseFileAndSuggest = useCallback(async (fileToParse: File) => {
    if (!fileToParse) return;
    setIsParsing(true);
    setFileProcessingError(null);
    setParsedColumns([]);
    setSuggestedMappings({});

    try {
      let headers: string[] = [];
      const fileType = fileToParse.name.split('.').pop()?.toLowerCase();

      if (fileType === 'csv' || fileType === 'txt') {
        const text = await fileToParse.text();
        const result = Papa.parse(text, { preview: 1, skipEmptyLines: true });
        if (result.errors.length > 0) throw new Error(`Error al parsear CSV: ${result.errors[0].message}`);
        headers = result.data[0] as string[];
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        const arrayBuffer = await fileToParse.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
        if (jsonData.length > 0) headers = jsonData[0].map(String);
      } else {
        throw new Error("Tipo de archivo no soportado. Por favor, sube un CSV o Excel.");
      }

      if (headers.length === 0) {
        throw new Error("No se encontraron columnas/encabezados en el archivo.");
      }

      setParsedColumns(headers);
      const suggestions = suggestMappings(headers, systemFields);
      const newMappings: Record<string, string | null> = {};
      suggestions.forEach(s => {
        newMappings[s.systemFieldKey] = s.userColumn;
      });
      setSuggestedMappings(newMappings);

    } catch (e) {
      setFileProcessingError(getErrorMessage(e, "Error al procesar el archivo."));
    } finally {
      setIsParsing(false);
    }
  }, [systemFields]);

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
    const configToSave = {
      pymeId: user.id,
      name: mappingName,
      mappings: suggestedMappings,
      fileSettings: { hasHeaders: true, skipRows: 0 }, // Usamos defaults simples
    };

    try {
      // Asumimos que el backend está listo para recibir esto.
      const savedMapping = await apiFetch<any>(`/pymes/${user.id}/catalog-mappings`, {
        method: 'POST',
        body: configToSave,
      });

      toast({ title: "Paso 1/2: Formato guardado", description: `Se guardó la configuración "${mappingName}".` });

      // 2. Ahora, procesar el archivo usando este nuevo mapeo
      // (Esta parte sigue siendo hipotética hasta que el backend la implemente por completo)
      const formData = new FormData();
      formData.append("file", archivo);
      formData.append("mappingId", savedMapping.id);

      const processingResult = await apiFetch<any>(`/pymes/${user.id}/process-catalog-file`, {
        method: "POST",
        body: formData,
      });

      setResultadoCatalogo({
        message: processingResult.mensaje || "¡Catálogo subido y procesado con éxito!",
        type: "success",
      });
      setArchivo(null);
      setIsMappingModalOpen(false);

    } catch (err) {
      const errorMessage = getErrorMessage(err, "Ocurrió un error en el proceso.");
      setResultadoCatalogo({ message: errorMessage, type: "error" });
      // Mantener el modal abierto en caso de error para que el usuario pueda reintentar o cancelar.
    } finally {
      setLoadingCatalogo(false);
    }
  };

  const handleDeleteMapping = async () => {
    if (!mappingToDelete || !user?.id) return;
    setLoadingMappings(true); // Reutilizar loading para el diálogo
    try {
      await apiFetch<void>(`/pymes/${user.id}/catalog-mappings/${mappingToDelete.id}`, {
        method: 'DELETE',
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
      ? 200
      : perfil.limite_preguntas;

  const porcentaje =
    limitePlan === Infinity
      ? 100
      : limitePlan > 0
      ? Math.min((perfil.preguntas_usadas / limitePlan) * 100, 100)
      : 0;
  const esMunicipio = (user?.tipo_chat || perfil.rubro) === "municipio" || perfil.rubro === "municipios";

  return (
    <div className="flex flex-col min-h-screen bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-8 px-2 sm:px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-6xl mx-auto mb-6 relative px-2">
        <Button
          variant="outline"
          className="absolute right-0 top-0 h-10 px-5 text-sm rounded-lg border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => {
            safeLocalStorage.clear();
            navigate("/login"); // Usa navigate para la redirección
          }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
        <div className="flex flex-col items-center text-center gap-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary leading-tight flex items-center gap-4">
            <span className="inline-block align-middle">
              <MunicipioIcon />
            </span>
            {perfil.nombre_empresa || "Panel de Empresa"}
          </h1>
          <span className="text-muted-foreground text-sm sm:text-base font-medium capitalize">
            {perfil.rubro || "Rubro no especificado"}
          </span>
        </div>
      </div>

      <Tabs defaultValue="perfil" className="w-full max-w-6xl mx-auto">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          {esMunicipio && <TabsTrigger value="empleados">Empleados</TabsTrigger>}
          {esMunicipio && <TabsTrigger value="mapas">Mapas</TabsTrigger>}
        </TabsList>
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
              {isStaff && (
                <AnalyticsHeatmap
                  initialHeatmapData={heatmapData}
                  adminLocation={municipalityCoords}
                  availableCategories={availableCategories}
                  availableBarrios={availableBarrios}
                  availableTipos={availableTipos}
                  onSelect={handleMapSelect}
                />
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
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                                onClick={() =>
                                  window.open(
                                    "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849764e81a01976585767f0040",
                                    "_blank",
                                  )
                                }
                              >
                                Mejorar a PRO ($35.000/mes)
                              </Button>
                              <Button
                                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                                onClick={() =>
                                  window.open(
                                    "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849763daeb0197658791ee00b1",
                                    "_blank",
                                  )
                                }
                              >
                                Mejorar a FULL ($60.000/mes)
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
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        onClick={() =>
                          window.open(
                            "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849764e81a01976585767f0040",
                            "_blank",
                          )
                        }
                      >
                        Mejorar a PRO ($35.000/mes)
                      </Button>
                      <Button
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                        onClick={() =>
                          window.open(
                            "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849763daeb0197658791ee00b1",
                            "_blank",
                          )
                        }
                      >
                        Mejorar a FULL ($60.000/mes)
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

              {/* Cargar Catálogo Card */}
              <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex flex-col flex-grow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-primary">
                    {esMunicipio
                      ? "Cargar Catálogo de Trámites"
                      : "Cargar Catálogo de Productos"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex flex-col flex-grow">
                  <div>
                    <Label
                      htmlFor="catalogoFile"
                      className="text-sm text-muted-foreground mb-1 block"
                    >
                      Subir nuevo o actualizar (PDF, Excel, CSV)
                    </Label>
                    <Input
                      id="catalogoFile"
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf"
                      onChange={handleArchivoChange}
                      className="text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Tip: Para mayor precisión, usá Excel/CSV con columnas claras
                      (ej: Nombre, Precio, Descripción).
                    </p>
                  </div>

                  {/* Gestión de Mapeos */}
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <Dialog open={showManageMappingsDialog} onOpenChange={setShowManageMappingsDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full text-sm">
                          <Settings2 className="w-4 h-4 mr-2" />
                          Configurar Formatos de Archivo...
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[625px]">
                        <DialogHeader>
                          <DialogTitle className="text-xl flex items-center">
                            <FileCog className="w-5 h-5 mr-2 text-primary"/>
                            Mis Formatos de Archivo de Catálogo
                          </DialogTitle>
                          <DialogDescription>
                            Gestiona cómo se leen las columnas de tus archivos de catálogo. Puedes tener múltiples formatos.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-2 max-h-[60vh] overflow-y-auto">
                          {loadingMappings && <p className="text-muted-foreground text-sm p-4 text-center">Cargando formatos...</p>}
                          {!loadingMappings && mappingConfigs.length === 0 && (
                            <p className="text-muted-foreground text-sm p-4 text-center">
                              Aún no has guardado ninguna configuración de formato.
                              Se intentará detectar las columnas automáticamente al subir un archivo.
                            </p>
                          )}
                          {!loadingMappings && mappingConfigs.length > 0 && (
                            <ul className="space-y-2">
                              {mappingConfigs.map((config) => (
                                <li key={config.id} className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/60 rounded-md border border-border">
                                  <span className="text-sm font-medium text-foreground">{config.name}</span>
                                  <div className="space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => navigate(`/admin/pyme/${user?.id}/catalog-mappings/${config.id}`)}
                                      title="Editar"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setMappingToDelete(config)}
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <DialogFooter className="mt-4 sm:justify-between gap-2">
                           <DialogClose asChild>
                             <Button variant="outline" className="w-full sm:w-auto">Cerrar</Button>
                           </DialogClose>
                           <Button
                             className="w-full sm:w-auto"
                             onClick={() => navigate(`/admin/pyme/${user?.id}/catalog-mappings/new`)}
                           >
                             <PlusCircle className="w-4 h-4 mr-2" />
                             Crear Nuevo Formato
                           </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {/* Fin Gestión de Mapeos */}

                  <div className="flex-grow"></div> {/* Spacer element */}
                  <Button
                    onClick={handleSubirArchivo}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 mt-auto"
                    disabled={loadingCatalogo || !archivo}
                  >
                    <UploadCloud className="w-4 h-4 mr-2" />{" "}
                    {loadingCatalogo
                      ? "Procesando Catálogo..."
                      : "Subir y Procesar Catálogo"}
                  </Button>
                  {resultadoCatalogo && (
                    <div
                      className={`text-sm p-3 rounded-md flex items-center gap-2 ${resultadoCatalogo.type === "error" ? "bg-destructive text-destructive-foreground" : "bg-green-100 text-green-800"}`}
                    >
                      {resultadoCatalogo.type === "error" ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}{" "}
                      {resultadoCatalogo.message}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gestión de Eventos y Noticias Card */}
              {isStaff && (
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
              )}

              {/* Tarjeta de Integración */}
              <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex flex-col flex-grow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-primary">
                    Integrá Chatboc a tu web
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col flex-grow">
                  {perfil.plan === "pro" || perfil.plan === "full" ? (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      onClick={() => navigate("/integracion")}
                    >
                      Ir a la guía de integración
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-muted text-muted-foreground cursor-not-allowed"
                      disabled
                      title="Solo para clientes con Plan PRO o FULL"
                      style={{ pointerEvents: "none" }}
                    >
                      Plan PRO requerido para activar integración
                    </Button>
                  )}
                  <div className="flex-grow flex items-center justify-center p-4">
                    <MiniChatWidgetPreview />
                  </div>
                  <div className="text-xs text-muted-foreground mt-auto pt-2">
                    Accedé a los códigos e instrucciones para pegar el widget de
                    Chatboc en tu web solo si tu plan es PRO o superior.
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
        <TabsContent value="usuarios">
          <UsuariosPage />
        </TabsContent>
        {esMunicipio && (
          <TabsContent value="empleados">
            <InternalUsers />
          </TabsContent>
        )}
        {esMunicipio && (
          <TabsContent value="mapas">
            <IncidentsMap />
          </TabsContent>
        )}
      </Tabs>

      {/* AlertDialog para confirmar eliminación de mapeo */}
      <AlertDialog open={!!mappingToDelete} onOpenChange={(open) => !open && setMappingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar este formato?</AlertDialogTitle>
            <AlertDialogDescription>
              Formato: <span className="font-semibold">{mappingToDelete?.name}</span>
              <br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMappingToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMapping}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loadingMappings}
            >
              {loadingMappings ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Modal de Mapeo Simplificado --- */}
      <Dialog open={isMappingModalOpen} onOpenChange={setIsMappingModalOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center">
              <Wand2 className="w-5 h-5 mr-2 text-primary"/>
              Confirmar Columnas del Catálogo
            </DialogTitle>
            <DialogDescription>
              Hemos detectado las siguientes columnas en tu archivo <strong>{archivo?.name}</strong>.
              Confirma si el mapeo es correcto para procesarlo.
            </DialogDescription>
          </DialogHeader>

          {isParsing && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <p className="text-muted-foreground">Analizando archivo...</p>
            </div>
          )}

          {fileProcessingError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <strong>Error:</strong> {fileProcessingError}
              </div>
          )}

          {!isParsing && !fileProcessingError && parsedColumns.length > 0 && (
            <div className="py-2 max-h-[50vh] overflow-y-auto">
                <ul className="space-y-2 text-sm">
                  {systemFields.map(field => {
                    const mappedColumn = suggestedMappings[field.key];
                    if (mappedColumn) {
                      return (
                        <li key={field.key} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                          <span className="font-semibold text-foreground">{field.label}</span>
                          <span className="text-primary font-mono text-xs p-1 bg-primary/10 rounded">{mappedColumn}</span>
                        </li>
                      );
                    }
                    return null;
                  })}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Campos no encontrados en el archivo serán ignorados.
                </p>
            </div>
          )}

          <DialogFooter className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="w-full sm:col-span-1"
              onClick={() => navigate(`/admin/pyme/${user?.id}/catalog-mappings/new`, { state: { preloadedFile: archivo }})}
            >
              Configuración Avanzada...
            </Button>
            <DialogClose asChild className="sm:col-start-2">
              <Button variant="ghost" className="w-full">Cancelar</Button>
            </DialogClose>
            <Button
              className="w-full sm:col-span-1"
              onClick={handleConfirmAndProcess}
              disabled={isParsing || loadingCatalogo || !!fileProcessingError}
            >
              {(isParsing || loadingCatalogo) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar y Procesar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
