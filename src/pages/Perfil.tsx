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
const Maps_API_KEY =
  import.meta.env.VITE_Maps_API_KEY || "AIzaSyDbEoPzFgN5zJsIeywiRE7jRI8xr5ioGNI";
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

  useEffect(() => {
    if (!Maps_API_KEY || Maps_API_KEY.includes("AIzaSyDbEoPzFgN5zJsIeywiRE7jRI8xr5ioGNI")) {
      setError(
        "Error de configuración: Falta la clave para Google Maps o es la predeterminada. Contacta a soporte.",
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
  }, [fetchPerfil, navigate]); // Añadir navigate a las dependencias

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
    try {
      const formData = new FormData();
      formData.append("file", archivo); // Asegúrate que el backend espera 'file' o 'archivo'
      
      // Usa apiFetch para la subida de archivos
      const data = await apiFetch<any>("/catalogo/cargar", {
        method: "POST",
        body: formData, // apiFetch maneja FormData correctamente (no Content-Type)
      });
      
      setResultadoCatalogo({
        message: data.mensaje || "Catálogo subido y procesado correctamente ✔️", // Asume que backend devuelve 'mensaje'
        type: "success",
      });
    } catch (err) {
      setResultadoCatalogo({
        message: getErrorMessage(err, "Error al subir y procesar el catálogo."),
        type: "error",
      });
    } finally {
      setLoadingCatalogo(false);
      setArchivo(null); // Limpiar el archivo seleccionado después de subir
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
// Importar Select de shadcn/ui
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Importar Checkbox y Label si se usan para los horarios o términos
import { Checkbox } from "@/components/ui/checkbox";
import { Label as ShadcnLabel } from "@/components/ui/label"; // Renombrar para evitar conflicto con Label de React


// ... (resto de las importaciones) ...

export default function Perfil() {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const [perfil, setPerfil] = useState({
    nombre_empresa: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    pais: "Argentina",
    latitud: null as number | null, // Tipado explícito
    longitud: null as number | null, // Tipado explícito
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
  const [direccionSeleccionada, setDireccionSeleccionada] = useState<any>(null); // Tipar mejor si es posible
  // const [direccionConfirmada, setDireccionConfirmada] = useState(false); // Parece no usarse, considerar eliminar
  const [modoHorario, setModoHorario] = useState("comercial");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultadoCatalogo, setResultadoCatalogo] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // Para errores del formulario principal
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);

  useEffect(() => {
    document.title = "Mi Perfil - Chatboc";
    if (!Maps_API_KEY || Maps_API_KEY.includes("AIzaSyDbEoPzFgN5zJsIeywiRE7jRI8xr5ioGNI")) {
      // setError("Error de configuración: Falta la clave para Google Maps o es la predeterminada. Contacta a soporte.");
      console.warn("Error de configuración: Falta la clave para Google Maps o es la predeterminada.");
    }
  }, []);

  useEffect(() => {
    setDireccionSeleccionada(
      perfil.direccion ? { label: perfil.direccion, value: perfil.direccion } : null
    );
    // setDireccionConfirmada(!!perfil.direccion); // Considerar si se necesita o se puede basar en perfil.direccion
  }, [perfil.direccion]);

  const fetchPerfil = useCallback(async () => {
    setLoadingGuardar(true);
    setError(null);
    setMensaje(null);
    try {
      const data = await apiFetch<any>("/me");
      let horariosUi = DIAS.map((_, idx) => ({
        dia: DIAS[idx], // Añadir el día para referencia si es necesario
        abre: "09:00",
        cierra: "20:00",
        cerrado: idx === 5 || idx === 6,
      }));
      if (data.horario_json && Array.isArray(data.horario_json) && data.horario_json.length === DIAS.length) {
        horariosUi = data.horario_json.map((h: any, idx: number) => ({ // Tipar h si es posible
          dia: DIAS[idx],
          abre: h.abre || "09:00",
          cierra: h.cierra || "20:00",
          cerrado: typeof h.cerrado === "boolean" ? h.cerrado : idx === 5 || idx === 6,
        }));
      }
      setPerfil(prev => ({
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
        plan: data.plan?.toLowerCase() || "gratis",
        preguntas_usadas: data.preguntas_usadas ?? 0,
        limite_preguntas: data.limite_preguntas ?? 50,
        rubro: data.rubro?.toLowerCase() || "",
        logo_url: data.logo_url || "",
        horarios_ui: horariosUi,
      }));
      // setDireccionConfirmada(!!data.direccion);
      refreshUser();
    } catch (err) {
      // ... (manejo de error existente)
      if (err instanceof ApiError && err.status === 401) {
        safeLocalStorage.clear(); // Limpiar todo en caso de 401
        navigate("/login");
      } else {
        setError(getErrorMessage(err, "Error al cargar el perfil."));
      }
    } finally {
      setLoadingGuardar(false);
    }
  }, [navigate, refreshUser]);

  useEffect(() => {
    if (!safeLocalStorage.getItem("authToken")) {
      navigate("/login");
      return;
    }
    fetchPerfil();
  }, [fetchPerfil, navigate]);

  const handlePlaceSelected = (place: google.maps.places.PlaceResult | null) => {
    if (!place || !place.address_components || !place.geometry?.location) {
      // setError("No se pudo encontrar la dirección. Intenta de nuevo o escribila bien.");
      // Mantener el texto del input si la selección falla o es parcial
      setPerfil(prev => ({ ...prev, direccion: place?.formatted_address || prev.direccion, latitud: null, longitud: null }));
      // setDireccionConfirmada(false);
      return;
    }
    const getAddressComponent = (type: string) => place.address_components?.find(c => c.types.includes(type))?.long_name || "";
    setPerfil(prev => ({
      ...prev,
      direccion: place.formatted_address || "",
      ciudad: getAddressComponent("locality") || getAddressComponent("administrative_area_level_2") || "",
      provincia: getAddressComponent("administrative_area_level_1") || "",
      pais: getAddressComponent("country") || "",
      latitud: place.geometry!.location!.lat(), // Usar non-null assertion si estamos seguros
      longitud: place.geometry!.location!.lng(),
    }));
    setError(null);
    // setDireccionConfirmada(true); // Se confirma al seleccionar
    setDireccionSeleccionada({ label: place.formatted_address, value: place.formatted_address });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setPerfil(prev => ({ ...prev, [id]: value }));
    if (id === "direccion") {
      setDireccionSeleccionada(value ? { label: value, value: value} : null);
      // setDireccionConfirmada(false);
    }
  };

  const handleHorarioChange = (index: number, field: string, value: string | boolean) => {
    setPerfil(prev => ({
      ...prev,
      horarios_ui: prev.horarios_ui.map((h, idx) => idx === index ? { ...h, [field]: value } : h),
    }));
  };

  const setHorarioComercial = () => { /* ... (sin cambios) ... */ };
  const setHorarioPersonalizado = () => { /* ... (sin cambios) ... */ };

  const handleGuardar = async (e: FormEvent) => { /* ... (sin cambios en lógica, pero revisar Button y mensajes) ... */ };
  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... (sin cambios) ... */ };
  const handleSubirArchivo = async () => { /* ... (sin cambios en lógica, pero revisar Button y mensajes) ... */ };

  const plan = perfil.plan; // Ya es lowercase desde fetchPerfil
  const limitePlan = plan === 'full' ? Infinity : plan === 'pro' ? 200 : perfil.limite_preguntas;
  const porcentaje = limitePlan === Infinity ? 100 : limitePlan > 0 ? Math.min((perfil.preguntas_usadas / limitePlan) * 100, 100) : 0;
  const esMunicipio = user?.tipo_chat === "municipio" || perfil.rubro === "municipios";

  return (
    // Padding general aumentado, especialmente en y
    <div className="flex flex-col min-h-screen bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-10 px-4 sm:px-6 md:px-8">
      <div className="w-full max-w-7xl mx-auto mb-8 relative"> {/* max-w-7xl */}
        <Button
          variant="destructive" // Usar variante destructiva
          size="default" // Nuestro default es h-10/h-11
          className="absolute right-0 top-0 text-sm sm:text-base"
          onClick={() => {
            safeLocalStorage.clear();
            navigate("/login");
          }}
        >
          <LogOut className="w-5 h-5 mr-2" /> Salir
        </Button>
        <div className="flex flex-col items-center text-center gap-2 pt-1 sm:pt-0">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-primary leading-tight flex items-center gap-3 sm:gap-4">
            <span className="inline-block align-middle"><MunicipioIcon size={40} /></span> {/* Ajustar tamaño icono */}
            {perfil.nombre_empresa || "Panel de Configuración"}
          </h1>
          <span className="text-muted-foreground text-base sm:text-lg font-medium capitalize"> {/* text-base o sm:text-lg */}
            {perfil.rubro || "Rubro no especificado"}
          </span>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto mb-10"> {/* mb-10 */}
        <QuickLinksCard/>
      </div>

      <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 md:gap-10"> {/* gap aumentado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          <div className="md:col-span-2 flex flex-col gap-8 md:gap-10">
            <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm h-full">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-primary"> {/* text-2xl */}
                  Datos de tu Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGuardar} className="space-y-6"> {/* space-y-6 */}
                  <div>
                    <ShadcnLabel htmlFor="nombre_empresa" className="text-base font-medium text-muted-foreground mb-1.5 block">Nombre de la empresa*</ShadcnLabel> {/* text-base */}
                    <Input id="nombre_empresa" value={perfil.nombre_empresa} onChange={handleInputChange} required sizeVariant="lg" /> {/* sizeVariant="lg" */}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5"> {/* gap aumentado */}
                    <div>
                      <ShadcnLabel htmlFor="telefono" className="text-base font-medium text-muted-foreground mb-1.5 block">Teléfono*</ShadcnLabel>
                      <Input id="telefono" placeholder="+5492611234567" value={perfil.telefono} onChange={handleInputChange} required sizeVariant="lg" />
                    </div>
                    <div>
                      <ShadcnLabel htmlFor="link_web" className="text-base font-medium text-muted-foreground mb-1.5 block">Sitio Web / Tienda Online*</ShadcnLabel>
                      <Input id="link_web" type="url" placeholder="https://ejemplo.com" value={perfil.link_web} onChange={handleInputChange} required sizeVariant="lg" />
                    </div>
                  </div>
                  <div className="relative">
                    <ShadcnLabel htmlFor="google-places-input" className="text-base font-medium text-muted-foreground mb-1.5 block">Dirección Completa*</ShadcnLabel>
                    <AddressAutocomplete // Asumimos que este componente internamente usa Inputs de buen tamaño
                      value={direccionSeleccionada}
                      onChange={(option) => { /* ... */ }}
                      onSelect={(addr) => { /* ... */ }}
                      // disabled={!!perfil.direccion && !!direccionSeleccionada} // Considerar si este disabled es necesario
                      placeholder="Ej: Av. Principal 123, Ciudad"
                    />
                    {/* Los botones de borrar/check de dirección necesitan ser más grandes */}
                    {/* ... (lógica de botones de borrar/check, aplicar Button size="icon-sm" o similar) ... */}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    <div>
                      <ShadcnLabel htmlFor="ciudad" className="text-base font-medium text-muted-foreground mb-1.5 block">Ciudad</ShadcnLabel>
                      <Input id="ciudad" value={perfil.ciudad} onChange={handleInputChange} sizeVariant="lg" />
                    </div>
                    <div>
                      <ShadcnLabel htmlFor="provincia" className="text-base font-medium text-muted-foreground mb-1.5 block">Provincia*</ShadcnLabel>
                      <Select value={perfil.provincia} onValueChange={(value) => handleInputChange({ target: { id: 'provincia', value } } as any)} required>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder="Selecciona una provincia" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVINCIAS.map(p => <SelectItem key={p} value={p} className="text-base">{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <ShadcnLabel className="text-base font-medium text-muted-foreground block mb-2">Horarios de Atención</ShadcnLabel>
                    <div className="flex flex-wrap gap-3 mb-4"> {/* gap-3, mb-4 */}
                      <Button type="button" variant={modoHorario === "comercial" ? "secondary" : "outline"} size="default" onClick={setHorarioComercial} className="text-base">Automático (Lun-V 9-20)</Button> {/* size="default", text-base */}
                      <Button type="button" variant={modoHorario === "personalizado" ? "secondary" : "outline"} size="default" onClick={setHorarioPersonalizado} className="text-base flex items-center"> {/* size="default", text-base */}
                        {horariosOpen ? <ChevronUp className="w-5 h-5 mr-1.5" /> : <ChevronDown className="w-5 h-5 mr-1.5" />} Personalizar
                      </Button>
                    </div>
                    {modoHorario === "comercial" && ( /* Texto aumentado */
                      <div className="text-primary bg-primary/10 rounded-lg border border-primary/50 p-3.5 flex items-center gap-2 text-sm"> <Info className="w-5 h-5 inline mr-1" /> L-V: 09-20. Sáb y Dom: Cerrado.</div>
                    )}
                    {modoHorario === "personalizado" && horariosOpen && (
                      <div className="border border-border rounded-lg p-4 mt-2 bg-card/60 space-y-4"> {/* space-y-4 */}
                        {DIAS.map((dia, idx) => (
                          <div key={dia} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[120px_auto_1fr] items-center gap-x-3 gap-y-2 text-base"> {/* text-base, gap-x-3 */}
                            <span className="font-medium text-foreground col-span-3 sm:col-span-1">{dia}</span>
                            <div className="flex items-center gap-2 col-span-3 sm:col-span-1 sm:justify-self-end">
                              <Checkbox id={`cerrado-${idx}`} checked={perfil.horarios_ui[idx].cerrado} onCheckedChange={(checked) => handleHorarioChange(idx, "cerrado", checked as boolean)} className="h-5 w-5" />
                              <ShadcnLabel htmlFor={`cerrado-${idx}`} className="text-sm font-normal text-muted-foreground cursor-pointer select-none">Cerrado</ShadcnLabel> {/* text-sm */}
                            </div>
                            {!perfil.horarios_ui[idx].cerrado && (
                              <div className="flex items-center gap-2 col-span-3 sm:col-span-1 sm:justify-self-start"> {/* gap-2 */}
                                <Input type="time" value={perfil.horarios_ui[idx].abre} className="w-full sm:w-32 h-10 text-sm" onChange={(e) => handleHorarioChange(idx, "abre", e.target.value)} /> {/* h-10 text-sm */}
                                <span className="text-muted-foreground mx-1">-</span>
                                <Input type="time" value={perfil.horarios_ui[idx].cierra} className="w-full sm:w-32 h-10 text-sm" onChange={(e) => handleHorarioChange(idx, "cierra", e.target.value)} /> {/* h-10 text-sm */}
                              </div>
                            )}
                            {/* ... */}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button disabled={loadingGuardar} type="submit" size="lg" className="w-full mt-6 text-lg font-semibold"> {/* size="lg", text-lg, mt-6 */}
                    {loadingGuardar ? "Guardando Cambios..." : "Guardar Cambios"}
                  </Button>
                  {mensaje && ( /* Mensajes con mejor estilo y tamaño */
                    <div className="mt-4 text-base text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 p-3.5 rounded-lg flex items-center gap-2.5 border border-green-300 dark:border-green-700">
                      <CheckCircle className="h-6 w-6" /> {mensaje}
                    </div>
                  )}
                  {error && (
                    <div className="mt-4 text-base text-destructive dark:text-red-400 bg-destructive/10 dark:bg-red-900/30 p-3.5 rounded-lg flex items-center gap-2.5 border border-destructive/30 dark:border-red-700">
                      <XCircle className="h-6 w-6" /> {error}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-8 md:gap-10 md:col-span-1 h-full">
            <div className="md:hidden"> {/* Acordeón para Plan y Uso en móvil */}
              <Accordion type="single" collapsible defaultValue="plan" className="bg-card shadow-xl rounded-xl border border-border">
                <AccordionItem value="plan" className="border-b-0"> {/* No border-b si es el único item */}
                  <AccordionTrigger className="px-4 py-3.5 text-lg font-semibold text-primary hover:no-underline">Plan y Uso</AccordionTrigger> {/* text-lg */}
                  <AccordionContent className="px-4 pb-4 pt-1"> {/* Ajuste de padding */}
                    {/* Contenido de Plan y Uso (copiado y adaptado de la versión desktop) */}
                    <div className="space-y-4 text-base"> {/* text-base para contenido */}
                      <div className="text-muted-foreground flex items-center gap-2">
                        <span>Plan actual:</span>
                        <Badge variant="secondary" className="bg-primary text-primary-foreground capitalize text-sm px-2.5 py-0.5">{perfil?.plan || "N/A"}</Badge> {/* text-sm */}
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Consultas usadas este mes:</p>
                        <div className="flex items-center gap-2.5">
                          <Progress value={porcentaje} className="h-3.5 bg-muted [&>div]:bg-primary" /> {/* h-3.5 */}
                          <span className="text-sm text-muted-foreground min-w-[75px] text-right">{perfil?.preguntas_usadas} / {limitePlan === Infinity ? '∞' : limitePlan}</span> {/* text-sm */}
                        </div>
                      </div>
                      {/* ... (Botones de Mejorar Plan con size="default" o "lg" y text-base) ... */}
                       {perfil.plan !== "full" && perfil.plan !== "pro" && (
                        <div className="space-y-3 mt-4">
                          <Button size="default" className="w-full text-base font-semibold" onClick={() => window.open("https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849764e81a01976585767f0040", "_blank")}>Mejorar a PRO</Button>
                          <Button size="default" variant="secondary" className="w-full text-base font-semibold" onClick={() => window.open("https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849763daeb0197658791ee00b1", "_blank")}>Mejorar a FULL</Button>
                        </div>
                      )}
                      {/* ... (Mensaje Plan Activo y Texto "Una vez realizado el pago" con text-sm) ... */}
                       {(perfil.plan === "pro" || perfil.plan === "full") && (
                        <div className="text-primary bg-primary/10 rounded-lg p-3 font-medium text-sm mt-3"> {/* text-sm */}
                          ¡Tu plan está activo! <br />
                          <span className="text-muted-foreground">La renovación es mensual. Si vence el pago, verás los links aquí para renovarlo.</span>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground mt-2"> {/* text-sm */}
                        El pago actualiza tu cuenta automáticamente. Si no ves el cambio en minutos, contacta a soporte.
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Versión desktop (Plan y Uso) - se mantiene similar pero con tamaños actualizados */}
            <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm hidden md:block">
              <CardHeader><CardTitle className="text-xl font-semibold text-primary">Plan y Uso</CardTitle></CardHeader> {/* text-xl */}
              <CardContent className="space-y-4 text-base"> {/* space-y-4, text-base */}
                 <div className="text-muted-foreground flex items-center gap-2">
                    <span>Plan actual:</span>
                    <Badge variant="secondary" className="bg-primary text-primary-foreground capitalize text-sm px-2.5 py-0.5">{perfil?.plan || "N/A"}</Badge> {/* text-sm */}
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Consultas usadas este mes:</p>
                    <div className="flex items-center gap-2.5">
                      <Progress value={porcentaje} className="h-3.5 bg-muted [&>div]:bg-primary" /> {/* h-3.5 */}
                      <span className="text-sm text-muted-foreground min-w-[75px] text-right">{perfil?.preguntas_usadas} / {limitePlan === Infinity ? '∞' : limitePlan}</span> {/* text-sm */}
                    </div>
                  </div>
                  {perfil.plan !== "full" && perfil.plan !== "pro" && (
                    <div className="space-y-3 mt-4"> {/* space-y-3, mt-4 */}
                      <Button size="default" className="w-full text-base font-semibold" onClick={() => window.open("https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849764e81a01976585767f0040", "_blank")}>Mejorar a PRO ($35.000/mes)</Button> {/* text-base */}
                      <Button size="default" variant="secondary" className="w-full text-base font-semibold" onClick={() => window.open("https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849763daeb0197658791ee00b1", "_blank")}>Mejorar a FULL ($60.000/mes)</Button> {/* text-base, variant secondary */}
                    </div>
                  )}
                  {(perfil.plan === "pro" || perfil.plan === "full") && ( /* text-sm */
                    <div className="text-primary bg-primary/10 rounded-lg p-3 font-medium text-sm mt-3">
                      ¡Tu plan está activo! <br />
                      <span className="text-muted-foreground">La renovación es mensual. Si vence el pago, verás los links aquí para renovarlo.</span>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground mt-2"> {/* text-sm */}
                    El pago actualiza tu cuenta automáticamente. Si no ves el cambio en minutos, contacta a soporte.
                  </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm flex-grow flex flex-col">
              <CardHeader><CardTitle className="text-xl font-semibold text-primary">{esMunicipio ? "Catálogo de Trámites" : "Catálogo de Productos"}</CardTitle></CardHeader> {/* text-xl */}
              <CardContent className="space-y-5 flex-grow flex flex-col"> {/* space-y-5 */}
                <div>
                  <ShadcnLabel htmlFor="catalogoFile" className="text-base font-medium text-muted-foreground mb-1.5 block">Subir nuevo o actualizar (PDF, Excel, CSV)</ShadcnLabel> {/* text-base */}
                  <Input id="catalogoFile" type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleArchivoChange} className="text-base file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer h-12" /> {/* text-base, file:text-sm, h-12 */}
                  <p className="text-sm text-muted-foreground mt-2">Tip: Para mayor precisión, usá Excel/CSV con columnas claras (ej: Nombre, Precio, Descripción).</p> {/* text-sm */}
                </div>
                <div className="flex-grow"></div>
                <Button onClick={handleSubirArchivo} size="lg" className="w-full text-lg font-semibold mt-auto" disabled={loadingCatalogo || !archivo}> {/* size="lg", text-lg */}
                  <UploadCloud className="w-6 h-6 mr-2.5" /> {loadingCatalogo ? "Procesando..." : "Subir y Procesar"} {/* Icono w-6 h-6 */}
                </Button>
                {resultadoCatalogo && ( /* text-base, iconos h-6 w-6 */
                  <div className={`text-base p-3.5 rounded-lg flex items-center gap-2.5 ${resultadoCatalogo.type === "error" ? "bg-destructive text-destructive-foreground border border-destructive/30" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700"}`}>
                    {resultadoCatalogo.type === "error" ? <XCircle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />} {resultadoCatalogo.message}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 items-stretch">
          {(perfil.direccion || (perfil.latitud !== null && perfil.longitud !== null)) ? (
            <div className="md:col-span-2">
              <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm h-full">
                <CardHeader><CardTitle className="text-xl font-semibold text-primary">Ubicación en el Mapa</CardTitle></CardHeader> {/* text-xl */}
                <CardContent>
                  <LocationMap lat={perfil.latitud ?? undefined} lng={perfil.longitud ?? undefined} onMove={(la, ln) => setPerfil(prev => ({ ...prev, latitud: la, longitud: ln }))} />
                </CardContent>
              </Card>
            </div>
          ) : (<div className="md:col-span-2 hidden md:block"></div>)} {/* Placeholder para mantener layout si no hay mapa */}

          <div className={`${(perfil.direccion || (perfil.latitud !== null && perfil.longitud !== null)) ? 'md:col-span-1' : 'md:col-span-3'} flex flex-col`}> {/* Ocupa todo el ancho si no hay mapa en desktop */}
            <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm h-full flex flex-col">
              <CardHeader><CardTitle className="text-xl font-semibold text-primary">Integrá Chatboc a tu web</CardTitle></CardHeader> {/* text-xl */}
              <CardContent className="space-y-4 flex-grow flex flex-col"> {/* space-y-4 */}
                {perfil.plan === "pro" || perfil.plan === "full" ? (
                  <Button size="lg" className="w-full text-lg font-semibold" onClick={() => navigate("/integracion")}>Ir a la guía de integración</Button> /* size="lg", text-lg */
                ) : (
                  <Button size="lg" className="w-full text-lg font-semibold bg-muted text-muted-foreground cursor-not-allowed" disabled title="Solo para clientes con Plan PRO o FULL" style={{ pointerEvents: "auto" }}>Plan PRO requerido</Button> /* Estilo de deshabilitado mejorado */
                )}
                <div className="flex-grow flex items-center justify-center p-4 min-h-[150px] sm:min-h-[200px]">
                  <MiniChatWidgetPreview />
                </div>
                <div className="text-sm text-muted-foreground mt-auto pt-2"> {/* text-sm */}
                  Accedé a los códigos e instrucciones para pegar el widget de Chatboc en tu web solo si tu plan es PRO o superior.
                  <br />Cualquier duda, escribinos a <a href="mailto:info@chatboc.ar" className="underline text-primary hover:text-primary/80">Info@chatboc.ar</a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}