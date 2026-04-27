import React from 'react';
import type { ChatUiMessage } from './chatTypes';

export default function ChatMessageList({ messages }: { messages: ChatUiMessage[] }) {
  return (
    <div className="space-y-2" aria-label="Lista de mensajes">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-lg p-2 text-sm ${message.role === 'assistant' ? 'bg-muted/40' : 'bg-primary/10'}`}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
}
