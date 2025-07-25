import React, { forwardRef } from 'react';
import ChatMessageBase, { ChatMessageBaseProps } from '@/components/chat/ChatMessageBase';

export type ChatMessageProps = ChatMessageBaseProps;

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  (props, ref) => {
    return <ChatMessageBase {...props} ref={ref} />;
  }
);

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
