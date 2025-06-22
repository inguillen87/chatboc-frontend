import React, { forwardRef } from 'react';
import { getCurrentTipoChat } from '@/utils/tipoChat';
import ChatMessagePyme from './ChatMessagePyme';
import ChatMessageMunicipio from './ChatMessageMunicipio';
import { Message } from '@/types/chat';

export interface ChatMessageProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: string) => void;
  tipoChat?: 'pyme' | 'municipio';
  query?: string;
}

// Habilitás forwardRef para animaciones o scroll.
const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ tipoChat = getCurrentTipoChat(), ...props }, ref) => {
    const Component = tipoChat === 'municipio' ? ChatMessageMunicipio : ChatMessagePyme;
    // Pasa el ref al mensaje (por si querés animar, hacer scroll, etc.)
    return <Component {...props} ref={ref} />;
  }
);

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
