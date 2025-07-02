import React, { useState, useEffect, useRef } from "react";
import { Send, MapPin, Mic, MicOff } from "lucide-react";
import AdjuntarArchivo from "@/components/ui/AdjuntarArchivo";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast"; // Importa toast
import useSpeechRecognition from "@/hooks/useSpeechRecognition";

interface Props {
  onSendMessage: (payload: { text: string; es_foto?: boolean; archivo_url?: string; es_ubicacion?: boolean; ubicacion_usuario?: { lat: number; lon: number }; action?: string }) => void;
  isTyping: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  onTypingChange?: (typing: boolean) => void;
}

const PLACEHOLDERS = [
  "Escribí tu mensaje...",
  "¿En qué puedo ayudarte hoy?",
  "Probá: '¿Qué hace Chatboc?'",
  "¿Cuánto cuesta el servicio?",
];

const ChatInput: React.FC<Props> = ({ onSendMessage, isTyping, inputRef, onTypingChange }) => {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const internalRef = inputRef || useRef<HTMLInputElement>(null);
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();

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
    onTypingChange?.(false);
    internalRef.current?.focus();
  };

  // --- LÓGICA PARA ARCHIVOS Y UBICACIÓN: AHORA ENVÍAN MENSAJE SOLO CUANDO EL DATO ESTÁ LISTO ---
  // Este callback es llamado por AdjuntarArchivo CUANDO el archivo ya se SUBIÓ y tenemos su URL, nombre, tipo y tamaño
  const handleFileUploaded = async (data: { url: string; name: string; mimeType: string; size: number; }) => {
    if (isTyping || !data || !data.url || !data.name) {
      toast({ title: "Error de subida", description: "No se pudo obtener la información completa del archivo subido.", variant: "destructive" });
      return;
    }

    const fileExtension = data.name.split('.').pop()?.toLowerCase();
    // Determinar si es una imagen basado en mimeType o extensión para el flag 'es_foto' (si aún se necesita)
    const isImage = data.mimeType?.startsWith('image/') || (fileExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension));

    onSendMessage({
      text: `Archivo adjunto: ${data.name}`, // Texto más descriptivo
      // es_foto: isImage, // Hacerlo dinámico, o eliminar si el backend ya no lo necesita y usa mimeType
      archivo_url: data.url, // Mantener por retrocompatibilidad o si el backend lo usa específicamente
      attachmentInfo: { // Enviar la información completa del adjunto
        name: data.name,
        url: data.url,
        mimeType: data.mimeType,
        size: data.size
      }
    });
    setInput("");
    onTypingChange?.(false);
    toast({ title: "Archivo enviado", description: `${data.name} ha sido adjuntado.`, duration: 3000 });
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
    onTypingChange?.(false);
  };

  // Enviar el texto dictado automáticamente cuando finaliza el reconocimiento
  useEffect(() => {
    if (!listening && transcript) {
      onSendMessage({ text: transcript.trim() });
      setInput("");
      onTypingChange?.(false);
      internalRef.current?.focus();
    }
  }, [listening, transcript]);
  // -------------------------------------------------------------------------


  return (
    <div className="w-full flex items-center gap-1 sm:gap-2 px-2 py-2 sm:px-3 sm:py-3 bg-background"> {/* Adjusted padding for sm:py-3 and added bg-background */}
      {/* Botón para adjuntar archivos */}
      <AdjuntarArchivo onUpload={handleFileUploaded} />

      {/* Botón para compartir ubicación */}
      <button
        onClick={handleShareLocation}
        disabled={isTyping}
        className={`
          flex items-center justify-center
          rounded-full p-2 sm:p-2.5
          shadow-md transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
          active:scale-95

          bg-secondary text-secondary-foreground hover:bg-secondary/80

          ${isTyping ? "opacity-50 cursor-not-allowed" : ""}
        `}
        aria-label="Compartir ubicación"
        type="button"
      >
        <MapPin className="w-5 h-5" />
      </button>

      {/* Botón de dictado por voz */}
      <button
        onClick={() => {
          if (listening) {
            stop();
          } else {
            if (!supported) {
              toast({ title: "Dictado no soportado", description: "Tu navegador no admite reconocimiento de voz", variant: "destructive" });
              return;
            }
            start();
          }
        }}
        disabled={isTyping}
        className={`
          flex items-center justify-center
          rounded-full p-2 sm:p-2.5
          shadow-md transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
          active:scale-95

          bg-secondary text-secondary-foreground hover:bg-secondary/80

          ${isTyping ? "opacity-50 cursor-not-allowed" : ""}
          ${listening ? "text-destructive bg-destructive/20 hover:bg-destructive/30" : ""}
        `}
        aria-label={listening ? "Detener dictado" : "Dictar mensaje"}
        type="button"
      >
        {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      <input
        ref={internalRef}
        className={`
          flex-1 max-w-full min-w-0
          rounded-full px-4 py-2 sm:px-4 sm:py-2.5 {/* Adjusted padding */}
          text-base
          outline-none transition-all duration-200
          focus:ring-2 focus:ring-primary/50 focus:border-transparent
          placeholder:text-muted-foreground
          font-medium
          disabled:cursor-not-allowed
          
          bg-input text-foreground
          border border-border
          
          dark:bg-input dark:text-foreground dark:border-border /* Explicit dark mode for input */

          ${isTyping ? "opacity-60 bg-muted-foreground/10 dark:bg-muted-foreground/20" : ""}
        `}
        type="text"
        placeholder={PLACEHOLDERS[placeholderIndex]}
        value={input}
        onChange={(e) => {
          const val = e.target.value;
          setInput(val);
          onTypingChange?.(val.trim().length > 0);
        }}
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
          rounded-full p-2.5 sm:p-3 ml-1 sm:ml-2 {/* Adjusted padding and margin */}
          shadow-md transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
          active:scale-95

          bg-primary text-primary-foreground hover:bg-primary/90

          disabled:opacity-50 disabled:cursor-not-allowed
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