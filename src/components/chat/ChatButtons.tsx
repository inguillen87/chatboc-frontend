// src/components/chat/ChatButtons.tsx
import React from 'react';

interface BotonProps {
  texto: string;
  payload?: string;
  url?: string;
  accion_interna?: string;
}

interface ChatButtonsProps {
  botones: BotonProps[];
  onButtonClick: (valueToSend: string) => void; // Recibe la función de envío de mensajes
}

const ChatButtons: React.FC<ChatButtonsProps> = ({ botones, onButtonClick }) => {
  if (!botones || botones.length === 0) {
    return null;
  }

  // handleButtonClick ya no es un CustomEvent, llama directamente a la prop
  // const handleButtonClick = (valueToSend: string) => {
  //   window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: valueToSend }));
  // };

  return (
    <div className="mt-2 flex flex-wrap gap-2 justify-start"> 
      {botones.map((boton, index) => (
        <React.Fragment key={index}>
          {boton.url ? (
            <a
              href={boton.url}
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-3 py-1 text-sm rounded-full border border-blue-500 bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-200 cursor-pointer text-center"
            >
              {boton.texto}
            </a>
          ) : (
            <button
              onClick={() => {
                // Llama directamente a la función onButtonClick que viene de ChatMessage -> ChatWidget
                onButtonClick(boton.accion_interna || boton.payload || boton.texto);
              }}
              className="px-3 py-1 text-sm rounded-full border border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors duration-200 cursor-pointer text-center"
            >
              {boton.texto}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default ChatButtons;