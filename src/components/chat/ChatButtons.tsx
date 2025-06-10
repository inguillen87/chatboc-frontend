// src/components/chat/ChatButtons.tsx
import React from 'react';

// Definición de la interfaz BotonProps, ahora incluyendo 'url' y 'accion_interna'
interface BotonProps {
  texto: string;
  payload?: string; // Para los botones que envían un valor específico al bot
  url?: string;     // <<<<<<<<<<<<<< AÑADIDO: Para botones que son enlaces
  accion_interna?: string; // <<<<<<<<<<<<<< AÑADIDO: Para acciones internas del bot
}

interface ChatButtonsProps {
  botones: BotonProps[];
}

const ChatButtons: React.FC<ChatButtonsProps> = ({ botones }) => {
  if (!botones || botones.length === 0) {
    return null;
  }

  const handleButtonClick = (valueToSend: string) => {
    // Disparamos un evento global que las páginas de chat escucharán
    // y que tu ChatWidget debería estar escuchando para llamar a handleSendMessage
    window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: valueToSend }));
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2 justify-start">
      {botones.map((boton, index) => (
        <React.Fragment key={index}>
          {boton.url ? (
            // Si el botón tiene una URL, renderizamos un enlace <a>
            <a
              href={boton.url}
              target="_blank" // Abre en una nueva pestaña
              rel="noopener noreferrer" // Buena práctica de seguridad
              className="px-4 py-2 bg-blue-500/80 text-white rounded-full text-sm font-semibold hover:bg-blue-600 transition-all duration-200"
              // Puedes ajustar los estilos para que coincidan con tus otros botones
            >
              {boton.texto}
            </a>
          ) : (
            // Si el botón NO tiene una URL, renderizamos un <button> que dispara un evento
            <button
              onClick={() => handleButtonClick(boton.payload || boton.accion_interna || boton.texto)}
              className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold hover:bg-primary/20 transition-all duration-200"
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