import React, { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogOut } from "lucide-react"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface PerfilData {
  nombre_empresa: string
  direccion: string
  telefono: string
  link_web: string
  horario: string
  ubicacion: string
  email?: string
  name?: string
  plan?: string
  preguntas_usadas?: number
  limite_preguntas?: number
  logo_url?: string
}

interface MetricData {
  total_preguntas?: number
  preguntas_esta_semana?: number
  fecha_ultimo_uso?: string
}

export default function Perfil() {
  const [perfil, setPerfil] = useState<PerfilData>({
    nombre_empresa: "",
    direccion: "",
    telefono: "",
    link_web: "",
    horario: "",
    ubicacion: "",
  })

  const [metrics, setMetrics] = useState<MetricData>({})
  const [mensaje, setMensaje] = useState<string>("")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    fetch("https://api.chatboc.ar/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setPerfil({
          nombre_empresa: data.nombre_empresa || "",
          direccion: data.direccion || "",
          telefono: data.telefono || "",
          link_web: data.link_web || "",
          horario: data.horario || "",
          ubicacion: data.ubicacion || "",
          email: data.email,
          name: data.name,
          plan: data.plan,
          preguntas_usadas: data.preguntas_usadas,
          limite_preguntas: data.limite_preguntas,
          logo_url: data.logo_url || "",
        })
      })

    fetch("https://api.chatboc.ar/metricas", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMetrics(data))
      .catch(() => {})
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPerfil({ ...perfil, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje("")
    setError("")

    const camposObligatorios = ["nombre_empresa", "direccion", "telefono", "link_web", "horario", "ubicacion"]
    for (const campo of camposObligatorios) {
      if (!perfil[campo as keyof PerfilData]?.trim()) {
        setError("⚠️ Todos los campos son obligatorios para mejorar las respuestas del chatbot.")
        return
      }
    }

    const token = localStorage.getItem("token")
    if (!token) return

    const res = await fetch("https://api.chatboc.ar/perfil", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(perfil),
    })

    if (res.ok) {
      setMensaje("✅ Perfil actualizado correctamente")
    } else {
      setError("❌ Error al guardar los datos")
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors">
      <Navbar />
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-4 space-y-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={perfil.logo_url || undefined} alt={perfil.nombre_empresa} />
                <AvatarFallback>{perfil.nombre_empresa?.charAt(0) || "C"}</AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold text-primary">
                {perfil?.nombre_empresa ? `Perfil de ${perfil.nombre_empresa}` : `Perfil de ${perfil.name}`}
              </h1>
            </div>
            <Button variant="destructive" onClick={() => { localStorage.removeItem("user"); location.href = "/login"; }}>
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>

          <Card className="shadow-lg border border-muted">
            <CardHeader>
              <CardTitle>📋 Información del negocio</CardTitle>
              <p className="text-sm text-muted-foreground">
                Completá estos campos para personalizar las respuestas del chatbot con datos reales de tu empresa.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><Label>Nombre de la empresa</Label><Input name="nombre_empresa" value={perfil.nombre_empresa} onChange={handleChange} required /></div>
                <div><Label>Teléfono / WhatsApp</Label><Input name="telefono" value={perfil.telefono} onChange={handleChange} required /></div>
                <div><Label>Dirección</Label><Input name="direccion" value={perfil.direccion} onChange={handleChange} required /></div>
                <div><Label>Ubicación / Ciudad</Label><Input name="ubicacion" value={perfil.ubicacion} onChange={handleChange} required /></div>
                <div><Label>Horario de atención</Label><Input name="horario" value={perfil.horario} onChange={handleChange} required /></div>
                <div><Label>Web / Tienda Online</Label><Input name="link_web" value={perfil.link_web} onChange={handleChange} required /></div>
                <div><Label>Logo o Imagen (URL)</Label><Input name="logo_url" value={perfil.logo_url || ""} onChange={handleChange} placeholder="https://..." /></div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">Guardar cambios</Button>
                  {mensaje && <p className="mt-2 text-sm text-green-600 text-center">{mensaje}</p>}
                  {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardHeader><CardTitle>📄 Plan actual</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-2">Plan: <Badge>{perfil.plan || "demo"}</Badge></p>
                <p>Consultas usadas: {perfil.preguntas_usadas ?? 0}</p>
                <p>Límite de preguntas: {perfil.limite_preguntas ?? 15}</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 dark:border-gray-700">
              <CardHeader><CardTitle>📊 Métricas de uso</CardTitle></CardHeader>
              <CardContent>
                <p>Total de preguntas históricas: {metrics.total_preguntas ?? "-"}</p>
                <p>Preguntas esta semana: {metrics.preguntas_esta_semana ?? "-"}</p>
                <p>Último uso: {metrics.fecha_ultimo_uso ? new Date(metrics.fecha_ultimo_uso).toLocaleDateString() : "-"}</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 dark:border-gray-700 col-span-1 md:col-span-2">
              <CardHeader><CardTitle>💡 Sugerencias</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  <li>✅ Completá todos los datos para respuestas más realistas</li>
                  <li>📈 Actualizá tu plan si superás el límite</li>
                  <li>🤖 El bot responde mejor si conoce tu rubro, horario y contacto</li>
                  <li>🖼️ Subí el logo de tu negocio para mostrarlo en tu widget personalizado</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
