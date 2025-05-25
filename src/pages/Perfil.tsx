import React, { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  logo_url: string
  email?: string
  name?: string
  plan?: string
  preguntas_usadas?: number
  limite_preguntas?: number
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
  })

  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")

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
          logo_url: data.logo_url || "",
          email: data.email,
          name: data.name,
          plan: data.plan,
          preguntas_usadas: data.preguntas_usadas,
          limite_preguntas: data.limite_preguntas,
        })
      })
      .catch(() => setError("❌ Error al cargar los datos del perfil"))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPerfil((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje("")
    setError("")

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

    const data = await res.json()

    if (res.ok) {
      setMensaje("✅ Perfil actualizado correctamente")
    } else {
      setError(data.error || "❌ Error al guardar los datos")
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors">
      <Navbar />
      <main className="flex-grow pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-4 space-y-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={perfil.logo_url || undefined} />
                <AvatarFallback>{perfil.nombre_empresa?.charAt(0) || "C"}</AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold">Perfil de {perfil.nombre_empresa || perfil.name}</h1>
            </div>
            <Button variant="destructive" onClick={() => {
              localStorage.removeItem("user")
              localStorage.removeItem("token")
              location.href = "/login"
            }}>
              <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>📋 Información del negocio</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><Label>Nombre empresa</Label><Input name="nombre_empresa" value={perfil.nombre_empresa} onChange={handleChange} required /></div>
                <div><Label>Teléfono</Label><Input name="telefono" value={perfil.telefono} onChange={handleChange} required /></div>
                <div><Label>Dirección</Label><Input name="direccion" value={perfil.direccion} onChange={handleChange} required /></div>
                <div><Label>Ubicación</Label><Input name="ubicacion" value={perfil.ubicacion} onChange={handleChange} required /></div>
                <div><Label>Horario</Label><Input name="horario" value={perfil.horario} onChange={handleChange} required /></div>
                <div><Label>Sitio web</Label><Input name="link_web" value={perfil.link_web} onChange={handleChange} required /></div>
                <div className="md:col-span-2"><Label>Logo URL</Label><Input name="logo_url" value={perfil.logo_url} onChange={handleChange} /></div>

                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">Guardar cambios</Button>
                  {mensaje && <p className="mt-2 text-green-600 text-center">{mensaje}</p>}
                  {error && <p className="mt-2 text-red-600 text-center">{error}</p>}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
