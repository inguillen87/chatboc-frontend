
import React from 'react';
import { Message } from '@/types/chat';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
 if (message.text === '__cta__') {
  return (
    <div className="flex justify-center mt-2">
      <div className="text-center space-y-2">
        <button
          onClick={() => window.location.href = '/demo'}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Usar Chatboc en mi empresa
        </button>
        <button
          onClick={() =>
            window.open(
              'https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.',
              '_blank'
            )
          }
          className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition"
        >
          Hablar por WhatsApp
        </button>
      </div>
    </div>
  );
}
 
  return (
    <div 
      className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}
    >
      <div 
        className={`max-w-[80%] p-3 rounded-lg ${
          message.isBot 
            ? "bg-blue-100 text-gray-800" 
            : "bg-blue-600 text-white"
        }`}
      >
        <p className="text-sm">{message.text}</p>
        <p className="text-xs mt-1 opacity-70">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
