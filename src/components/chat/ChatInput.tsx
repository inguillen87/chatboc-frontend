import React, { useState, useEffect, useRef } from "react";
import { Send, MapPin } from "lucide-react";
import AdjuntarArchivo from "@/components/ui/AdjuntarArchivo";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast"; // Importa toast

interface Props {
  onSendMessage: (payload: { text: string; es_foto?: boolean; archivo_url?: string; es_ubicacion?: boolean; ubicacion_usuario?: { lat: number; lon: number; }; action?: string; }) => void;
  isTyping: boolean;
}

const PLACEHOLDERS = [
  "Escribí tu mensaje...",
  "¿En qué puedo ayudarte hoy?",
  "Probá: '¿Qué hace Chatboc?'",
  "¿Cuánto cuesta el servicio?",
];

const ChatInput: React.FC<Props> = ({ onSendMessage, isTyping }) => {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    onSendMessage({ text: input.trim() });
    setInput("");
    inputRef.current?.focus();
  };

  // --- LÓGICA PARA ARCHIVOS Y UBICACIÓN: AHORA ENVÍAN MENSAJE SOLO CUANDO EL DATO ESTÁ LISTO ---
  // Este callback es llamado por AdjuntarArchivo CUANDO el archivo ya se SUBIÓ y tenemos su URL
  const handleFileUploaded = async (data: { url: string; }) => { 
    if (isTyping || !data || !data.url) {
      toast({ title: "Error", description: "No se pudo obtener la URL del archivo subido.", variant: "destructive" });
      return;
    }
    // AHORA SÍ, enviamos el mensaje al bot con la URL del archivo
    onSendMessage({ text: "Foto adjunta", es_foto: true, archivo_url: data.url }); 
    setInput("");
    toast({ title: "Archivo enviado", description: "La foto ha sido adjuntada al reclamo.", duration: 3000 });
  };

  // Este callback es llamado por el botón "Compartir ubicación" de ChatInput
  const handleShareLocation = async () => {
    if (isTyping) return;
    toast({ title: "Obteniendo ubicación...", description: "Por favor, acepta la solicitud de GPS.", duration: 2000 });
    // setIsTyping(true); // Opcional: mostrar typing indicator mientras se obtiene la ubicación
    try {
      const coords = await requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      if (coords) {
        // AHORA SÍ, enviamos el mensaje al bot con las coordenadas
        onSendMessage({
          text: "Ubicación compartida",
          es_ubicacion: true,
          ubicacion_usuario: { lat: coords.latitud, lon: coords.longitud }
        });
        toast({ title: "Ubicación enviada", description: "Tu ubicación ha sido compartida.", duration: 3000 });
      } else {
        toast({ title: "Ubicación no disponible", description: "No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https).", variant: "destructive", duration: 5000 });
        // No enviamos un mensaje al bot si falla la obtención de GPS, solo un toast al usuario
      }
    } catch (error) {
      console.error("Error al obtener ubicación:", error);
      toast({ title: "Error al obtener ubicación", description: "Hubo un problema al intentar obtener tu ubicación.", variant: "destructive", duration: 5000 });
    } finally {
      // setIsTyping(false); // Ocultar typing indicator
    }
    setInput("");
  };
  // -------------------------------------------------------------------------


  return (
    <div className="w-full max-w-[460px] mx-auto flex items-center gap-2 px-3 py-2">
      {/* Botón para adjuntar archivos: Solo abre el selector de archivos, NO envía un mensaje al backend directamente */}
      <AdjuntarArchivo onUpload={handleFileUploaded} /> 

      {/* Botón para compartir ubicación: Solo inicia la solicitud de GPS, NO envía un mensaje al backend directamente */}
      <button
        onClick={handleShareLocation}
        disabled={isTyping}
        className={`
          flex items-center justify-center
          rounded-full p-2.5
          shadow-xl transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-blue-500/60
          active:scale-95

          bg-gray-200 text-gray-700 hover:bg-gray-300
          dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600

          ${isTyping ? "opacity-50 cursor-not-allowed" : ""}
        `}
        aria-label="Compartir ubicación"
        type="button"
      >
        <MapPin className="w-5 h-5" />
      </button>

      <input
        ref={inputRef}
        className={`
          flex-1 max-w-full min-w-0
          rounded-full px-4 py-2
          text-base
          outline-none transition-all duration-200
          focus:border-primary focus:ring-2 focus:ring-primary/50
          placeholder:text-muted-foreground
          font-medium
          disabled:cursor-not-allowed
          
          bg-input
          text-foreground
          border border-input
          
          dark:bg-[#1a1a1a]
          dark:text-gray-100
          dark:placeholder-gray-400
          dark:border-[#333a4d]

          ${isTyping ? "opacity-60 bg-muted-foreground/10" : ""}
        `}
        type="text"
        placeholder={PLACEHOLDERS[placeholderIndex]}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        autoFocus
        autoComplete="off"
        maxLength={200}
        aria-label="Escribir mensaje"
        disabled={isTyping}
      />
      <button
        className={`
          flex items-center justify-center
          rounded-full p-2.5 ml-1
          shadow-xl transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/60
          active:scale-95

          bg-primary hover:bg-primary/90
          text-primary-foreground
          dark:bg-blue-600 dark:hover:bg-blue-700

          ${!input.trim() || isTyping ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={handleSend}
        disabled={!input.trim() || isTyping}
        aria-label="Enviar mensaje"
        type="button"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ChatInput;