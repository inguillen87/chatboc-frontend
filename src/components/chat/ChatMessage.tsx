import React, { forwardRef } from 'react';
// import { getCurrentTipoChat } from '@/utils/tipoChat'; // Ya no es necesario aquí
import ChatMessageBase, { ChatMessageBaseProps } from './ChatMessageBase';
// Ya no importamos ChatMessagePyme ni ChatMessageMunicipio aquí

// La interfaz ChatMessageProps es la misma que ChatMessageBaseProps
// Solo la re-exportamos para mantener la consistencia si otros componentes la importaban.
export type ChatMessageProps = ChatMessageBaseProps;

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  (props, ref) => {
    // Simplemente pasamos todas las props a ChatMessageBase.
    // El `tipoChat` (si se necesita para alguna variación mínima no manejada por structuredContent)
    // ya está incluido en `props` y ChatMessageBase lo recibe.
    return <ChatMessageBase {...props} ref={ref} />;
  }
);

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;