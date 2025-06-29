import React from "react";
import { motion } from "framer-motion";
import { MessageSquarePlus } from "lucide-react"; // O algún otro icono adecuado

interface ProactiveBubbleProps {
  message: string;
  onClick: () => void;
  onClose?: () => void; // Opcional, por si queremos cerrarlo manualmente
  visible: boolean;
}

const ProactiveBubble: React.FC<ProactiveBubbleProps> = ({
  message,
  onClick,
  onClose,
  visible,
}) => {
  if (!visible) return null;

  return (
    <motion.div
      key="proactive-bubble"
      className="absolute bottom-full right-0 mb-3 flex items-start gap-2 cursor-pointer"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      onClick={onClick}
      role="alert"
      aria-live="polite"
    >
      <div className="bg-background dark:bg-slate-700 text-foreground dark:text-slate-100 p-3 rounded-lg shadow-xl border border-border dark:border-slate-600 max-w-xs text-sm">
        {message}
      </div>
      {/* Opcional: un pequeño "rabito" para la burbuja estilo comic */}
      <div
        className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-background dark:border-t-slate-700 relative top-6 right-8 shadow-md"
        style={{ filter: "drop-shadow(2px 2px 1px rgba(0,0,0,0.05))" }}
      />
       {/* Icono opcional al lado o dentro de la burbuja */}
      {/* <MessageSquarePlus size={28} className="text-primary mt-1" /> */}
    </motion.div>
  );
};

export default ProactiveBubble;
