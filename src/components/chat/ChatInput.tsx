import React, { useState, useEffect, useRef } from "react";
import { Send, MapPin } from "lucide-react"; // Importa MapPin para el botón de ubicación
import AdjuntarArchivo from "@/components/ui/AdjuntarArchivo"; // Este componente DEBERÍA manejar la subida y devolver la URL
import { requestLocation } from "@/utils/geolocation"; // Importa la función de geolocalización

interface Props {
  // onSendMessage ahora acepta un payload estructurado
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
    onSendMessage({ text: input.trim() }); // Envía un objeto SendPayload
    setInput("");
    inputRef.current?.focus();
  };

  // --- LÓGICA PARA ARCHIVOS Y UBICACIÓN ---
  // `data` es el objeto devuelto por `/archivos/subir`, esperamos que tenga `url`
  const handleFileUploaded = (data: { url: string; }) => { 
    if (isTyping || !data || !data.url) return; // No enviar si el bot está escribiendo o no hay URL
    onSendMessage({ text: "Foto adjunta", es_foto: true, archivo_url: data.url }); // Envía un mensaje con el adjunto
    setInput(""); // Limpia el input después de enviar el archivo
  };

  const handleShareLocation = async () => {
    if (isTyping) return;
    // setIsTyping(true); // Puedes activar un typing indicator mientras se obtiene la ubicación
    try {
      const coords = await requestLocation({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
      if (coords) {
        onSendMessage({
          text: "Ubicación compartida",
          es_ubicacion: true,
          // MODIFICADO: Asegúrate de que las claves sean 'lat' y 'lon' para el backend
          ubicacion_usuario: { lat: coords.latitud, lon: coords.longitud } 
        });
      } else {
        alert("No se pudo obtener tu ubicación. Asegúrate de tener los permisos activados y un GPS activo.");
        onSendMessage({ text: "Error al compartir ubicación" }); // Mensaje para el usuario si falla
      }
    } catch (error) {
      console.error("Error al obtener ubicación:", error);
      alert("Error al obtener tu ubicación.");
      onSendMessage({ text: "Error al compartir ubicación" }); // Mensaje para el usuario si falla
    } finally {
      // setIsTyping(false); // Ocultar typing indicator
    }
    setInput("");
  };
  // ---------------------------------------------


  return (
    <div className="w-full max-w-[460px] mx-auto flex items-center gap-2 px-3 py-2">
      {/* Botón para adjuntar archivos (delegamos la lógica de subida a AdjuntarArchivo) */}
      <AdjuntarArchivo onUpload={handleFileUploaded} /> 

      {/* Botón para compartir ubicación */}
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