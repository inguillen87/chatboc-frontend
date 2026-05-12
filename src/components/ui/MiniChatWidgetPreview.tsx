import React from 'react';
import { Send, Smile, Paperclip } from 'lucide-react'; // MessageSquare no se usa aquí directamente
import { CHATBOC_ORBIT_AVATAR } from '@/utils/brandAssets';

const MiniChatWidgetPreview: React.FC = () => {
  return (
    <div className="bg-card p-3 rounded-lg shadow-md border border-border w-full h-full flex flex-col max-w-[280px] mx-auto min-h-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
        <div className="flex items-center">
          <img
            src={CHATBOC_ORBIT_AVATAR}
            alt="Chatboc Icon"
            className="w-7 h-7 mr-2 rounded-full border border-border"
          />
          <div>
            <p className="text-sm font-semibold text-primary">Asistente Virtual</p>
            <p className="text-xs text-green-500">En línea</p>
          </div>
        </div>
        {/* Close icon can be added here if needed */}
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow space-y-2.5 overflow-y-auto p-1 text-sm pr-2">
        {/* Bot Message */}
        <div className="flex items-start space-x-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs flex-shrink-0 mt-1">
            <img src={CHATBOC_ORBIT_AVATAR} alt="B" className="w-4 h-4 rounded-full" />
          </div>
          <div className="bg-muted p-2 rounded-lg rounded-bl-none max-w-[80%] shadow-sm">
            <p className="text-foreground">¡Hola! 👋 ¿En qué puedo ayudarte hoy?</p>
          </div>
        </div>

        {/* User Message */}
        <div className="flex items-start justify-end space-x-2">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg rounded-br-none max-w-[80%] shadow-sm">
            <p>Quisiera información sobre el Plan PRO.</p>
          </div>
          {/* User avatar can be added here if desired */}
        </div>

        {/* Bot Message */}
        <div className="flex items-start space-x-2">
           <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs flex-shrink-0 mt-1">
            <img src={CHATBOC_ORBIT_AVATAR} alt="B" className="w-4 h-4 rounded-full" />
          </div>
          <div className="bg-muted p-2 rounded-lg rounded-bl-none max-w-[80%] shadow-sm">
            <p className="text-foreground">¡Excelente elección! El Plan PRO incluye...</p>
          </div>
        </div>
         {/* Example of a slightly longer message */}
        <div className="flex items-start space-x-2">
           <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs flex-shrink-0 mt-1">
            <img src={CHATBOC_ORBIT_AVATAR} alt="B" className="w-4 h-4 rounded-full" />
          </div>
          <div className="bg-muted p-2 rounded-lg rounded-bl-none max-w-[80%] shadow-sm">
            <p className="text-foreground">También te permite integrar el widget directamente en tu sitio web.</p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="pt-2 mt-auto"> {/* mt-auto pushes this to the bottom */}
        <div className="flex items-center bg-background rounded-md p-1.5 border border-input shadow-sm">
          <button
            aria-label="Adjuntar archivo"
            className="p-1 text-muted-foreground hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary rounded"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            placeholder="Escribe tu mensaje..."
            className="flex-grow bg-transparent text-sm focus:outline-none px-1 text-foreground placeholder-muted-foreground"
            disabled
          />
          <button
            aria-label="Insertar emoji"
            className="p-1 text-muted-foreground hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary rounded"
          >
            <Smile size={18} />
          </button>
          {/* Send button removed as per user request */}
        </div>
      </div>
    </div>
  );
};

export default MiniChatWidgetPreview;
