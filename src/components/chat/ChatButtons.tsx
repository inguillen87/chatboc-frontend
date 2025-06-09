// components/chat/ChatButtons.tsx
import React from 'react';

interface BotonProps {
  texto: string;
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
    <div className="mt-2 flex flex-wrap gap-2 justify-start">
      {botones.map((boton, index) => (
        <button
          key={index}
          onClick={() => onButtonClick(boton.payload || boton.texto)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:bg-primary/90 transition-all"
        >
          {boton.texto}
        </button>
      ))}
    </div>
  );
};

export default ChatButtons;