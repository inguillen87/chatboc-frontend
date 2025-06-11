import React from "react";
import { X } from "lucide-react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

interface Props {
  onClose: () => void;
}

const ChatHeader: React.FC<Props> = ({ onClose }) => (
  <div className="flex items-center justify-between p-3 border-b border-border bg-primary text-primary-foreground">
    <div className="flex items-center gap-3">
      <span className="rounded-full bg-transparent flex items-center justify-center">
        <ChatbocLogoAnimated size={36} smiling={true} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">Chatboc</span>
        <span className="text-xs text-muted-foreground">Asistente Virtual</span>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-green-500 text-xs font-semibold" aria-label="Online">● Online</span>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground transition"
        aria-label="Cerrar chat"
      >
        <X size={18} />
      </button>
    </div>
  </div>
);

export default ChatHeader;
