import React, { useEffect, useState, useCallback, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
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
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import LocationMap from "@/components/LocationMap";
import { useNavigate } from "react-router-dom";
import QuickLinksCard from "@/components/QuickLinksCard";
import MiniChatWidgetPreview from "@/components/ui/MiniChatWidgetPreview"; // Importar el nuevo componente
import { useUser } from "@/hooks/useUser";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { apiFetch, getErrorMessage, ApiError } from "@/utils/api"; // Importa apiFetch y getErrorMessage

// Durante el desarrollo usamos "/api" para evitar problemas de CORS.
// Por defecto, usa esa ruta si no se proporciona ninguna variable de entorno.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY || "";
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
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(null);
  const [direccionConfirmada, setDireccionConfirmada] = useState(false);
  const [modoHorario, setModoHorario] = useState("comercial");
  const [archivo, setArchivo] = useState<File | null>(null); // Tipado para archivo
  const [resultadoCatalogo, setResultadoCatalogo] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null); // Mensaje de éxito
  const [error, setError] = useState<string | null>(null); // Mensaje de error
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);

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


  useEffect(() => {
    if (!Maps_API_KEY) {
      setError(
        "Error de configuración: Falta la clave para Google Maps. Contacta a soporte.",
      );
    }
  }, []);

  // Sincronizá la dirección seleccionada cuando cambie perfil.direccion
  useEffect(() => {
    setDireccionSeleccionada(
      perfil.direccion
        ? { label: perfil.direccion, value: perfil.direccion }
        : null,
    );
    setDireccionConfirmada(!!perfil.direccion);
  }, [perfil.direccion]);

  // fetchPerfil actualizado para usar apiFetch
  const fetchPerfil = useCallback(async () => { // Ya no necesita 'token' como argumento
    setLoadingGuardar(true);
    setError(null);
    setMensaje(null);
    try {
      const data = await apiFetch<any>("/me"); // Usa apiFetch, que maneja el token
      
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
        direccion: data.direccion || "",
        ciudad: data.ciudad || "",
        provincia: data.provincia || "",
        pais: data.pais || "Argentina",
        latitud: data.latitud || null,
        longitud: data.longitud || null,
        link_web: data.link_web || "",
        plan: data.plan || "gratis",
        preguntas_usadas: data.preguntas_usadas ?? 0,
        limite_preguntas: data.limite_preguntas ?? 50,
        rubro: data.rubro?.toLowerCase() || "",
        logo_url: data.logo_url || "",
        horarios_ui: horariosUi,
      }));
      setDireccionConfirmada(!!data.direccion);
      
      // Actualizar localStorage a través de useUser refreshUser si es necesario
      refreshUser();

    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Si el token es inválido o expiró, forzar logout
        safeLocalStorage.removeItem("user");
        safeLocalStorage.removeItem("authToken");
        navigate("/login"); // Usar navigate para la redirección
      } else {
        setError(getErrorMessage(err, "Error al cargar el perfil."));
      }
    } finally {
      setLoadingGuardar(false);
    }
  }, [navigate, refreshUser]); // Añadir navigate y refreshUser a las dependencias

  useEffect(() => {
    const token = safeLocalStorage.getItem("authToken");
    if (!token) {
      navigate("/login"); // Usar navigate para la redirección
      return;
    }
    fetchPerfil(); // Llamar sin token
  }, [fetchPerfil, navigate]);

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


  const handlePlaceSelected = (place: google.maps.places.PlaceResult | null) => { // Tipado de 'place'
    if (!place || !place.address_components || !place.geometry) {
      setError(
        "No se pudo encontrar la dirección. Intenta de nuevo o escribila bien.",
      );
      setPerfil((prev) => ({
        ...prev,
        direccion: place?.formatted_address || "",
      }));
      setDireccionConfirmada(false);
      return;
    }
    const getAddressComponent = (type: string) => // Tipado de 'type'
      place.address_components?.find((c) => c.types.includes(type))
        ?.long_name || "";
    setPerfil((prev) => ({
      ...prev,
      direccion: place.formatted_address || "",
      ciudad:
        getAddressComponent("locality") ||
        getAddressComponent("administrative_area_level_2") ||
        "",
      provincia: getAddressComponent("administrative_area_level_1") || "",
      pais: getAddressComponent("country") || "",
      latitud: place.geometry?.location?.lat() || null,
      longitud: place.geometry?.location?.lng() || null,
    }));
    setError(null);
    setDireccionConfirmada(false); // Deja que el usuario guarde para confirmar
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { // Tipado de 'e'
    const { id, value } = e.target;
    setPerfil((prev) => ({ ...prev, [id]: value }));
    // Si toca el campo dirección manualmente, dejá el autocomplete limpio
    if (id === "direccion") {
      setDireccionSeleccionada(null);
      setDireccionConfirmada(false); // Si edita, la dirección ya no está "confirmada" por Google
    }
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
      // Redirigir a la página de mapeo, pasando el archivo
      toast({
        title: "Configuración Requerida",
        description: "Vamos a configurar cómo leer tu archivo."
      });
      navigate(`/admin/pyme/${pymeId}/catalog-mappings/new`, {
        state: { preloadedFile: archivo }
      });
      // No limpiar setLoadingCatalogo ni setArchivo aquí, CatalogMappingPage tomará el control
      return;
    } else {
      // Lógica para procesar directamente con un mapeo existente (a desarrollar)
      // Esto implicaría seleccionar el mapeo adecuado (ej. el primero, o uno marcado como default)
      // y luego llamar a una API del backend que procese el archivo usando ese mapeo.
      // POST /api/pymes/{pymeId}/process-catalog-file con file y mappingId
      const mappingToUse = configs[0]; // Simplificación: usar el primer mapeo encontrado

      try {
        const formData = new FormData();
        formData.append("file", archivo);
        formData.append("mappingId", mappingToUse.id); // Enviar el ID del mapeo

        // Asumimos un nuevo endpoint o que /catalogo/cargar puede tomar un mappingId
        const data = await apiFetch<any>(`/pymes/${pymeId}/process-catalog-file`, { // Endpoint hipotético
          method: "POST",
          body: formData,
        });

        setResultadoCatalogo({
          message: data.mensaje || "Catálogo subido y procesado con el formato guardado ✔️",
          type: "success",
        });
        setArchivo(null);
      } catch (err) {
        setResultadoCatalogo({
          message: getErrorMessage(err, "Error al subir y procesar el catálogo con el formato guardado."),
          type: "error",
        });
      } finally {
        setLoadingCatalogo(false);
      }
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

      <div className="w-full max-w-6xl mx-auto mb-8 px-2">
        <QuickLinksCard/>
      </div>

      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6 md:gap-8 px-2 items-stretch">
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
                <div className="relative">
                  <Label
                    htmlFor="google-places-input"
                    className="text-muted-foreground text-sm mb-1 block"
                  >
                    Dirección Completa*
                  </Label>
                  <AddressAutocomplete
                    value={direccionSeleccionada}
                    onChange={(option) => {
                      setDireccionSeleccionada(option || null);
                      if (!option)
                        setPerfil((prev) => ({ ...prev, direccion: "" }));
                    }}
                    onSelect={(addr) => {
                      window?.google?.maps?.Geocoder &&
                        new window.google.maps.Geocoder().geocode(
                          { address: addr },
                          (results, status) => {
                            if (status === "OK" && results[0]) {
                              handlePlaceSelected(results[0]);
                              setDireccionSeleccionada({ label: addr, value: addr });
                            } else {
                              setPerfil((prev) => ({
                                ...prev,
                                direccion: addr,
                              }));
                              setError(
                                "No se pudo verificar esa dirección. Intenta escribirla bien.",
                              );
                            }
                          },
                        );
                    }}
                    disabled={!!perfil.direccion && !!direccionSeleccionada}
                    placeholder="Ej: Av. Principal 123"
                  />
                  {!!perfil.direccion && !!direccionSeleccionada && (
                    <div className="absolute right-2 top-9 flex gap-2">
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-destructive/10 text-destructive"
                        onClick={() => {
                          setDireccionSeleccionada(null);
                          setPerfil((prev) => ({ ...prev, direccion: "" }));
                        }}
                        title="Borrar dirección"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-green-100 text-green-700"
                        title="Dirección confirmada"
                        disabled
                        tabIndex={-1}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  )}
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

                {/* Ubicación en el Mapa - Integrado en la tarjeta de Datos */}
                {(perfil.direccion || (perfil.latitud !== null && perfil.longitud !== null)) && (
                  <div className="mt-4 flex flex-col flex-grow"> {/* Add margin top, flex-grow and flex-col */}
                    <Label className="text-muted-foreground text-sm mb-1 block">
                      Ubicación en el Mapa
                    </Label>
                    <LocationMap
                      lat={perfil.latitud ?? undefined}
                      lng={perfil.longitud ?? undefined}
                      onMove={(la, ln) =>
                        setPerfil((prev) => ({ ...prev, latitud: la, longitud: ln }))
                      }
                    />
                  </div>
                )}

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
              </form>
            </CardContent>
          </Card>
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
      </div> {/* Fin del contenedor principal flex-col md:flex-row */}

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
    </div>
  );
}