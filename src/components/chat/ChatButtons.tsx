// components/chat/ChatButtons.tsx
import React from 'react';

// Renombré la interfaz para que coincida con lo que envía la API (title en vez de texto)
interface BotonProps {
  title: string;
  payload?: string;
}

interface ChatButtonsProps {
  botones: BotonProps[];
  onButtonClick: (payload: string) => void;
}

const ChatButtons: React.FC<ChatButtonsProps> = ({ botones, onButtonClick }) => {
  if (!botones || botones.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 flex flex-wrap gap-2">
      {botones.map((boton, index) => (
        <button
          key={index}
          onClick={() => onButtonClick(boton.payload || boton.title)}
          // ✅ ESTILOS MEJORADOS CON DARK MODE
          className="px-3 py-1 bg-white/80 dark:bg-blue-800/90 backdrop-blur-sm text-blue-800 dark:text-blue-100 text-sm rounded-full hover:bg-white dark:hover:bg-blue-700 transition-all shadow-sm font-medium"
        >
          {boton.title} {/* Usamos title para coincidir con la API */}
        </button>
      ))}
    </div>
  );
};

export default ChatButtons;