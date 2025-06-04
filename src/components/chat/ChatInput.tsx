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
    <div className="w-full max-w-[420px] mx-auto flex items-center gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-[#15171b]/80 backdrop-blur-md">
      <input
        ref={inputRef}
        className="
          flex-1 max-w-full min-w-0
          bg-white/70 dark:bg-[#23272e]/70
          border border-gray-200 dark:border-[#262a31]
          rounded-full px-4 py-2
          text-base text-gray-900 dark:text-gray-100 
          outline-none transition-all duration-200
          focus:border-blue-500 dark:focus:border-blue-400 focus:shadow-[0_0_0_2px_#3b82f680]
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          shadow-sm
          font-medium
          disabled:bg-gray-100 dark:disabled:bg-gray-800
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
          bg-gradient-to-tr from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800
          text-white rounded-full p-2.5 ml-1
          shadow-xl transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-blue-400
          disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
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
