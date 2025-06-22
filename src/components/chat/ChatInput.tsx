import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

interface Props {
  onSendMessage: (text: string) => void;
  isTyping: boolean; // <-- NUEVO: Para deshabilitar el input si el bot está escribiendo
}

const PLACEHOLDERS = [
  "Escribí tu mensaje...",
  "¿En qué puedo ayudarte hoy?",
  "Probá: '¿Qué hace Chatboc?'",
  "¿Cuánto cuesta el servicio?",
];

const ChatInput: React.FC<Props> = ({ onSendMessage, isTyping }) => { // <-- Recibimos isTyping
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
    if (!input.trim() || isTyping) return; // <-- No enviar si el bot está escribiendo
    onSendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-[460px] mx-auto flex items-center gap-2 px-3 py-2"> {/* Quitamos border-t, bg-card, backdrop-blur-md, ya están en ChatPage */}
      <input
        ref={inputRef}
        className={`
          flex-1 max-w-full min-w-0
          rounded-full px-4 py-2
          text-base
          outline-none transition-all duration-200
          focus:border-primary focus:ring-2 focus:ring-primary/50
          placeholder:text-muted-foreground // Usar placeholder:text-muted-foreground
          font-medium
          disabled:cursor-not-allowed // <-- Cursor de no permitido cuando está deshabilitado
          
          // COLORES DEL INPUT:
          bg-input // Usa bg-input de tu tema base
          text-foreground // Color del texto del input
          border border-input // Borde del input
          
          // MODO OSCURO:
          dark:bg-[#1a1a1a] // Fondo del input en modo oscuro
          dark:text-gray-100 // Color del texto en modo oscuro
          dark:placeholder-gray-400 // Color del placeholder en modo oscuro
          dark:border-[#333a4d] // Color del borde en modo oscuro

          // EFECTOS DE DESHABILITADO:
          ${isTyping ? "opacity-60 bg-muted-foreground/10" : ""} // Efecto visual cuando isTyping es true
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
        disabled={isTyping} // <-- Deshabilitar input si el bot está escribiendo
      />
      <button
        className={`
          flex items-center justify-center
          rounded-full p-2.5 ml-1
          shadow-xl transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/60
          active:scale-95

          // COLORES DEL BOTÓN:
          bg-primary hover:bg-primary/90 // Fondo del botón y hover
          text-primary-foreground // Color del ícono del botón
          dark:bg-blue-600 dark:hover:bg-blue-700 // Colores en modo oscuro

          // EFECTOS DE DESHABILITADO:
          ${!input.trim() || isTyping ? "opacity-50 cursor-not-allowed" : ""} // Más opaco y cursor de no permitido si no hay texto o el bot está escribiendo
        `}
        onClick={handleSend}
        disabled={!input.trim() || isTyping} // <-- Deshabilitar botón si no hay texto o el bot está escribiendo
        aria-label="Enviar mensaje"
        type="button"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ChatInput;