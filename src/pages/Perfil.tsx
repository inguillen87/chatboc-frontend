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
  default: "🏢",
};

const PROVINCIAS = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"
];
const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

export default function Perfil() {
  const [perfil, setPerfil] = useState({
    nombre_empresa: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    link_web: "",
    plan: "",
    preguntas_usadas: 0,
    limite_preguntas: 50,
    rubro: "",
    horarios: DIAS.map(() => ({ abre: "09:00", cierra: "20:00", cerrado: false })),
  });
  const [modoHorario, setModoHorario] = useState("comercial");
  const [archivo, setArchivo] = useState(null);
  const [resultadoCatalogo, setResultadoCatalogo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [horariosOpen, setHorariosOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = stored ? JSON.parse(stored).token : null;
    if (!token) return;
    fetch("https://api.chatboc.ar/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) return setError(data.error);
        setPerfil((prev) => ({
          ...prev,
          nombre_empresa: data.nombre_empresa || "",
          telefono: data.telefono || "",
          direccion: data.direccion || "",
          ciudad: data.ciudad || "",
          provincia: data.ubicacion || "",
          link_web: data.link_web || "",
          plan: data.plan || "demo",
          preguntas_usadas: data.preguntas_usadas ?? 0,
          limite_preguntas: data.limite_preguntas ?? 50,
          horarios: data.horarios ? JSON.parse(data.horarios) : prev.horarios,
          rubro: data.rubro?.toLowerCase() || "",
        }));
      })
      .catch(() => setError("Error al cargar el perfil"));
  }, []);

  const handlePlace = (place) => {
    setPerfil((prev) => ({
      ...prev,
      direccion: place.formatted_address || "",
      ciudad: place.address_components?.find(x =>
        x.types.includes("locality") || x.types.includes("administrative_area_level_2")
      )?.long_name || "",
      provincia: place.address_components?.find(x =>
        x.types.includes("administrative_area_level_1")
      )?.long_name || "",
    }));
  };

  const setHorarioComercial = () => {
    setModoHorario("comercial");
    setPerfil((prev) => ({
      ...prev,
      horarios: DIAS.map(() => ({ abre: "09:00", cierra: "20:00", cerrado: false })),
    }));
  };
  const setHorarioPersonalizado = () => setModoHorario("personalizado");

  const handleGuardar = async (e) => {
    e.preventDefault();
    setMensaje(""); setError(""); setLoading(true);
    const stored = localStorage.getItem("user");
    const token = stored ? JSON.parse(stored).token : null;
    if (!token) return setError("No se encontró sesión activa.");
    try {
      const res = await fetch("https://api.chatboc.ar/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...perfil, horarios: JSON.stringify(perfil.horarios) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error inesperado");
      setMensaje(data.mensaje || "Cambios guardados ✔️");
    } catch (err) {
      setError("Error al guardar perfil");
    }
    setLoading(false);
  };

  const handleArchivoChange = (e) => {
    setArchivo(e.target.files?.[0] || null);
    setResultadoCatalogo("");
  };
  const handleSubirArchivo = async () => {
    if (!archivo) return setResultadoCatalogo("Seleccioná un archivo válido.");
    const stored = localStorage.getItem("user");
    const token = stored ? JSON.parse(stored).token : null;
    if (!token) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", archivo);
      const res = await fetch("https://api.chatboc.ar/subir_catalogo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      setResultadoCatalogo(res.ok ? data.mensaje : `❌ ${data.error}`);
    } catch {
      setResultadoCatalogo("❌ Error al conectar con el servidor");
    }
    setLoading(false);
  };

  const porcentaje = perfil.preguntas_usadas && perfil.limite_preguntas
    ? Math.min((perfil.preguntas_usadas / perfil.limite_preguntas) * 100, 100)
    : 0;

  // Avatar dinámico según rubro
  const avatarEmoji = RUBRO_AVATAR[perfil.rubro] || RUBRO_AVATAR.default;

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-950 to-slate-900 flex flex-col py-8 px-2 sm:px-0">
      {/* Header Dashboard */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between mb-8 gap-6">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 bg-primary/10 shadow-lg">
            <AvatarFallback>
              <span className="text-3xl">{avatarEmoji}</span>
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-4xl font-extrabold text-blue-400 leading-none mb-1">Perfil de empresa</h1>
            <span className="text-slate-400 text-base font-medium capitalize">
              {perfil.nombre_empresa || "Mi empresa"} <span className="ml-2">{perfil.rubro ? `/ ${perfil.rubro}` : ""}</span>
            </span>
          </div>
        </div>
        <Button
          variant="destructive"
          className="h-11 px-6 text-base"
          onClick={() => { localStorage.removeItem("user"); location.href = "/login"; }}
        >
          <LogOut className="w-5 h-5 mr-2" /> Salir
        </Button>
      </div>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Columna 1 y 2: Datos */}
        <Card className="col-span-2 bg-white/10 dark:bg-slate-900/90 shadow-2xl rounded-2xl border border-slate-800 backdrop-blur-md p-6 flex flex-col gap-4">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary mb-2">Datos de la empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <Label>Nombre empresa*</Label>
                <Input value={perfil.nombre_empresa} onChange={e => setPerfil({ ...perfil, nombre_empresa: e.target.value })} required />
              </div>
              <div>
                <Label>Teléfono*</Label>
                <Input value={perfil.telefono} onChange={e => setPerfil({ ...perfil, telefono: e.target.value })} required />
              </div>
              <div>
                <Label>Dirección*</Label>
                <GooglePlacesAutocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                  onPlaceSelected={handlePlace}
                  options={{ componentRestrictions: { country: "ar" } }}
                  autocompletionRequest={{ componentRestrictions: { country: "ar" } }}
                  className="w-full"
                  placeholder="Buscá la dirección exacta..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Ciudad</Label>
                  <Input value={perfil.ciudad} onChange={e => setPerfil({ ...perfil, ciudad: e.target.value })} />
                </div>
                <div>
                  <Label>Provincia*</Label>
                  <select value={perfil.provincia} onChange={e => setPerfil({ ...perfil, provincia: e.target.value })} required className="w-full rounded border px-3 py-2 text-sm bg-background">
                    <option value="">Seleccioná una provincia</option>
                    {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              {/* Horarios compacto, mobile accordion */}
              <div>
                <Label>Horarios</Label>
                <div className="flex gap-2 mb-1">
                  <Button type="button" variant={modoHorario === "comercial" ? "default" : "outline"} size="sm" onClick={setHorarioComercial}>Horario 9-20</Button>
                  <Button type="button" variant={modoHorario === "personalizado" ? "default" : "outline"} size="sm" onClick={() => { setHorarioPersonalizado(); setHorariosOpen(!horariosOpen); }}>
                    Personalizar
                  </Button>
                </div>
                {modoHorario === "comercial" && (
                  <div className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                    Lunes a Sábado: 9:00 a 20:00 hs. - Domingo: Cerrado
                  </div>
                )}
                {modoHorario === "personalizado" && horariosOpen && (
                  <div className="border rounded-lg p-2 mt-1 bg-muted dark:bg-slate-800 space-y-2">
                    {DIAS.map((dia, idx) => (
                      <div key={dia} className="flex items-center gap-2 text-sm">
                        <span className="w-16 sm:w-20">{dia}</span>
                        <input
                          type="checkbox"
                          checked={perfil.horarios[idx].cerrado}
                          onChange={e => {
                            const copia = [...perfil.horarios];
                            copia[idx].cerrado = e.target.checked;
                            setPerfil((prev) => ({ ...prev, horarios: copia }));
                          }}
                        /> <span className="text-xs">Cerrado</span>
                        {!perfil.horarios[idx].cerrado && (
                          <>
                            <Input
                              type="time"
                              value={perfil.horarios[idx].abre}
                              className="w-20"
                              onChange={e => {
                                const copia = [...perfil.horarios];
                                copia[idx].abre = e.target.value;
                                setPerfil((prev) => ({ ...prev, horarios: copia }));
                              }}
                            />
                            <span>-</span>
                            <Input
                              type="time"
                              value={perfil.horarios[idx].cierra}
                              className="w-20"
                              onChange={e => {
                                const copia = [...perfil.horarios];
                                copia[idx].cierra = e.target.value;
                                setPerfil((prev) => ({ ...prev, horarios: copia }));
                              }}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Web / Tienda*</Label>
                <Input value={perfil.link_web} onChange={e => setPerfil({ ...perfil, link_web: e.target.value })} required />
                {perfil.link_web && (
                  <a
                    href={perfil.link_web.startsWith("http") ? perfil.link_web : `https://${perfil.link_web}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-xs sm:text-sm mt-1 block"
                  >
                    Ir a tienda: {perfil.link_web}
                  </a>
                )}
              </div>
              <Button disabled={loading} type="submit" className="w-full mt-2">Guardar cambios</Button>
              {mensaje && <p className="mt-2 text-green-600 dark:text-green-400 text-center">{mensaje}</p>}
              {error && <p className="mt-2 text-red-600 dark:text-red-400 text-center">{error}</p>}
            </form>
          </CardContent>
        </Card>
        {/* Columna 3: Panel derecho */}
        <div className="flex flex-col gap-8">
          {/* Plan/uso: ahora más alargado, barra grande */}
          <Card className="bg-white/10 dark:bg-slate-900/80 shadow-2xl rounded-2xl border border-slate-800 backdrop-blur-md p-6 flex flex-col gap-2 h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-primary mb-1">Plan y uso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <span className="text-base font-medium text-white/90">Plan actual: <Badge className="text-base">{perfil.plan || "demo"}</Badge></span>
                <div className="text-sm text-slate-400 mb-1">
                  Consultas usadas: <span className="font-bold">{perfil.preguntas_usadas} / {perfil.limite_preguntas}</span>
                </div>
                <Progress className="h-4 rounded-xl" value={porcentaje} />
              </div>
            </CardContent>
          </Card>
          {/* Catálogo: card chica arriba */}
          <Card className="bg-white/10 dark:bg-slate-900/80 shadow-2xl rounded-2xl border border-slate-800 backdrop-blur-md p-6 flex flex-col gap-2 h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-primary mb-1">Catálogo</CardTitle>
            </CardHeader>
            <CardContent>
              <Input type="file" accept=".xlsx,.xls,.csv,.pdf,.txt" onChange={handleArchivoChange} />
              <p className="text-xs text-muted-foreground mt-1">
                ⚠️ Subí Excel o CSV para mejor lectura. PDF puede tener menor precisión.
              </p>
              <Button onClick={handleSubirArchivo} className="w-full mt-2" disabled={loading}>
                <UploadCloud className="w-4 h-4 mr-2" /> Subir catálogo
              </Button>
              {resultadoCatalogo && (
                <p className="text-xs text-center text-green-600 mt-2">{resultadoCatalogo}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
