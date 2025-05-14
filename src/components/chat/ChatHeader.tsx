import React from "react";
import { X } from "lucide-react";

interface ChatHeaderProps {
  onClose: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#f8fafc] rounded-t-lg">
      <div className="flex items-center space-x-2">
        <img
          src="/chatboc_widget_64x64.webp"
          alt="Chatboc"
          className="w-6 h-6"
        />
        <span className="text-sm font-semibold text-gray-800">
          Chatboc
        </span>
      </div>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-red-500 transition-colors"
        aria-label="Cerrar chat"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ChatHeader;
