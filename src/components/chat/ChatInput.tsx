// src/components/chat/ChatInput.tsx
import React, { useState, useEffect, useRef } from "react";
import { Send, MapPin, Mic, MicOff } from "lucide-react";
import AdjuntarArchivo from "@/components/ui/AdjuntarArchivo";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";
import { AttachmentInfo } from "@/utils/attachment";
import { SendPayload } from "@/types/chat"; // Asegúrate que SendPayload en types/chat.ts tiene attachmentInfo

interface Props {
  onSendMessage: (payload: SendPayload) => void;
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
    onSendMessage({ text: input.trim(), attachmentInfo: undefined }); // Envía attachmentInfo como undefined para solo texto
    setInput("");
    onTypingChange?.(false);
    internalRef.current?.focus();
  };

  // --- LÓGICA PARA ARCHIVOS Y UBICACIÓN: AHORA ENVÍAN MENSAJE SOLO CUANDO EL DATO ESTÁ LISTO ---
  // Este callback es llamado por AdjuntarArchivo CUANDO el archivo ya se SUBIÓ.
  // 'data' es la respuesta del backend /archivos/subir.
  // Respuesta actual del backend: { filename: string, mensaje: string, url: string }
  const handleFileUploaded = async (data: { url: string; filename: string; mimeType?: string; size?: number; [key: string]: any; }) => {
    // Validar campos mínimos esperados de la respuesta del backend (url y filename)
    if (isTyping || !data || !data.url || !data.filename) {
      toast({ title: "Error de subida", description: "La información del archivo subido está incompleta.", variant: "destructive" });
      return;
    }

    // El nombre original del archivo no está disponible desde el backend actual. Usamos data.filename.
    const name = data.filename;
    // mimeType y size no son provistos por el backend actual, serán undefined.
    // deriveAttachmentInfo en el frontend intentará deducir el tipo por la extensión.
    const mimeType = data.mimeType; // Será undefined si el backend no lo envía
    const size = data.size;         // Será undefined si el backend no lo envía

    onSendMessage({
      text: `Archivo adjunto: ${name}`, // Usar el nombre disponible (filename del servidor)
      archivo_url: data.url,
      attachmentInfo: {
        name: name,
        url: data.url,
        mimeType: mimeType, // Pasará undefined si no viene del backend
        size: size          // Pasará undefined si no viene del backend
      }
    });
    setInput(""); // Limpiar input de texto, ya que el archivo se envía como un mensaje separado
    onTypingChange?.(false);
    toast({ title: "Archivo enviado", description: `${name} ha sido adjuntado.`, duration: 3000 });
  };

  const handleShareLocation = async () => {
    if (isTyping) return;
    toast({ title: "Obteniendo ubicación...", description: "Por favor, acepta la solicitud de GPS.", duration: 2000 });
    try {
      const coords = await requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      if (coords) {
        onSendMessage({
          text: "Ubicación compartida",
          es_ubicacion: true,
          ubicacion_usuario: { lat: coords.latitud, lon: coords.longitud }
        });
        toast({ title: "Ubicación enviada", description: "Tu ubicación ha sido compartida.", duration: 3000 });
      } else {
        toast({ title: "Ubicación no disponible", description: "No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https).", variant: "destructive", duration: 5000 });
      }
    } catch (error) {
      console.error("Error al obtener ubicación:", error);
      toast({ title: "Error al obtener ubicación", description: "Hubo un problema al intentar obtener tu ubicación.", variant: "destructive", duration: 5000 });
    }
    setInput("");
    onTypingChange?.(false);
  };

  useEffect(() => {
    if (!listening && transcript) {
      onSendMessage({ text: transcript.trim() });
      setInput("");
      onTypingChange?.(false);
      internalRef.current?.focus();
    }
  }, [listening, transcript]);

  return (
    <div className="w-full flex items-center gap-1 sm:gap-2 px-2 py-2 sm:px-3 sm:py-3 bg-background">
      <AdjuntarArchivo onUpload={handleFileUploaded} />
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
          rounded-full px-4 py-2 sm:px-4 sm:py-2.5
          text-base
          outline-none transition-all duration-200
          focus:ring-2 focus:ring-primary/50 focus:border-transparent
          placeholder:text-muted-foreground
          font-medium
          disabled:cursor-not-allowed
          bg-input text-foreground
          border border-border
          dark:bg-input dark:text-foreground dark:border-border
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
          rounded-full p-2.5 sm:p-3 ml-1 sm:ml-2
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