// src/components/ChatHeader.tsx
import React from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

const ChatHeader: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between p-3 border-b bg-blue-50">
      <div className="flex items-center gap-2">
        <img
  src="/chatboc_widget_white_outline.png"
  alt="Chatboc"
  className="w-8 h-8 rounded"
  style={{ backgroundColor: "#E0F0FF", padding: "2px" }}
/>

        <div className="flex flex-col text-sm leading-tight">
          <span className="font-bold text-blue-800">Chatboc</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-green-600 text-xs font-semibold">● Online</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
