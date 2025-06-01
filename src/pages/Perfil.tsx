// Perfil.tsx (Con console.logs para depuración)
import React, { useEffect, useState, useCallback, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, UploadCloud, CheckCircle, XCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import GooglePlacesAutocomplete from "react-google-autocomplete";

// Constantes
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.chatboc.ar";
const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY; // Cargarla una vez

const RUBRO_AVATAR: { [key: string]: string } = {
  bodega: "🍷", restaurante: "🍽️", almacen: "🛒", ecommerce: "🛍️", medico: "🩺", default: "🏢",
};
const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"
];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

interface HorarioUI { abre: string; cierra: string; cerrado: boolean; }
interface PerfilState {
  nombre_empresa: string; telefono: string; direccion: string; ciudad: string;
  provincia: string; pais: string; latitud: number | null; longitud: number | null;
  link_web: string; plan: string; preguntas_usadas: number; limite_preguntas: number;
  rubro: string; horarios_ui: HorarioUI[]; logo_url: string;
}
interface HorarioBackend { dia: string; abre: string; cierra: string; cerrado: boolean; }

export default function Perfil() {
  const [perfil, setPerfil] = useState<PerfilState>({
    nombre_empresa: "", telefono: "", direccion: "", ciudad: "", provincia: "",
    pais: "Argentina", latitud: null, longitud: null, link_web: "", plan: "gratis",
    preguntas_usadas: 0, limite_preguntas: 50, rubro: "",
    horarios_ui: DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx === 5 || idx === 6 })),
    logo_url: "",
  });
  const [modoHorario, setModoHorario] = useState<"comercial" | "personalizado">("comercial");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultadoCatalogo, setResultadoCatalogo] = useState<{ message: string, type: "success" | "error" } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);

  // --- PARA DEBUG DE GOOGLE MAPS API KEY ---
  useEffect(() => {
    console.log("DEBUG: VITE_Maps_API_KEY (valor crudo):", import.meta.env.VITE_Maps_API_KEY);
    if (!Maps_API_KEY) {
      console.error("ERROR CRÍTICO: VITE_Maps_API_KEY no está definida en las variables de entorno del frontend. El autocompletado de Google Maps NO funcionará.");
      setError("Error de configuración: Falta la clave para Google Maps. Contacta a soporte.");
    }
  }, []);
  // --- FIN DEBUG ---

  const fetchPerfil = useCallback(async (token: string) => {
    // ... (tu función fetchPerfil se mantiene igual que la versión mejorada anterior)
    setLoadingGuardar(true); setError(null); setMensaje(null);
    try {
      const res = await fetch(`${API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data?.error) {
        const errorMessage = data?.error || "Error al cargar el perfil.";
        setError(errorMessage);
        if (["Token inválido o sesión expirada", "Token faltante"].includes(data?.error)) {
          localStorage.removeItem("user"); window.location.href = "/login";
        } return;
      }
      let horariosUi = DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx === 5 || idx === 6 }));
      if (data.horario_json && Array.isArray(data.horario_json) && data.horario_json.length === DIAS.length) {
         horariosUi = data.horario_json.map((h: any, idx: number) => ({
            dia: DIAS[idx], abre: h.abre || "09:00", cierra: h.cierra || "20:00",
            cerrado: typeof h.cerrado === "boolean" ? h.cerrado : (idx === 5 || idx === 6)
        }));
      } else if (data.horario_json) {
        console.warn("Formato de horario_json recibido del backend no es el esperado:", data.horario_json);
      }
      setPerfil(prev => ({
        ...prev, nombre_empresa: data.nombre_empresa || "", telefono: data.telefono || "",
        direccion: data.direccion || "", ciudad: data.ciudad || "", provincia: data.provincia || "",
        pais: data.pais || "Argentina", latitud: data.latitud || null, longitud: data.longitud || null,
        link_web: data.link_web || "", plan: data.plan || "gratis",
        preguntas_usadas: data.preguntas_usadas ?? 0, limite_preguntas: data.limite_preguntas ?? 50,
        rubro: data.rubro?.toLowerCase() || "", logo_url: data.logo_url || "", horarios_ui: horariosUi,
      }));
    } catch (err) { console.error("Error en fetchPerfil:", err); setError("No se pudo conectar con el servidor para cargar el perfil.");
    } finally { setLoadingGuardar(false); }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = storedUser ? JSON.parse(storedUser).token : null;
    if (!token) { window.location.href = "/login"; return; }
    fetchPerfil(token);
  }, [fetchPerfil]);

  const handlePlaceSelected = (place: any) => {
    console.log("DEBUG: Google Place Selected (raw object):", place); // <--- DEBUG
    if (!place || !place.address_components || !place.geometry) {
        console.warn("DEBUG: handlePlaceSelected fue llamado pero el objeto 'place' es inválido o incompleto.");
        setError("Hubo un problema al seleccionar la dirección. Intenta de nuevo o ingrésala manualmente.");
        return;
    }

    const getAddressComponent = (type: string): string =>
      place.address_components?.find((c: any) => c.types.includes(type))?.long_name || "";
    
    const nuevaDireccion = place.formatted_address || "";
    const nuevaCiudad = getAddressComponent("locality") || getAddressComponent("administrative_area_level_2") || "";
    const nuevaProvincia = getAddressComponent("administrative_area_level_1") || "";
    const nuevoPais = getAddressComponent("country") || "";
    const nuevaLatitud = place.geometry?.location?.lat() || null;
    const nuevaLongitud = place.geometry?.location?.lng() || null;

    console.log("DEBUG: Dirección formateada:", nuevaDireccion);
    console.log("DEBUG: Ciudad extraída:", nuevaCiudad);
    console.log("DEBUG: Provincia extraída:", nuevaProvincia);

    setPerfil((prev) => ({
      ...prev,
      direccion: nuevaDireccion,
      ciudad: nuevaCiudad || prev.ciudad, // Mantener anterior si el nuevo es vacío
      provincia: nuevaProvincia || prev.provincia,
      pais: nuevoPais || prev.pais,
      latitud: nuevaLatitud, // Puede ser null
      longitud: nuevaLongitud, // Puede ser null
    }));
    setError(null); // Limpiar errores si se seleccionó algo
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    // Si el campo 'direccion' se edita manualmente después de usar Google Autocomplete,
    // podríamos querer limpiar latitud/longitud, o manejarlo de otra forma.
    // Por ahora, permitimos edición manual directa.
    // if (id === "direccion") {
    //   console.log("DEBUG: Dirección editada manualmente:", value);
    // }
    setPerfil(prev => ({ ...prev, [id]: value }));
  };

  // ... (tus funciones handleHorarioChange, setHorarioComercial, setHorarioPersonalizado se mantienen igual que la versión mejorada anterior)
  const handleHorarioChange = (index: number, field: keyof HorarioUI, value: string | boolean) => {
    const nuevosHorarios = perfil.horarios_ui.map((h, idx) => 
      idx === index ? { ...h, [field]: value } : h
    );
    setPerfil(prev => ({ ...prev, horarios_ui: nuevosHorarios }));
  };
  const setHorarioComercial = () => {
    setModoHorario("comercial");
    setPerfil(prev => ({ ...prev, horarios_ui: DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx === 5 || idx === 6 })), }));
    setHorariosOpen(false);
  };
  const setHorarioPersonalizado = () => { setModoHorario("personalizado"); setHorariosOpen(true); };


  const handleGuardar = async (e: FormEvent) => {
    e.preventDefault();
    console.log("DEBUG: Intentando guardar perfil. Estado actual de 'direccion':", perfil.direccion); // <--- DEBUG
    setMensaje(null); setError(null); setLoadingGuardar(true);

    const storedUser = localStorage.getItem("user");
    const token = storedUser ? JSON.parse(storedUser).token : null;
    if (!token) {
      setError("No se encontró sesión activa. Por favor, vuelve a iniciar sesión.");
      setLoadingGuardar(false); return;
    }

    const horariosParaBackend: HorarioBackend[] = perfil.horarios_ui.map((h, idx) => ({
        dia: DIAS[idx], abre: h.cerrado ? "" : h.abre, cierra: h.cerrado ? "" : h.cierra, cerrado: h.cerrado,
    }));

    const payload = {
      nombre_empresa: perfil.nombre_empresa, telefono: perfil.telefono,
      direccion: perfil.direccion, // Se envía el valor del estado
      ciudad: perfil.ciudad, provincia: perfil.provincia, pais: perfil.pais,
      latitud: perfil.latitud, longitud: perfil.longitud, link_web: perfil.link_web,
      logo_url: perfil.logo_url, horario_json: JSON.stringify(horariosParaBackend),
    };
    console.log("DEBUG: Payload a enviar a /perfil:", payload); // <--- DEBUG

    try {
      const res = await fetch(`${API_BASE_URL}/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { throw new Error(data.error || `Error ${res.status} al guardar cambios.`); }
      setMensaje(data.mensaje || "Cambios guardados correctamente ✔️");
      // fetchPerfil(token); // Opcional: Recargar perfil para ver datos tal como los tiene el backend
    } catch (err: any) { console.error("Error en handleGuardar:", err); setError(err.message || "Error al guardar el perfil. Intenta de nuevo.");
    } finally { setLoadingGuardar(false); }
  };

  // ... (tus funciones handleArchivoChange y handleSubirArchivo se mantienen igual que la versión mejorada anterior)
  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) { setArchivo(e.target.files[0]); } else { setArchivo(null); }
    setResultadoCatalogo(null); 
  };
  const handleSubirArchivo = async () => {
    if (!archivo) { setResultadoCatalogo({ message: "Seleccioná un archivo válido.", type: "error" }); return; }
    const storedUser = localStorage.getItem("user");
    const token = storedUser ? JSON.parse(storedUser).token : null;
    if (!token) { setResultadoCatalogo({ message: "❌ Sesión no válida para subir catálogo.", type: "error" }); return; }
    setLoadingCatalogo(true); setResultadoCatalogo(null);
    try {
      const formData = new FormData(); formData.append("file", archivo);
      const res = await fetch(`${API_BASE_URL}/subir_catalogo`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const data = await res.json();
      setResultadoCatalogo({ 
        message: res.ok ? data.mensaje : `❌ ${data.error || "Error desconocido al procesar el archivo."}`,
        type: res.ok ? "success" : "error"
      });
    } catch (err) { console.error("Error en handleSubirArchivo:", err); setResultadoCatalogo({ message: "❌ Error de conexión al subir el catálogo.", type: "error" });
    } finally { setLoadingCatalogo(false); }
  };

  const porcentaje = perfil.limite_preguntas > 0 ? Math.min((perfil.preguntas_usadas / perfil.limite_preguntas) * 100, 100) : 0;
  const avatarEmoji = RUBRO_AVATAR[perfil.rubro] || RUBRO_AVATAR.default;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-slate-950 to-slate-900 text-slate-200 py-8 px-2 sm:px-4 md:px-6 lg:px-8">
      {/* Header (sin cambios respecto a la versión mejorada) */}
      <div className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 px-2">
        {/* ... Avatar y Nombre Empresa ... */}
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/20 shadow-lg border-2 border-blue-400">
            <AvatarFallback className="bg-transparent"><span className="text-3xl sm:text-4xl">{avatarEmoji}</span></AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-blue-400 leading-tight mb-0.5 text-center sm:text-left">
              {perfil.nombre_empresa || "Panel de Empresa"}
            </h1>
            <span className="text-slate-400 text-sm sm:text-base font-medium capitalize block text-center sm:text-left">
              {perfil.rubro || "Rubro no especificado"}
            </span>
          </div>
        </div>
        <Button variant="outline" /* ... (botón salir) ... */ 
           className="h-10 px-5 text-sm border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 self-center sm:self-auto"
           onClick={() => { localStorage.clear(); window.location.href = "/login";}}>
             <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
      </div>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 px-2">
        <div className="md:col-span-2 flex flex-col gap-6 md:gap-8">
          <Card className="bg-slate-900/70 shadow-xl rounded-xl border border-slate-800 backdrop-blur-sm">
            <CardHeader><CardTitle className="text-xl font-semibold text-blue-400">Datos de tu Empresa</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleGuardar} className="space-y-6">
                {/* ... Campos Nombre Empresa, Teléfono, Link Web ... */}
                <div>
                  <Label htmlFor="nombre_empresa" className="text-slate-300 text-sm mb-1 block">Nombre de la empresa*</Label>
                  <Input id="nombre_empresa" value={perfil.nombre_empresa} onChange={handleInputChange} required className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono" className="text-slate-300 text-sm mb-1 block">Teléfono* (con cód. país y área)</Label>
                    <Input id="telefono" placeholder="+5492611234567" value={perfil.telefono} onChange={handleInputChange} required className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                  </div>
                  <div>
                    <Label htmlFor="link_web" className="text-slate-300 text-sm mb-1 block">Sitio Web / Tienda Online*</Label>
                    <Input id="link_web" type="url" placeholder="https://ejemplo.com" value={perfil.link_web} onChange={handleInputChange} required className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                  </div>
                </div>
                
                {/* --- CAMPO DIRECCIÓN CON GOOGLE AUTOCOMPLETE --- */}
                <div>
                  <Label htmlFor="google-places-input" className="text-slate-300 text-sm mb-1 block">Dirección Completa*</Label>
                  {Maps_API_KEY ? ( // Renderizar solo si la clave API está presente
                    <GooglePlacesAutocomplete
                      apiKey={Maps_API_KEY}
                      onPlaceSelected={handlePlaceSelected}
                      options={{
                        componentRestrictions: { country: "ar" },
                        types: ['address'],
                        fields: ["address_components", "formatted_address", "geometry.location"] // Pedir solo los campos necesarios
                      }}
                      defaultValue={perfil.direccion} // Para mostrar valor existente
                      inputClassName="w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-10"
                      // Puedes añadir un 'placeholder' si defaultValue puede estar vacío inicialmente
                      placeholder="Ej: Av. San Martín 123, Mendoza"
                      // Considera un onChange para actualizar perfil.direccion si el usuario escribe manualmente
                      // y NO selecciona un lugar. Pero esto puede ser complejo si quieres mantener lat/lng.
                      // Por ahora, confiamos en onPlaceSelected.
                    />
                  ) : (
                    <Input 
                      id="direccion" 
                      value={perfil.direccion} 
                      onChange={handleInputChange} 
                      placeholder="Clave de Google Maps no configurada. Ingrese dirección manualmente."
                      className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder-red-400"
                      required 
                    />
                  )}
                   {/* Input oculto o de solo lectura para mostrar el valor de perfil.direccion (para debug) */}
                   {/* <Input readOnly value={`Estado dirección: ${perfil.direccion}`} className="mt-1 text-xs text-slate-500" /> */}
                </div>
                {/* --- FIN CAMPO DIRECCIÓN --- */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ciudad" className="text-slate-300 text-sm mb-1 block">Ciudad</Label>
                    <Input id="ciudad" value={perfil.ciudad} onChange={handleInputChange} className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                  </div>
                  <div>
                    <Label htmlFor="provincia" className="text-slate-300 text-sm mb-1 block">Provincia*</Label>
                    <select id="provincia" value={perfil.provincia} onChange={handleInputChange} required
                      className="w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-10">
                      <option value="">Selecciona una provincia</option>
                      {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                
                {/* Sección Horarios (sin cambios respecto a la versión mejorada) */}
                <div>
                  <Label className="text-slate-300 text-sm block mb-2">Horarios de Atención</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button type="button" variant={modoHorario === "comercial" ? "secondary" : "outline"} size="sm" onClick={setHorarioComercial} className="border-slate-700 hover:bg-slate-700/50">Automático (Lun-Sáb 9-20)</Button>
                    <Button type="button" variant={modoHorario === "personalizado" ? "secondary" : "outline"} size="sm" onClick={setHorarioPersonalizado} className="border-slate-700 hover:bg-slate-700/50 flex items-center">
                      {modoHorario === "personalizado" && horariosOpen ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                      Personalizar
                    </Button>
                  </div>
                  {modoHorario === "comercial" && (<div className="text-xs text-green-400 p-3 bg-slate-800/40 rounded-md border border-slate-700"><Info className="w-3 h-3 inline mr-1"/> L-V: 09-20. Sáb y Dom: Cerrado.</div>)}
                  {modoHorario === "personalizado" && horariosOpen && (
                    <div className="border border-slate-700 rounded-lg p-4 mt-2 bg-slate-800/40 space-y-3">
                      {DIAS.map((dia, idx) => (
                        <div key={dia} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[100px_auto_1fr] items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-medium text-slate-300 col-span-3 sm:col-span-1">{dia}</span>
                          <div className="flex items-center gap-2 col-span-3 sm:col-span-1 sm:justify-self-end">
                            <Label htmlFor={`cerrado-${idx}`} className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer select-none">
                              <input type="checkbox" id={`cerrado-${idx}`} checked={perfil.horarios_ui[idx].cerrado} onChange={e => handleHorarioChange(idx, "cerrado", e.target.checked)}
                                className="form-checkbox h-4 w-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-400 cursor-pointer"/> Cerrado
                            </Label>
                          </div>
                          {!perfil.horarios_ui[idx].cerrado && (
                            <div className="flex items-center gap-1 col-span-3 sm:col-span-1 sm:justify-self-start">
                              <Input type="time" value={perfil.horarios_ui[idx].abre} className="w-full sm:w-28 bg-slate-700/50 border-slate-600 text-slate-200 h-9 text-xs" onChange={e => handleHorarioChange(idx, "abre", e.target.value)} />
                              <span className="text-slate-400 mx-1">-</span>
                              <Input type="time" value={perfil.horarios_ui[idx].cierra} className="w-full sm:w-28 bg-slate-700/50 border-slate-600 text-slate-200 h-9 text-xs" onChange={e => handleHorarioChange(idx, "cierra", e.target.value)} />
                            </div>
                          )}
                          {perfil.horarios_ui[idx].cerrado && <div className="hidden sm:block sm:col-span-1"></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Fin Sección Horarios */}

                <Button disabled={loadingGuardar} type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-base">
                  {loadingGuardar ? "Guardando Cambios..." : "Guardar Cambios"}
                </Button>
                {mensaje && <div className="mt-3 text-sm text-green-400 bg-green-500/10 p-3 rounded-md flex items-center gap-2"><CheckCircle className="w-4 h-4"/> {mensaje}</div>}
                {error && <div className="mt-3 text-sm text-red-400 bg-red-500/10 p-3 rounded-md flex items-center gap-2"><XCircle className="w-4 h-4"/> {error}</div>}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha (Plan y Catálogo - sin cambios respecto a la versión mejorada) */}
        <div className="flex flex-col gap-6 md:gap-8">
            {/* ... Card Plan y Uso ... */}
            <Card className="bg-slate-900/70 shadow-xl rounded-xl border border-slate-800 backdrop-blur-sm">
              <CardHeader><CardTitle className="text-lg font-semibold text-blue-400">Plan y Uso</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-300">Plan actual: <Badge variant="secondary" className="bg-blue-500/80 text-white capitalize">{perfil.plan || "N/A"}</Badge></p>
                <div>
                  <p className="text-sm text-slate-300 mb-1">Consultas usadas este mes:</p>
                  <div className="flex items-center gap-2">
                    <Progress value={porcentaje} className="h-3 bg-slate-700 [&>div]:bg-blue-500" aria-label={`${porcentaje.toFixed(0)}% de consultas usadas`} />
                    <span className="text-xs text-slate-400 min-w-[70px] text-right">{perfil.preguntas_usadas} / {perfil.limite_preguntas}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* ... Card Catálogo ... */}
            <Card className="bg-slate-900/70 shadow-xl rounded-xl border border-slate-800 backdrop-blur-sm">
              <CardHeader><CardTitle className="text-lg font-semibold text-blue-400">Tu Catálogo de Productos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="catalogoFile" className="text-sm text-slate-300 mb-1 block">Subir nuevo o actualizar (PDF, Excel, CSV)</Label>
                  <Input id="catalogoFile" type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleArchivoChange} className="text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"/>
                  <p className="text-xs text-slate-500 mt-1.5">Tip: Para mayor precisión, usá Excel/CSV con columnas claras (ej: Nombre, Precio, Descripción).</p>
                </div>
                <Button onClick={handleSubirArchivo} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5" disabled={loadingCatalogo || !archivo}>
                  <UploadCloud className="w-4 h-4 mr-2" /> {loadingCatalogo ? "Procesando Catálogo..." : "Subir y Procesar Catálogo"}
                </Button>
                {resultadoCatalogo && ( <div className={`text-sm p-3 rounded-md flex items-center gap-2 ${resultadoCatalogo.type === "error" ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                    {resultadoCatalogo.type === "error" ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>} {resultadoCatalogo.message}
                </div>)}
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}