import React from 'react';
import type { ChatUiMessage } from './chatTypes';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

const renderMessageText = (text: string) =>
  text.split('\n').map((line, lineIndex) => (
    <React.Fragment key={`line-${lineIndex}`}>
      {line.split(URL_PATTERN).map((part, partIndex) => {
        if (!part.startsWith('http://') && !part.startsWith('https://')) {
          return <React.Fragment key={`text-${lineIndex}-${partIndex}`}>{part}</React.Fragment>;
        }
        return (
          <a
            key={`url-${lineIndex}-${partIndex}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all font-medium text-primary underline underline-offset-2"
          >
            {part}
          </a>
        );
      })}
      {lineIndex < text.split('\n').length - 1 ? <br /> : null}
    </React.Fragment>
  ));

export default function ChatMessageList({ messages }: { messages: ChatUiMessage[] }) {
  return (
    <div className="space-y-2" aria-label="Lista de mensajes">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`whitespace-pre-wrap break-words rounded-lg p-2 text-sm leading-5 ${message.role === 'assistant' ? 'bg-muted/40' : 'bg-primary/10'}`}
        >
          {renderMessageText(message.text)}
        </div>
      ))}
    </div>
  );
}
