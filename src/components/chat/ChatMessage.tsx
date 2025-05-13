
import React from 'react';
import { Message } from '@/types/chat';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
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
