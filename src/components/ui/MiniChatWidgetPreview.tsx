import React from 'react';
import { MessageSquare, Send, Smile, Paperclip } from 'lucide-react';

const MiniChatWidgetPreview: React.FC = () => {
  return (
    <div className="bg-card p-3 rounded-lg shadow-lg border border-border w-full h-full flex flex-col max-w-xs mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
        <div className="flex items-center">
          <img src="/chatboc_widget_64x64.webp" alt="Chatboc" className="w-8 h-8 mr-2 rounded-full" />
          <div>
            <p className="text-sm font-semibold text-primary">Chatboc Demo</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>
        <div className="text-muted-foreground hover:text-primary cursor-pointer">
          {/* <X size={18} /> Could be an X icon */}
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow space-y-3 overflow-y-auto p-1 text-sm">
        {/* Bot Message */}
        <div className="flex items-end space-x-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs">
            B
          </div>
          <div className="bg-muted p-2.5 rounded-lg rounded-bl-none max-w-[75%]">
            <p>Hola! 👋 ¿Cómo puedo ayudarte hoy?</p>
          </div>
        </div>

        {/* User Message */}
        <div className="flex items-end justify-end space-x-2">
          <div className="bg-primary text-primary-foreground p-2.5 rounded-lg rounded-br-none max-w-[75%]">
            <p>Me gustaría saber más sobre sus servicios.</p>
          </div>
          {/* User avatar can be added here if desired */}
        </div>
        
        {/* Bot Message */}
        <div className="flex items-end space-x-2">
           <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs">
            B
          </div>
          <div className="bg-muted p-2.5 rounded-lg rounded-bl-none max-w-[75%]">
            <p>¡Claro! Ofrecemos...</p>
          </div>
        </div>

      </div>

      {/* Input Area */}
      <div className="pt-2 mt-2 border-t border-border">
        <div className="flex items-center bg-background rounded-lg p-1.5 border border-input">
          <Paperclip size={18} className="text-muted-foreground mx-1.5 cursor-pointer hover:text-primary" />
          <input
            type="text"
            placeholder="Escribe un mensaje..."
            className="flex-grow bg-transparent text-sm focus:outline-none px-2 text-muted-foreground"
            disabled
          />
          <Smile size={18} className="text-muted-foreground mx-1.5 cursor-pointer hover:text-primary" />
          <button className="p-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 ml-1">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniChatWidgetPreview;
