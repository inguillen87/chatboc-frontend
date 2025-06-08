import React, { useEffect, useState, useCallback, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, UploadCloud, CheckCircle, XCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import GooglePlacesAutocomplete from "react-google-autocomplete";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.chatboc.ar";
const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY;
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
      setError("Error de configuración: Falta la clave para Google Maps. Contacta a soporte.");
    }
  }, []);

  const fetchPerfil = useCallback(async (token: string) => {
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
    } finally { setLoadingGuardar(false); }
  }, []);

  useEffect(() => {
  const token = localStorage.getItem("authToken");
  if (!token) { window.location.href = "/login"; return; }
  fetchPerfil(token);
}, [fetchPerfil]);

  const handlePlaceSelected = (place: any) => {
    if (!place || !place.address_components || !place.geometry) {
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
    setPerfil((prev) => ({
      ...prev,
      direccion: nuevaDireccion,
      ciudad: nuevaCiudad || prev.ciudad,
      provincia: nuevaProvincia || prev.provincia,
      pais: nuevoPais || prev.pais,
      latitud: nuevaLatitud,
      longitud: nuevaLongitud,
    }));
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setPerfil(prev => ({ ...prev, [id]: value }));
  };

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
    setMensaje(null); setError(null); setLoadingGuardar(true);

    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("No se encontró sesión activa. Por favor, vuelve a iniciar sesión.");
      setLoadingGuardar(false); return;
    }
    const horariosParaBackend: HorarioBackend[] = perfil.horarios_ui.map((h, idx) => ({
      dia: DIAS[idx], abre: h.cerrado ? "" : h.abre, cierra: h.cerrado ? "" : h.cierra, cerrado: h.cerrado,
    }));

    const payload = {
      nombre_empresa: perfil.nombre_empresa, telefono: perfil.telefono,
      direccion: perfil.direccion, ciudad: perfil.ciudad, provincia: perfil.provincia, pais: perfil.pais,
      latitud: perfil.latitud, longitud: perfil.longitud, link_web: perfil.link_web,
      logo_url: perfil.logo_url, horario_json: JSON.stringify(horariosParaBackend),
    };
    try {
      const res = await fetch(`${API_BASE_URL}/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { throw new Error(data.error || `Error ${res.status} al guardar cambios.`); }
      setMensaje(data.mensaje || "Cambios guardados correctamente ✔️");
    } catch (err: any) {
      setError(err.message || "Error al guardar el perfil. Intenta de nuevo.");
    } finally { setLoadingGuardar(false); }
  };

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
    } catch (err) {
      setResultadoCatalogo({ message: "❌ Error de conexión al subir el catálogo.", type: "error" });
    } finally { setLoadingCatalogo(false); }
  };

  const porcentaje = perfil.limite_preguntas > 0 ? Math.min((perfil.preguntas_usadas / perfil.limite_preguntas) * 100, 100) : 0;
  const avatarEmoji = RUBRO_AVATAR[perfil.rubro] || RUBRO_AVATAR.default;

  return (
    <div className="flex flex-col min-h-screen bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground py-8 px-2 sm:px-4 md:px-6 lg:px-8">
      <div className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 px-2">
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 bg-secondary border-2 border-border shadow-lg">
          <AvatarFallback className="bg-transparent"><span className="text-3xl sm:text-4xl text-primary">{avatarEmoji}</span></AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary leading-tight mb-0.5 text-center sm:text-left">
            {perfil.nombre_empresa || "Panel de Empresa"}
          </h1>
          <span className="text-muted-foreground text-sm sm:text-base font-medium capitalize block text-center sm:text-left">
            {perfil.rubro || "Rubro no especificado"}
          </span>
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <Button
          variant="outline"
          className="h-10 px-5 text-sm border-border text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => navigate("/tickets")}
        >
          Ver Tickets
        </Button>
        <Button
          variant="outline"
          className="h-10 px-5 text-sm border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
      </div>
    </div>
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 px-2">
        <div className="md:col-span-2 flex flex-col gap-6 md:gap-8">
          <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
            <CardHeader><CardTitle className="text-xl font-semibold text-primary">Datos de tu Empresa</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleGuardar} className="space-y-6">
                <div>
                  <Label htmlFor="nombre_empresa" className="text-muted-foreground text-sm mb-1 block">Nombre de la empresa*</Label>
                  <Input id="nombre_empresa" value={perfil.nombre_empresa} onChange={handleInputChange} required className="bg-input border-input text-foreground"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono" className="text-muted-foreground text-sm mb-1 block">Teléfono* (con cód. país y área)</Label>
                    <Input id="telefono" placeholder="+5492611234567" value={perfil.telefono} onChange={handleInputChange} required className="bg-input border-input text-foreground"/>
                  </div>
                  <div>
                    <Label htmlFor="link_web" className="text-muted-foreground text-sm mb-1 block">Sitio Web / Tienda Online*</Label>
                    <Input id="link_web" type="url" placeholder="https://ejemplo.com" value={perfil.link_web} onChange={handleInputChange} required className="bg-input border-input text-foreground"/>
                  </div>
                </div>
                <div>
                  <Label htmlFor="google-places-input" className="text-muted-foreground text-sm mb-1 block">Dirección Completa*</Label>
                  {Maps_API_KEY ? (
                    <GooglePlacesAutocomplete
                      apiKey={Maps_API_KEY}
                      onPlaceSelected={handlePlaceSelected}
                      options={{
                        componentRestrictions: { country: "ar" },
                        types: ['address'],
                        fields: ["address_components", "formatted_address", "geometry.location"]
                      }}
                      defaultValue={perfil.direccion}
                      inputClassName="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary h-10 placeholder:text-muted-foreground"
                      placeholder="Ej: Av. San Martín 123, Mendoza"
                    />
                  ) : (
                    <Input
                      id="direccion"
                      value={perfil.direccion}
                      onChange={handleInputChange}
                      placeholder="Clave de Google Maps no configurada. Ingrese dirección manualmente."
                      className="bg-input border-input text-foreground placeholder-destructive"
                      required
                    />
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ciudad" className="text-muted-foreground text-sm mb-1 block">Ciudad</Label>
                    <Input id="ciudad" value={perfil.ciudad} onChange={handleInputChange} className="bg-input border-input text-foreground"/>
                  </div>
                  <div>
                    <Label htmlFor="provincia" className="text-muted-foreground text-sm mb-1 block">Provincia*</Label>
                    <select id="provincia" value={perfil.provincia} onChange={handleInputChange} required
                      className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary h-10">
                      <option value="">Selecciona una provincia</option>
                      {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm block mb-2">Horarios de Atención</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button type="button" variant={modoHorario === "comercial" ? "secondary" : "outline"} size="sm" onClick={setHorarioComercial} className="border-border hover:bg-accent">Automático (Lun-Sáb 9-20)</Button>
                    <Button type="button" variant={modoHorario === "personalizado" ? "secondary" : "outline"} size="sm" onClick={setHorarioPersonalizado} className="border-border hover:bg-accent flex items-center">
                      {modoHorario === "personalizado" && horariosOpen ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                      Personalizar
                    </Button>
                  </div>
                  {modoHorario === "comercial" && (<div className="text-primary bg-primary/10 rounded-md border border-primary/50 p-3 flex items-center gap-2 text-xs"><Info className="w-3 h-3 inline mr-1"/> L-V: 09-20. Sáb y Dom: Cerrado.</div>)}
                  {modoHorario === "personalizado" && horariosOpen && (
                    <div className="border border-border rounded-lg p-4 mt-2 bg-card/60 space-y-3">
                      {DIAS.map((dia, idx) => (
                        <div key={dia} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[100px_auto_1fr] items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-medium text-foreground col-span-3 sm:col-span-1">{dia}</span>
                          <div className="flex items-center gap-2 col-span-3 sm:col-span-1 sm:justify-self-end">
                            <Label htmlFor={`cerrado-${idx}`} className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer select-none">
                              <input type="checkbox" id={`cerrado-${idx}`} checked={perfil.horarios_ui[idx].cerrado} onChange={e => handleHorarioChange(idx, "cerrado", e.target.checked)}
                                className="form-checkbox h-4 w-4 text-primary bg-input border-border rounded focus:ring-primary cursor-pointer"/> Cerrado
                            </Label>
                          </div>
                          {!perfil.horarios_ui[idx].cerrado && (
                            <div className="flex items-center gap-1 col-span-3 sm:col-span-1 sm:justify-self-start">
                              <Input type="time" value={perfil.horarios_ui[idx].abre} className="w-full sm:w-28 bg-input border-input text-foreground h-9 text-xs" onChange={e => handleHorarioChange(idx, "abre", e.target.value)} />
                              <span className="text-muted-foreground mx-1">-</span>
                              <Input type="time" value={perfil.horarios_ui[idx].cierra} className="w-full sm:w-28 bg-input border-input text-foreground h-9 text-xs" onChange={e => handleHorarioChange(idx, "cierra", e.target.value)} />
                            </div>
                          )}
                          {perfil.horarios_ui[idx].cerrado && <div className="hidden sm:block sm:col-span-1"></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button disabled={loadingGuardar} type="submit" className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-base">
                  {loadingGuardar ? "Guardando Cambios..." : "Guardar Cambios"}
                </Button>
                {mensaje && <div className="mt-3 text-sm text-secondary-foreground bg-secondary p-3 rounded-md flex items-center gap-2"><CheckCircle className="w-4 h-4"/> {mensaje}</div>}
                {error && <div className="mt-3 text-sm text-destructive-foreground bg-destructive p-3 rounded-md flex items-center gap-2"><XCircle className="w-4 h-4"/> {error}</div>}
              </form>
            </CardContent>
          </Card>
        </div>

         {/* Columna Derecha (Plan y Catálogo) */}
      <div className="flex flex-col gap-6 md:gap-8">
        {/* Card Plan y Uso */}
        <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">Plan y Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Plan actual:{" "}
              <Badge variant="secondary" className={cn("bg-primary text-primary-foreground capitalize")}>
                {perfil?.plan || "N/A"}
              </Badge>
            </p>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Consultas usadas este mes:</p>
              <div className="flex items-center gap-2">
                <Progress value={porcentaje} className="h-3 bg-muted [&>div]:bg-primary" aria-label={`${porcentaje.toFixed(0)}% de consultas usadas`} />
                <span className="text-xs text-muted-foreground min-w-[70px] text-right">
                  {perfil?.preguntas_usadas} / {perfil?.limite_preguntas}
                </span>
              </div>
            </div>
    {(perfil.plan !== "full" && perfil.plan !== "pro") && (
      <div className="space-y-2 mt-3">
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          onClick={() => window.open("https://pagar.ualabis.com.ar/order/517238bd80bb1e97539240a22b1707c414a73855d6b673a8", "_blank")}
        >
          Mejorar a PRO ($/mes)
        </Button>
        <Button
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
          onClick={() => window.open("https://pagar.ualabis.com.ar/order/61f8ef497944c94964ba34a3c31e9d46d4ecc749d5d4c56a", "_blank")}
        >
          Mejorar a FULL ($/mes)
        </Button>
      </div>
    )}
    {(perfil.plan === "pro" || perfil.plan === "full") && (
      <div className="text-primary bg-primary/10 rounded p-3 font-medium text-sm mt-3">
        ¡Tu plan está activo! <br />
        <span className="text-muted-foreground">La renovación se realiza cada mes. Si vence el pago, vas a ver los links aquí para renovarlo.</span>
      </div>
    )}
    <div className="text-xs text-muted-foreground mt-2">
      Una vez realizado el pago, tu cuenta se actualiza automáticamente.<br />
      Si no ves el cambio en unos minutos, comunicate con soporte.
    </div>
  </CardContent>
</Card>

          {/* Card Integración */}
          <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-primary">Integrá Chatboc a tu web</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const planesPremium = ["pro", "full"];
                const esPremium = planesPremium.includes(perfil.plan?.toLowerCase());
                const inicioTrial = window.localStorage.getItem("trial_start");
                let enTrial = false;
                if (perfil.plan === "gratis" && inicioTrial) {
                  const hoy = new Date();
                  const inicio = new Date(inicioTrial);
                  const dias = (hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
                  enTrial = dias <= 15;
                }
                if (esPremium || enTrial) {
                  return (
                    <>
                      <p className="text-sm text-muted-foreground mb-2">
                        Sumá el chat a tu tienda, web, Tiendanube, WooCommerce, etc.
                      </p>
                      <Button
                        className="w-full mb-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => window.location.href = "/integracion"}
                      >
                        Obtener código de integración
                      </Button>
                      {enTrial && (
                        <div className="text-xs text-primary bg-primary/10 rounded p-3 font-medium">
                          <b>Modo prueba:</b> Tu integración funciona por 15 días gratis.
                        </div>
                      )}
                    </>
                  );
                }
                return (
                  <>
                    <div className="bg-muted text-muted-foreground p-2 rounded border border-border text-xs">
                      Solo disponible para planes <b>PRO</b> o <b>FULL</b>.<br />
                      Mejorá tu plan para integrar Chatboc en tu web.
                    </div>
                    <Button
                      className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      onClick={() => window.location.href = "/checkout?plan=pro"}
                    >
                      Mejorar mi plan
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
          {/* Card Catálogo */}
          <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
            <CardHeader><CardTitle className="text-lg font-semibold text-primary">Tu Catálogo de Productos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="catalogoFile" className="text-sm text-muted-foreground mb-1 block">Subir nuevo o actualizar (PDF, Excel, CSV)</Label>
                <Input id="catalogoFile" type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleArchivoChange} className="text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"/>
                <p className="text-xs text-muted-foreground mt-1.5">Tip: Para mayor precisión, usá Excel/CSV con columnas claras (ej: Nombre, Precio, Descripción).</p>
              </div>
              <Button onClick={handleSubirArchivo} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5" disabled={loadingCatalogo || !archivo}>
                <UploadCloud className="w-4 h-4 mr-2" /> {loadingCatalogo ? "Procesando Catálogo..." : "Subir y Procesar Catálogo"}
              </Button>
              {resultadoCatalogo && ( <div className={`text-sm p-3 rounded-md flex items-center gap-2 ${resultadoCatalogo.type === "error" ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {resultadoCatalogo.type === "error" ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>} {resultadoCatalogo.message}
              </div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}