import { APP_TARGET } from '@/config';
import ChatMessagePyme from './ChatMessagePyme';
import ChatMessageMunicipio from './ChatMessageMunicipio';

const ChatMessage = APP_TARGET === 'municipio' ? ChatMessageMunicipio : ChatMessagePyme;
export default ChatMessage;
