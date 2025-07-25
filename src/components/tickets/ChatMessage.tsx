import React from 'react';
import { Message, Ticket } from '@/types/tickets';

interface ChatMessageProps {
  message: Message;
  user: Ticket;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, user }) => {
  // Mostrar quién envió el mensaje
  const isAdmin = message.es_admin;

  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-lg px-3 py-2 max-w-lg text-sm`}
        style={{
          background: isAdmin ? '#2563eb' : '#f3f4f6',
          color: isAdmin ? '#fff' : '#222',
        }}
      >
        {message.mensaje || message.text}
        {/* Si hay archivo adjunto */}
        {message.attachment && (
          <div className="mt-2">
            <a href={message.attachment.url} target="_blank" rel="noopener noreferrer">
              Archivo adjunto
            </a>
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-1">
          {new Date(message.fecha).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
