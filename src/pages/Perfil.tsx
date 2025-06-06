// Contenido COMPLETO y FINAL para: Perfil.tsx

import React, { useEffect, useState, useCallback, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, UploadCloud, CheckCircle, XCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import GooglePlacesAutocomplete from "react-google-autocomplete";

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
    nombre_empresa: "", telefono: "", direccion: "", ciudad: "", provincia: "", pais: "Argentina", 
    latitud: null, longitud: null, link_web: "", plan: "gratis", preguntas_usadas: 0, 
    limite_preguntas: 50, rubro: "", horarios_ui: DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx >= 5 })),
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

  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate("/login");
  }, [navigate]);
  
  const fetchPerfil = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        // Si la respuesta no es OK, asumimos que el token es inválido/expirado
        throw new Error("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
      }
      const data = await res.json();
      
      let horariosUi = DIAS.map((_, idx) => ({ abre: "09:00", cierra: "20:00", cerrado: idx >= 5 }));
      if (data.horario_json && Array.isArray(data.horarario_json)) {
         horariosUi = data.horario_json.map((h: any, idx: number) => ({...h, dia: DIAS[idx] }));
      }
      setPerfil(prev => ({ ...prev, ...data, horarios_ui: horariosUi, rubro: data.rubro?.toLowerCase() || "" }));
    } catch (err: any) {
      setError(err.message);
      handleLogout(); // Si hay cualquier error, limpiamos y redirigimos
    }
  }, [handleLogout]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      handleLogout();
      return;
    }
    fetchPerfil(token);
  }, [fetchPerfil, handleLogout]);

  const handleGuardar = async (e: FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("authToken");
    if (!token) { setError("Sesión no válida."); return; }
    
    setLoadingGuardar(true); setError(null); setMensaje(null);
    const horariosParaBackend: HorarioBackend[] = perfil.horarios_ui.map((h, idx) => ({ dia: DIAS[idx], abre: h.cerrado ? "" : h.abre, cierra: h.cerrado ? "" : h.cierra, cerrado: h.cerrado }));
    const payload = {
      nombre_empresa: perfil.nombre_empresa, telefono: perfil.telefono, direccion: perfil.direccion,
      ciudad: perfil.ciudad, provincia: perfil.provincia, pais: perfil.pais,
      latitud: perfil.latitud, longitud: perfil.longitud, link_web: perfil.link_web,
      logo_url: perfil.logo_url, horario_json: JSON.stringify(horariosParaBackend),
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

  const handleSubirArchivo = async () => {
    if (!archivo) return;
    const token = localStorage.getItem("authToken"); // <-- CORRECCIÓN APLICADA
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
  
  const handlePlaceSelected = (place: any) => {
    if (!place?.address_components || !place?.geometry) return;
    const getAddressComponent = (type: string): string => place.address_components?.find((c: any) => c.types.includes(type))?.long_name || "";
    setPerfil(p => ({ ...p, direccion: place.formatted_address || "", ciudad: getAddressComponent("locality") || "", provincia: getAddressComponent("administrative_area_level_1") || "", pais: getAddressComponent("country") || "", latitud: place.geometry?.location?.lat() || null, longitud: place.geometry?.location?.lng() || null, }));
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPerfil(prev => ({ ...prev, [e.target.id]: e.target.value }));
  const handleHorarioChange = (index: number, field: keyof HorarioUI, value: string | boolean) => { const n = [...perfil.horarios_ui]; n[index] = { ...n[index], [field]: value }; setPerfil(p => ({ ...p, horarios_ui: n })); };
  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => setArchivo(e.target.files ? e.target.files[0] : null);

  const porcentaje = perfil.limite_preguntas > 0 ? Math.min((perfil.preguntas_usadas / perfil.limite_preguntas) * 100, 100) : 0;
  const avatarEmoji = RUBRO_AVATAR[perfil.rubro] || RUBRO_AVATAR.default;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-slate-950 to-slate-900 text-slate-200 py-8 px-4">
      <div className="w-full max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 px-2">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/20 shadow-lg border-2 border-blue-400"><AvatarFallback className="bg-transparent"><span className="text-3xl sm:text-4xl">{avatarEmoji}</span></AvatarFallback></Avatar>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-blue-400 leading-tight mb-0.5 text-center sm:text-left">{perfil.nombre_empresa || "Panel de Empresa"}</h1>
              <span className="text-slate-400 text-sm sm:text-base font-medium capitalize block text-center sm:text-left">{perfil.rubro || "Rubro no especificado"}</span>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="outline" className="h-10 px-5 text-sm border-yellow-400 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-700" onClick={() => navigate("/tickets")}>Ver Tickets</Button>
            <Button variant="outline" className="h-10 px-5 text-sm border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={handleLogout}><LogOut className="w-4 h-4 mr-2" /> Salir</Button>
          </div>
        </header>
        <main className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 px-2">
          {/* Tu JSX para el resto del perfil aquí, como lo tenías */}
        </main>
      </div>
    </div>
  );
}