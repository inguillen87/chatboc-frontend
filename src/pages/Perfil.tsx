// Contenido COMPLETO y FINAL para: Perfil.tsx

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
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.chatboc.ar";
const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY;
const RUBRO_AVATAR: { [key: string]: string } = { bodega: "🍷", restaurante: "🍽️", almacen: "🛒", ecommerce: "🛍️", medico: "🩺", default: "🏢" };
const PROVINCIAS = ["Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"];
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

interface HorarioUI { abre: string; cierra: string; cerrado: boolean; }
interface PerfilState { nombre_empresa: string; telefono: string; direccion: string; ciudad: string; provincia: string; pais: string; latitud: number | null; longitud: number | null; link_web: string; plan: string; preguntas_usadas: number; limite_preguntas: number; rubro: string; horarios_ui: HorarioUI[]; logo_url: string; }
interface HorarioBackend { dia: string; abre: string; cierra: string; cerrado: boolean; }

export default function Perfil() {
  const navigate = useNavigate(); 
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

  useEffect(() => {
    if (!Maps_API_KEY) {
      setError("Error: Falta la clave para Google Maps.");
    }
  }, []);

  const fetchPerfil = useCallback(async (token: string) => {
    setLoadingGuardar(true); setError(null); setMensaje(null);
    try {
      const res = await fetch(`${API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Tu sesión ha expirado.");
        localStorage.clear(); // Limpia 'user' y 'authToken'
        navigate("/login");
        return;
      }
      let horariosUi = DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx === 5 || idx === 6 }));
      if (data.horario_json && Array.isArray(data.horario_json)) {
         horariosUi = data.horario_json.map((h: any, idx: number) => ({
            dia: DIAS[idx], abre: h.abre || "09:00", cierra: h.cierra || "20:00",
            cerrado: typeof h.cerrado === "boolean" ? h.cerrado : (idx === 5 || idx === 6)
        }));
      }
      setPerfil(prev => ({
        ...prev, nombre_empresa: data.nombre_empresa || "", telefono: data.telefono || "",
        direccion: data.direccion || "", ciudad: data.ciudad || "", provincia: data.provincia || "",
        pais: data.pais || "Argentina", latitud: data.latitud || null, longitud: data.longitud || null,
        link_web: data.link_web || "", plan: data.plan || "gratis",
        preguntas_usadas: data.preguntas_usadas ?? 0, limite_preguntas: data.limite_preguntas ?? 50,
        rubro: data.rubro?.toLowerCase() || "", logo_url: data.logo_url || "", horarios_ui: horariosUi,
      }));
    } catch (err) {
      setError("No se pudo conectar con el servidor para cargar el perfil.");
    } finally {
      setLoadingGuardar(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) { 
      navigate("/login"); 
      return; 
    }
    fetchPerfil(token);
  }, [fetchPerfil, navigate]);

  const handlePlaceSelected = (place: any) => {
    if (!place?.address_components || !place?.geometry) { return; }
    const getAddressComponent = (type: string): string => place.address_components?.find((c: any) => c.types.includes(type))?.long_name || "";
    setPerfil((prev) => ({
      ...prev,
      direccion: place.formatted_address || "",
      ciudad: getAddressComponent("locality") || getAddressComponent("administrative_area_level_2") || "",
      provincia: getAddressComponent("administrative_area_level_1") || "",
      pais: getAddressComponent("country") || "",
      latitud: place.geometry?.location?.lat() || null,
      longitud: place.geometry?.location?.lng() || null,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPerfil(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };
  
  const handleHorarioChange = (index: number, field: keyof HorarioUI, value: string | boolean) => {
    const nuevosHorarios = [...perfil.horarios_ui];
    nuevosHorarios[index] = { ...nuevosHorarios[index], [field]: value };
    setPerfil(prev => ({ ...prev, horarios_ui: nuevosHorarios }));
  };

  const handleGuardar = async (e: FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("authToken");
    if (!token) { setError("Sesión no válida."); return; }
    setLoadingGuardar(true); setError(null); setMensaje(null);
    const horariosParaBackend: HorarioBackend[] = perfil.horarios_ui.map((h, idx) => ({ dia: DIAS[idx], abre: h.cerrado ? "" : h.abre, cierra: h.cerrado ? "" : h.cierra, cerrado: h.cerrado }));
    const payload = {
      nombre_empresa: perfil.nombre_empresa, telefono: perfil.telefono,
      direccion: perfil.direccion, ciudad: perfil.ciudad, provincia: perfil.provincia,
      pais: perfil.pais, latitud: perfil.latitud, longitud: perfil.longitud,
      link_web: perfil.link_web, logo_url: perfil.logo_url,
      horario_json: JSON.stringify(horariosParaBackend),
    };
    try {
      const res = await fetch(`${API_BASE_URL}/perfil`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar.");
      setMensaje("Cambios guardados correctamente ✔️");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingGuardar(false);
    }
  };
  
  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivo(e.target.files ? e.target.files[0] : null);
    setResultadoCatalogo(null);
  };

  const handleSubirArchivo = async () => {
    if (!archivo) return;
    const token = localStorage.getItem("authToken");
    if (!token) { setResultadoCatalogo({ message: "❌ Sesión no válida.", type: "error" }); return; }
    setLoadingCatalogo(true); setResultadoCatalogo(null);
    const formData = new FormData();
    formData.append("file", archivo);
    try {
      const res = await fetch(`${API_BASE_URL}/subir_catalogo`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      setResultadoCatalogo({ message: res.ok ? data.mensaje : `❌ ${data.error || "Error."}`, type: res.ok ? "success" : "error" });
    } catch (err) {
      setResultadoCatalogo({ message: "❌ Error de conexión.", type: "error" });
    } finally {
      setLoadingCatalogo(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const porcentaje = perfil.limite_preguntas > 0 ? Math.min((perfil.preguntas_usadas / perfil.limite_preguntas) * 100, 100) : 0;
  const avatarEmoji = RUBRO_AVATAR[perfil.rubro] || RUBRO_AVATAR.default;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-200 py-8 px-4">
      <div className="w-full max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20 bg-blue-500/20 border-2 border-blue-400">
              <AvatarFallback className="bg-transparent"><span className="text-4xl">{avatarEmoji}</span></AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-4xl font-extrabold text-blue-400">{perfil.nombre_empresa || "Panel"}</h1>
              <span className="text-base font-medium capitalize text-slate-400">{perfil.rubro || "Rubro"}</span>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="outline" className="border-yellow-400 text-yellow-400 hover:bg-yellow-500/10" onClick={() => navigate("/tickets")}>Ver Tickets</Button>
            <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" /> Salir</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <form onSubmit={handleGuardar} className="md:col-span-2 space-y-6">
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader><CardTitle className="text-xl text-blue-400">Datos de tu Empresa</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="nombre_empresa">Nombre de la empresa*</Label>
                  <Input id="nombre_empresa" value={perfil.nombre_empresa} onChange={handleInputChange} required />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono">Teléfono*</Label>
                    <Input id="telefono" placeholder="+5492611234567" value={perfil.telefono} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor="link_web">Sitio Web / Tienda Online*</Label>
                    <Input id="link_web" type="url" placeholder="https://ejemplo.com" value={perfil.link_web} onChange={handleInputChange} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="google-places-input">Dirección Completa*</Label>
                  {Maps_API_KEY ? (
                    <GooglePlacesAutocomplete apiKey={Maps_API_KEY} onPlaceSelected={handlePlaceSelected} options={{ componentRestrictions: { country: "ar" }, types: ['address'], fields: ["address_components", "formatted_address", "geometry.location"] }} defaultValue={perfil.direccion} inputClassName="w-full h-10 rounded-md border bg-transparent px-3 py-2" placeholder="Ej: Av. San Martín 123, Mendoza" />
                  ) : (
                    <Input id="direccion" value={perfil.direccion} onChange={handleInputChange} placeholder="Clave de Google Maps no configurada" required />
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                   <div><Label htmlFor="ciudad">Ciudad</Label><Input id="ciudad" value={perfil.ciudad} onChange={handleInputChange} /></div>
                   <div>
                       <Label htmlFor="provincia">Provincia*</Label>
                       <select id="provincia" value={perfil.provincia} onChange={handleInputChange} required className="w-full h-10 rounded-md border bg-transparent px-3 py-2"><option value="">Selecciona una provincia</option>{PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                   </div>
                </div>
                <div>
                  <Label className="block mb-2">Horarios de Atención</Label>
                  <div className="flex gap-2 mb-3">
                    <Button type="button" variant={modoHorario === "comercial" ? "secondary" : "outline"} size="sm" onClick={() => setModoHorario("comercial")}>Automático</Button>
                    <Button type="button" variant={modoHorario === "personalizado" ? "secondary" : "outline"} size="sm" onClick={() => setHorariosOpen(!horariosOpen)}>Personalizar <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${horariosOpen && 'rotate-180'}`} /></Button>
                  </div>
                  {horariosOpen && modoHorario === "personalizado" && (
                    <div className="border rounded-lg p-4 space-y-3">
                      {DIAS.map((dia, idx) => (
                        <div key={dia} className="grid grid-cols-[100px_auto_1fr] items-center gap-2 text-sm">
                           <span className="font-medium">{dia}</span>
                           <Label htmlFor={`cerrado-${idx}`} className="flex items-center gap-1 cursor-pointer"><input type="checkbox" id={`cerrado-${idx}`} checked={perfil.horarios_ui[idx].cerrado} onChange={e => handleHorarioChange(idx, "cerrado", e.target.checked)} /> Cerrado</Label>
                           {!perfil.horarios_ui[idx].cerrado && (<div className="flex items-center gap-1"><Input type="time" value={perfil.horarios_ui[idx].abre} onChange={e => handleHorarioChange(idx, "abre", e.target.value)} /><span className="mx-1">-</span><Input type="time" value={perfil.horarios_ui[idx].cierra} onChange={e => handleHorarioChange(idx, "cierra", e.target.value)} /></div>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button disabled={loadingGuardar} type="submit" className="w-full bg-blue-600 hover:bg-blue-700">{loadingGuardar ? "Guardando..." : "Guardar Cambios"}</Button>
                {mensaje && <div className="text-green-400 flex items-center gap-2"><CheckCircle />{mensaje}</div>}
                {error && <div className="text-red-400 flex items-center gap-2"><XCircle />{error}</div>}
              </CardContent>
            </Card>
          </form>

          <div className="space-y-6">
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader><CardTitle className="text-lg text-blue-400">Plan y Uso</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p>Plan actual: <Badge variant="secondary" className="capitalize bg-blue-500/80">{perfil.plan}</Badge></p>
                <div>
                  <p className="mb-1">Consultas usadas este mes:</p>
                  <div className="flex items-center gap-2">
                    <Progress value={porcentaje} />
                    <span className="text-xs text-slate-400">{perfil.preguntas_usadas}/{perfil.limite_preguntas}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/70 border-slate-800">
              <CardHeader><CardTitle className="text-lg text-blue-400">Tu Catálogo de Productos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="catalogoFile">Subir nuevo o actualizar (PDF, Excel)</Label>
                  <Input id="catalogoFile" type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleArchivoChange} />
                  <p className="text-xs text-slate-500 mt-1">Tip: Para mayor precisión, usá columnas claras (Nombre, Precio, etc).</p>
                </div>
                <Button onClick={handleSubirArchivo} className="w-full bg-green-600 hover:bg-green-700" disabled={loadingCatalogo || !archivo}><UploadCloud className="w-4 h-4 mr-2" />{loadingCatalogo ? "Procesando..." : "Subir Catálogo"}</Button>
                {resultadoCatalogo && (<div className={`flex items-center gap-2 text-sm p-3 rounded-md ${resultadoCatalogo.type === "error" ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{resultadoCatalogo.type === "error" ? <XCircle /> : <CheckCircle />} {resultadoCatalogo.message}</div>)}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}