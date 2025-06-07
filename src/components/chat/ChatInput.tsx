import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

interface Props {
  onSendMessage: (text: string) => void;
}

const PLACEHOLDERS = [
  "Escribí tu mensaje...",
  "¿En qué puedo ayudarte hoy?",
  "Probá: '¿Qué hace Chatboc?'",
  "¿Cuánto cuesta el servicio?",
];

const ChatInput: React.FC<Props> = ({ onSendMessage }) => {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animación de placeholder (carousel)
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Enviar mensaje
  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  };

  return (
    // Contenedor principal del input
    // bg-card debería ser tu color de fondo para tarjetas (claro en light, oscuro en dark)
    // border-border para el borde superior
    <div className="w-full max-w-[420px] mx-auto flex items-center gap-2 px-3 py-2 border-t border-border bg-card backdrop-blur-md">
      <input
        ref={inputRef}
        className="
          flex-1 max-w-full min-w-0
          // MODIFICADO: Aseguramos que el fondo del input (bg-input) y el borde (border-input)
          // se adapten al modo oscuro.
          // El texto del input y el placeholder usan text-foreground y placeholder:text-muted-foreground
          // que se adaptarán automáticamente a claro/oscuro.
          bg-input
          border border-input
          rounded-full px-4 py-2
          text-base text-foreground
          outline-none transition-all duration-200
          focus:border-primary focus:ring-2 focus:ring-primary/50
          placeholder:text-muted-foreground
          font-medium
          disabled:bg-muted disabled:text-muted-foreground
        "
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
      />
      <button
        className={`
          flex items-center justify-center
          // MODIFICADO: Colores del botón de enviar
          // bg-primary y text-primary-foreground aseguran adaptación al tema principal.
          bg-primary hover:bg-primary/90
          text-primary-foreground rounded-full p-2.5 ml-1
          shadow-xl transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/60
          disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
          active:scale-95
        `}
        onClick={handleSend}
        disabled={!input.trim()}
        aria-label="Enviar mensaje"
        type="button"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ChatInput;