import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, UploadCloud } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PerfilData {
  nombre_empresa: string;
  direccion: string;
  telefono: string;
  link_web: string;
  horario: string;
  ubicacion: string;
  logo_url?: string;
  email?: string;
  name?: string;
  plan?: string;
  preguntas_usadas?: number;
  limite_preguntas?: number;
}

export default function Perfil() {
  const [perfil, setPerfil] = useState<PerfilData>({
    nombre_empresa: "",
    direccion: "",
    telefono: "",
    link_web: "",
    horario: "",
    ubicacion: "",
    logo_url: "",
  });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultadoCatalogo, setResultadoCatalogo] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = stored ? JSON.parse(stored).token : null;
    if (!token) return;

    fetch("https://api.chatboc.ar/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
          return;
        }
        setPerfil({
          nombre_empresa: data.nombre_empresa || "",
          direccion: data.direccion || "",
          telefono: data.telefono || "",
          link_web: data.link_web || "",
          horario: data.horario || "",
          ubicacion: data.ubicacion || "",
          logo_url: data.logo_url || "",
          email: data.email,
          name: data.name,
          plan: data.plan,
          preguntas_usadas: data.preguntas_usadas,
          limite_preguntas: data.limite_preguntas,
        });
      })
      .catch((err) => {
        console.error("❌ Error al cargar perfil:", err);
        setError("Error al cargar el perfil");
      });
  }, []);

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setArchivo(file);
  };

  const handleSubirArchivo = async () => {
    setResultadoCatalogo("");
    if (!archivo) return setResultadoCatalogo("Seleccioná un archivo válido.");

    const formData = new FormData();
    formData.append("file", archivo);

    const stored = localStorage.getItem("user");
    const token = stored ? JSON.parse(stored).token : null;
    if (!token) return;

    try {
      const res = await fetch("https://api.chatboc.ar/subir_catalogo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      setResultadoCatalogo(res.ok ? data.mensaje : `❌ ${data.error}`);
    } catch (err) {
      console.error("❌ Error al subir catálogo:", err);
      setResultadoCatalogo("❌ Error al conectar con el servidor");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-4 space-y-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={perfil.logo_url} />
                <AvatarFallback>{perfil.nombre_empresa?.charAt(0) || "C"}</AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold text-primary">
                Perfil de {perfil.nombre_empresa || perfil.name}
              </h1>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                localStorage.removeItem("user");
                location.href = "/login";
              }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Información del negocio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Estos datos se usan para personalizar las respuestas del bot.
                </p>
                <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><Label>Nombre empresa</Label><Input name="nombre_empresa" value={perfil.nombre_empresa} onChange={(e) => setPerfil({ ...perfil, nombre_empresa: e.target.value })} required /></div>
                  <div><Label>Teléfono</Label><Input name="telefono" value={perfil.telefono} onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })} required /></div>
                  <div><Label>Dirección</Label><Input name="direccion" value={perfil.direccion} onChange={(e) => setPerfil({ ...perfil, direccion: e.target.value })} required /></div>
                  <div>
                    <Label>Provincia</Label>
                    <select name="ubicacion" value={perfil.ubicacion} onChange={(e) => setPerfil({ ...perfil, ubicacion: e.target.value })} required className="w-full rounded border px-3 py-2 text-sm text-foreground bg-background">
                      <option value="">Seleccioná una provincia</option>
                      {[
                        "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
                        "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
                        "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
                        "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
                        "Tierra del Fuego", "Tucumán"
                      ].map((prov) => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>
                  <div><Label>Horario</Label><Input name="horario" value={perfil.horario} onChange={(e) => setPerfil({ ...perfil, horario: e.target.value })} required /></div>
                  <div>
                    <Label>Web / Tienda</Label>
                    <Input name="link_web" value={perfil.link_web} onChange={(e) => setPerfil({ ...perfil, link_web: e.target.value })} required />
                    {perfil.link_web && (
                      <a href={perfil.link_web.startsWith("http") ? perfil.link_web : `https://${perfil.link_web}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm mt-1 block">
                        Ir a tienda: {perfil.link_web}
                      </a>
                    )}
                  </div>
                  <div><Label>Logo URL</Label><Input name="logo_url" value={perfil.logo_url || ""} onChange={(e) => setPerfil({ ...perfil, logo_url: e.target.value })} /></div>
                  <div className="md:col-span-2">
                    <Button type="submit" className="w-full">Guardar cambios</Button>
                    {mensaje && <p className="mt-2 text-sm text-green-600 text-center">{mensaje}</p>}
                    {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Plan y uso</CardTitle></CardHeader>
              <CardContent>
                <p>Plan: <Badge>{perfil.plan || "demo"}</Badge></p>
                <p>Consultas usadas: {perfil.preguntas_usadas ?? "-"}</p>
                <p>Límite de preguntas: {perfil.limite_preguntas ?? "-"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Catálogo de productos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input type="file" accept=".xlsx,.xls,.csv,.pdf,.txt" onChange={handleArchivoChange} />
                <Button onClick={handleSubirArchivo} className="w-full">
                  <UploadCloud className="w-4 h-4 mr-2" /> Subir catálogo
                </Button>
                {resultadoCatalogo && (
                  <p className="text-sm text-center text-green-600">{resultadoCatalogo}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
