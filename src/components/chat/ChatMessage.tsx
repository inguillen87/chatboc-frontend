import { APP_TARGET } from '@/config';
import ChatMessagePyme from './ChatMessagePyme';
import ChatMessageMunicipio from './ChatMessageMunicipio';
import { Message } from '@/types/chat';

export interface ChatMessageProps {
  message: Message;
  isTyping: boolean;
  onButtonClick: (valueToSend: string) => void;
  tipoChat?: 'pyme' | 'municipio';
}

const ChatMessage = ({ tipoChat = APP_TARGET, ...props }: ChatMessageProps) => {
  const Component =
    tipoChat === 'municipio' ? ChatMessageMunicipio : ChatMessagePyme;
  return <Component {...props} />;
};

export default ChatMessage;
