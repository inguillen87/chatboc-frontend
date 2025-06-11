import React from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

const ChatHeader: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
      <div className="flex items-center gap-3">
        {/* LOGO PNG con fondo y bien redondo */}
        <div className="w-10 h-10 rounded-full bg-white/95 dark:bg-[#181f2a] flex items-center justify-center shadow border border-white/80 dark:border-[#232a38]">
          <img
            src="/favicon/favicon-512x512.png"
            alt="Chatboc"
            className="w-7 h-7"
            style={{ objectFit: "contain" }}
          />
        </div>
        <div className="flex flex-col leading-tight ml-1">
          <span className="text-base font-semibold tracking-tight">
            Chatboc
          </span>
          <span className="text-xs text-muted-foreground -mt-0.5">Asistente Virtual</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-green-500 text-xs font-bold">● Online</span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Cerrar chat"
        >
          <X size={22} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
