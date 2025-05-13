
import React from 'react';
import { X } from 'lucide-react';
import ChatbocLogo from '../ChatbocLogo';

interface ChatHeaderProps {
  onClose: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onClose }) => {
  return (
    <div className="bg-blue-600 text-white p-3 rounded-t-lg flex items-center">
      <ChatbocLogo size={28} className="mr-2" />
      <div>
        <h3 className="font-medium">Chatboc</h3>
        <p className="text-xs opacity-80">Asistente IA personalizado</p>
      </div>
      <button 
        onClick={onClose}
        className="ml-auto text-white hover:bg-blue-700 rounded-full p-1"
        aria-label="Cerrar chat"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ChatHeader;
