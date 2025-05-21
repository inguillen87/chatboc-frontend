import React from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

const ChatHeader: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between p-3 border-b bg-blue-50 dark:bg-blue-900 dark:border-blue-800">
      <div className="flex items-center gap-3">
        <img
          src="/chatboc_logo_clean_transparent.png"
          alt="Chatboc Logo"
          className="w-9 h-9 rounded-full p-1"
          style={{
            backgroundColor: "transparent",
            filter: "drop-shadow(0 0 2px rgba(0,0,0,0.2))",
          }}
        />

        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-blue-900 dark:text-white">
            Chatboc
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-300">
            Asistente Virtual
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="text-green-600 text-xs font-semibold"
          aria-label="Estado del bot: Online"
        >
          ● Online
        </span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition"
          aria-label="Cerrar chat"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
