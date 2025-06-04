import React, { useState, useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react"; // Cambiado a SendHorizontal, que es un nombre más común. Verifica si es 'Send' o 'SendHorizonal' en tu proyecto.

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

  // Animación simple para el placeholder
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
    // Contenedor del input y botón. El padding y borde superior son opcionales,
    // ajústalos si el ChatWidget.tsx no los provee ya.
    <div className="flex items-center gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
      <input
        ref={inputRef}
        className="
          flex-1 bg-white dark:bg-[#1c1e24]
          border border-gray-300 dark:border-[#23272e]
          rounded-2xl px-4 py-2
          text-sm text-gray-900 dark:text-gray-100 
          outline-none transition
          focus:border-blue-500 dark:focus:border-blue-400
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          shadow-sm
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
      />
      <button
        className={`
          flex items-center justify-center
          bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-400
          text-white rounded-full p-2
          shadow-md transition
          disabled:bg-gray-300 dark:disabled:bg-gray-600
          disabled:cursor-not-allowed
        `}
        onClick={handleSend}
        disabled={!input.trim()}
        aria-label="Enviar"
        type="button"
      >
        <SendHorizontal className="w-5 h-5" /> {/* Asegúrate que el nombre del icono sea correcto */}
      </button>
    </div>
  );
};

export default ChatInput;