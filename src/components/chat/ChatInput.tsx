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

  // data es la respuesta del backend /archivos/subir
  // Se espera: { url: string; filename: string; name?: string; mimeType?: string; size?: number; ... }
  const handleFileUploaded = async (data: { 
    url: string; 
    filename: string; // Nombre del archivo en el servidor
    name?: string;      // Nombre original del archivo (preferido)
    mimeType?: string;
    size?: number; 
    [key: string]: any; 
  }) => {
    if (isTyping || !data || !data.url || (!data.filename && !data.name)) {
      toast({ title: "Error de subida", description: "La información del archivo subido es incompleta.", variant: "destructive" });
      return;
    }

    const displayName = data.name || data.filename; // Priorizar nombre original si existe
    const mimeType = data.mimeType; 
    const size = data.size;        

    const currentAttachmentInfo: AttachmentInfo = {
      name: displayName,
      url: data.url,
      mimeType: mimeType, 
      size: size         
    };

    onSendMessage({
      text: `Archivo adjunto: ${displayName}`,
      archivo_url: data.url, // Legado, podría eliminarse si el backend ya no lo necesita
      attachmentInfo: currentAttachmentInfo
    });
    setInput(""); // Limpiar input de texto, ya que el archivo se envía como un mensaje separado
    onTypingChange?.(false);
    toast({ title: "Archivo enviado", description: `${displayName} ha sido adjuntado.`, duration: 3000 });
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