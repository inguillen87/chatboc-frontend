// Perfil.tsx COMPLETO (copiá y pegá tal cual, listo para producción)
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import GooglePlacesAutocomplete from "react-google-autocomplete";

const RUBRO_AVATAR = {
  bodega: "🍷",
  restaurante: "🍽️",
  almacen: "🛒",
  ecommerce: "🛍️",
  medico: "🩺",
  default: "🏢",
};

const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"
];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function Perfil() {
  const [perfil, setPerfil] = useState({
    nombre_empresa: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    pais: "",
    latitud: null,
    longitud: null,
    link_web: "",
    plan: "gratis",
    preguntas_usadas: 0,
    limite_preguntas: 50,
    rubro: "",
    horarios_ui: DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx === 6 })),
    logo_url: "",
  });
  const [modoHorario, setModoHorario] = useState("comercial");
  const [archivo, setArchivo] = useState(null);
  const [resultadoCatalogo, setResultadoCatalogo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loadingGuardar, setLoadingGuardar] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);

  // --- CARGA INICIAL DEL PERFIL
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = storedUser ? JSON.parse(storedUser).token : null;
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoadingGuardar(true);
    fetch("https://api.chatboc.ar/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data?.error) {
          setError(data.error);
          if (["Token inválido", "Token faltante"].includes(data.error)) {
            localStorage.removeItem("user");
            window.location.href = "/login";
          }
          return;
        }
        // Manejar horarios (stringify o array según backend)
        let horariosUi = DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx === 6 }));
        if (data.horario_json && typeof data.horario_json === "string" && data.horario_json.trim() !== "" && data.horario_json.trim() !== "[]") {
          try {
            const loadedHorarios = JSON.parse(data.horario_json);
            if (Array.isArray(loadedHorarios) && loadedHorarios.length === DIAS.length) {
              horariosUi = loadedHorarios.map((h, idx) => ({
                abre: h.abre || "09:00",
                cierra: h.cierra || "20:00",
                cerrado: typeof h.cerrado === "boolean" ? h.cerrado : idx === 6
              }));
            }
          } catch {}
        }
        setPerfil(prev => ({
          ...prev,
          nombre_empresa: data.nombre_empresa || "",
          telefono: data.telefono || "",
          direccion: data.direccion || "",
          ciudad: data.ciudad || "",
          provincia: data.provincia || data.ubicacion || "",
          pais: data.pais || "",
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
      })
      .catch(() => setError("Error al cargar el perfil."))
      .finally(() => setLoadingGuardar(false));
  }, []);

  // --- GOOGLE MAPS AUTOCOMPLETE
  const handlePlaceSelected = (place) => {
    const getAddressComponent = (type) =>
      place.address_components?.find((c) => c.types.includes(type))?.long_name || "";
    setPerfil((prev) => ({
      ...prev,
      direccion: place.formatted_address || "",
      ciudad: getAddressComponent("locality") || getAddressComponent("administrative_area_level_2"),
      provincia: getAddressComponent("administrative_area_level_1"),
      pais: getAddressComponent("country"),
      latitud: place.geometry?.location?.lat() || null,
      longitud: place.geometry?.location?.lng() || null,
    }));
  };

  // --- HORARIOS
  const handleHorarioChange = (index, field, value) => {
    const nuevosHorarios = [...perfil.horarios_ui];
    nuevosHorarios[index][field] = value;
    setPerfil(prev => ({ ...prev, horarios_ui: nuevosHorarios }));
  };
  const setHorarioComercial = () => {
    setModoHorario("comercial");
    setPerfil(prev => ({
      ...prev,
      horarios_ui: DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx === 6 })),
    }));
    setHorariosOpen(false);
  };
  const setHorarioPersonalizado = () => {
    setModoHorario("personalizado");
    setHorariosOpen((prev) => !prev);
  };

  // --- GUARDAR PERFIL
  const handleGuardar = async (e) => {
    e.preventDefault();
    setMensaje(""); setError(""); setLoadingGuardar(true);
    const storedUser = localStorage.getItem("user");
    const token = storedUser ? JSON.parse(storedUser).token : null;
    if (!token) {
      setError("No se encontró sesión activa.");
      setLoadingGuardar(false);
      return;
    }
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
      horario_json: JSON.stringify(perfil.horarios_ui),
    };
    try {
      const res = await fetch("https://api.chatboc.ar/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar cambios.");
      setMensaje(data.mensaje || "Cambios guardados correctamente ✔️");
    } catch (err) {
      setError(err.message || "Error al guardar el perfil. Intenta de nuevo.");
    }
    setLoadingGuardar(false);
  };

  // --- CARGA DE CATÁLOGO
  const handleArchivoChange = (e) => {
    if (e.target.files && e.target.files[0]) setArchivo(e.target.files[0]);
    else setArchivo(null);
    setResultadoCatalogo("");
  };
  const handleSubirArchivo = async () => {
    if (!archivo) return setResultadoCatalogo("Seleccioná un archivo válido.");
    const storedUser = localStorage.getItem("user");
    const token = storedUser ? JSON.parse(storedUser).token : null;
    if (!token) return setResultadoCatalogo("❌ Sesión no válida para subir catálogo.");
    setLoadingCatalogo(true);
    try {
      const formData = new FormData();
      formData.append("file", archivo);
      const res = await fetch("https://api.chatboc.ar/subir_catalogo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      setResultadoCatalogo(res.ok ? data.mensaje : `❌ ${data.error || "Error desconocido"}`);
    } catch {
      setResultadoCatalogo("❌ Error de conexión al subir el catálogo.");
    }
    setLoadingCatalogo(false);
  };

  const porcentaje = perfil.limite_preguntas > 0
    ? Math.min((perfil.preguntas_usadas / perfil.limite_preguntas) * 100, 100)
    : 0;
  const avatarEmoji = RUBRO_AVATAR[perfil.rubro] || RUBRO_AVATAR.default;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-slate-950 to-slate-900 text-slate-200 py-8 px-2 sm:px-0">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between mb-8 gap-3 px-2">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 bg-blue-500/20 shadow-lg border-2 border-blue-400">
            <AvatarFallback className="bg-transparent">
              <span className="text-3xl">{avatarEmoji}</span>
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-blue-400 leading-tight mb-0.5">
              {perfil.nombre_empresa || "Panel de Empresa"}
            </h1>
            <span className="text-slate-400 text-sm sm:text-base font-medium capitalize">
              {perfil.rubro || "Rubro no especificado"}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          className="h-10 px-5 text-sm border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => {
            localStorage.removeItem("user");
            localStorage.removeItem("anon_token");
            localStorage.removeItem("rubroSeleccionado");
            window.location.href = "/login";
          }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
      </div>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 px-2">
        {/* Columna Izquierda: Formulario */}
        <div className="md:col-span-2 flex flex-col gap-6 md:gap-8">
          <Card className="bg-slate-900/70 shadow-xl rounded-xl border border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-blue-400">Datos de tu Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGuardar} className="space-y-4">
                <div>
                  <Label htmlFor="nombre_empresa" className="text-slate-300 text-sm">Nombre de la empresa*</Label>
                  <Input id="nombre_empresa" value={perfil.nombre_empresa} onChange={e => setPerfil({ ...perfil, nombre_empresa: e.target.value })} required className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono" className="text-slate-300 text-sm">Teléfono* (con cód. país y área)</Label>
                    <Input id="telefono" placeholder="+5492611234567" value={perfil.telefono} onChange={e => setPerfil({ ...perfil, telefono: e.target.value })} required className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                  </div>
                  <div>
                    <Label htmlFor="link_web" className="text-slate-300 text-sm">Sitio Web / Tienda Online*</Label>
                    <Input id="link_web" placeholder="https://ejemplo.com" value={perfil.link_web} onChange={e => setPerfil({ ...perfil, link_web: e.target.value })} required className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                  </div>
                </div>
                <div>
                  <Label htmlFor="direccion" className="text-slate-300 text-sm">Dirección Completa* (calle, número, localidad)</Label>
                  <GooglePlacesAutocomplete
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    onPlaceSelected={handlePlaceSelected}
                    options={{ componentRestrictions: { country: "ar" }, types: ['address'] }}
                    defaultValue={perfil.direccion}
                    inputClassName="w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ciudad" className="text-slate-300 text-sm">Ciudad</Label>
                    <Input id="ciudad" value={perfil.ciudad} onChange={e => setPerfil({ ...perfil, ciudad: e.target.value })} className="bg-slate-800/50 border-slate-700 text-slate-100"/>
                  </div>
                  <div>
                    <Label htmlFor="provincia" className="text-slate-300 text-sm">Provincia*</Label>
                    <select id="provincia" value={perfil.provincia} onChange={e => setPerfil({ ...perfil, provincia: e.target.value })} required
                      className="w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-10">
                      <option value="">Selecciona una provincia</option>
                      {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 text-sm block mb-1">Horarios de Atención</Label>
                  <div className="flex gap-2 mb-2">
                    <Button type="button" variant={modoHorario === "comercial" ? "secondary" : "outline"} size="sm" onClick={setHorarioComercial} className="border-slate-700 hover:bg-slate-700/50">Automático (Lun-Sáb 9-20)</Button>
                    <Button type="button" variant={modoHorario === "personalizado" ? "secondary" : "outline"} size="sm" onClick={setHorarioPersonalizado} className="border-slate-700 hover:bg-slate-700/50">
                      {horariosOpen && modoHorario === "personalizado" ? "Ocultar Personalizados" : "Personalizar Días/Horas"}
                    </Button>
                  </div>
                  {modoHorario === "comercial" && !horariosOpen && (
                    <div className="text-xs text-green-400 p-2 bg-slate-800/30 rounded-md">
                      Lunes a Sábado: 09:00 a 20:00. Domingo: Cerrado. (Para cambiar, elegí "Personalizar").
                    </div>
                  )}
                  {horariosOpen && modoHorario === "personalizado" && (
                    <div className="border border-slate-700 rounded-lg p-3 mt-1 bg-slate-800/30 space-y-2">
                      {DIAS.map((dia, idx) => (
                        <div key={dia} className="flex items-center justify-between gap-2 text-sm">
                          <span className="w-20 text-slate-300">{dia}</span>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`cerrado-${idx}`} className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" id={`cerrado-${idx}`} checked={perfil.horarios_ui[idx].cerrado}
                                onChange={e => handleHorarioChange(idx, "cerrado", e.target.checked)}
                                className="form-checkbox h-4 w-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-400"
                              /> Cerrado
                            </Label>
                          </div>
                          {!perfil.horarios_ui[idx].cerrado && (
                            <div className="flex items-center gap-1">
                              <Input type="time" value={perfil.horarios_ui[idx].abre} className="w-24 bg-slate-700/50 border-slate-600 text-slate-200 h-8" onChange={e => handleHorarioChange(idx, "abre", e.target.value)} />
                              <span className="text-slate-400">-</span>
                              <Input type="time" value={perfil.horarios_ui[idx].cierra} className="w-24 bg-slate-700/50 border-slate-600 text-slate-200 h-8" onChange={e => handleHorarioChange(idx, "cierra", e.target.value)} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button disabled={loadingGuardar} type="submit" className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white">
                  {loadingGuardar ? "Guardando..." : "Guardar Cambios"}
                </Button>
                {mensaje && <p className="mt-2 text-sm text-green-400 text-center">{mensaje}</p>}
                {error && <p className="mt-2 text-sm text-red-400 text-center">{error}</p>}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Plan y Catálogo */}
        <div className="flex flex-col gap-6 md:gap-8">
          <Card className="bg-slate-900/70 shadow-xl rounded-xl border border-slate-800 backdrop-blur-sm p-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-blue-400">Plan y Uso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-300">Plan actual: <Badge variant="secondary" className="bg-blue-500/80 text-white">{perfil.plan || "N/A"}</Badge></p>
              <p className="text-sm text-slate-300">Consultas usadas este mes:</p>
              <div className="flex items-center gap-2">
                <Progress value={porcentaje} className="h-3 bg-slate-700 [&>div]:bg-blue-500" />
                <span className="text-xs text-slate-400">{perfil.preguntas_usadas} / {perfil.limite_preguntas}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 shadow-xl rounded-xl border border-slate-800 backdrop-blur-sm p-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-blue-400">Tu Catálogo de Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="catalogoFile" className="text-sm text-slate-300">Subir nuevo o actualizar (PDF, Excel, CSV)</Label>
              <Input id="catalogoFile" type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleArchivoChange} className="text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-700"/>
              <p className="text-xs text-slate-500">
                Tip: Para mayor precisión, usá Excel/CSV con columnas claras (ej: Nombre, Precio, Descripción).
              </p>
              <Button onClick={handleSubirArchivo} className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={loadingCatalogo || !archivo}>
                <UploadCloud className="w-4 h-4 mr-2" /> {loadingCatalogo ? "Procesando..." : "Subir y Procesar Catálogo"}
              </Button>
              {resultadoCatalogo && (
                <p className={`text-xs text-center p-2 rounded-md ${resultadoCatalogo.startsWith("❌") ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{resultadoCatalogo}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
