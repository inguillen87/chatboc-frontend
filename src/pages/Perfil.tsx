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
    horarios: DIAS.map(() => ({ abre: "09:00", cierra: "20:00", cerrado: false })),
  });
  const [modoHorario, setModoHorario] = useState("comercial");
  const [archivo, setArchivo] = useState(null);
  const [resultadoCatalogo, setResultadoCatalogo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Mobile: panel abierto/cerrado para horarios
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-grow pt-20 pb-12">
        <div className="max-w-lg mx-auto px-2 sm:px-4 space-y-8">
          {/* Header */}
          <div className="flex gap-3 items-center mb-3">
            <Avatar className="w-12 h-12 bg-primary/10">
              <AvatarFallback>
                <span role="img" aria-label="avatar" className="text-lg">👤</span>
              </AvatarFallback>
            </Avatar>
            <h1 className="text-xl sm:text-2xl font-bold text-primary dark:text-blue-400">
              Perfil de empresa
            </h1>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={() => { localStorage.removeItem("user"); location.href = "/login"; }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Salir
            </Button>
          </div>

          {/* Perfil + métricas + catálogo */}
          <div className="space-y-5">
            {/* FORM */}
            <Card>
              <CardHeader>
                <CardTitle>Datos de la empresa</CardTitle>
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

            {/* Métricas/Plan */}
            <Card>
              <CardHeader><CardTitle>Plan y uso</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs sm:text-sm">Plan actual: <Badge>{perfil.plan || "demo"}</Badge></p>
                <p className="text-xs sm:text-sm">Consultas usadas: {perfil.preguntas_usadas} / {perfil.limite_preguntas}</p>
                <Progress value={porcentaje} />
              </CardContent>
            </Card>

            {/* Catálogo */}
            <Card>
              <CardHeader><CardTitle>Catálogo de productos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input type="file" accept=".xlsx,.xls,.csv,.pdf,.txt" onChange={handleArchivoChange} />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Subí Excel o CSV para mejor lectura. PDF puede tener menor precisión.
                </p>
                <Button onClick={handleSubirArchivo} className="w-full" disabled={loading}>
                  <UploadCloud className="w-4 h-4 mr-2" /> Subir catálogo
                </Button>
                {resultadoCatalogo && (
                  <p className="text-xs text-center text-green-600">{resultadoCatalogo}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
