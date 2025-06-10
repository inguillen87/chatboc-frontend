// src/components/chat/ChatButtons.tsx
import React from 'react';

interface BotonProps {
  texto: string;
  payload?: string;
}

interface ChatButtonsProps {
  botones: BotonProps[];
}

const ChatButtons: React.FC<ChatButtonsProps> = ({ botones }) => {
  if (!botones || botones.length === 0) {
    return null;
  }

  const handleButtonClick = (payload: string) => {
    // Disparamos un evento global que las páginas de chat escucharán
    window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: payload }));
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2 justify-start">
      {botones.map((boton, index) => (
        <button
          key={index}
          onClick={() => handleButtonClick(boton.payload || boton.texto)}
          className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold hover:bg-primary/20 transition-all duration-200"
        >
          {boton.texto}
        </button>
      ))}
    </div>
  );
};

export default ChatButtons;