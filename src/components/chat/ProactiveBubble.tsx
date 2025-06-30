import React from "react";
import { motion } from "framer-motion";
// import { MessageSquareHeart, Sparkles } from "lucide-react"; // Iconos alternativos si se prefiere
import ChatbocLogoAnimated from "./ChatbocLogoAnimated"; // Usar el logo del bot

interface ProactiveBubbleProps {
  message: string;
  onClick: () => void;
  visible: boolean;
}

const ProactiveBubble: React.FC<ProactiveBubbleProps> = ({
  message,
  onClick,
  visible,
}) => {
  if (!visible) return null;

  return (
    <motion.div
      key="proactive-bubble"
      className="absolute bottom-full right-0 mb-3 flex items-end gap-2 cursor-pointer group" // Añadido group para hover effects
      initial={{ opacity: 0, y: 30, scale: 0.8 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 280, damping: 20, delay: 0.2 }
      }}
      exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.2, ease: "easeOut" } }}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 300, damping: 15 } }} // Ligero lift al hacer hover
      onClick={onClick}
      role="alert"
      aria-live="polite"
    >
      {/* Contenedor del mensaje y el rabito */}
      <div className="relative">
        <div
          className="bg-background dark:bg-slate-800 text-foreground dark:text-slate-100 px-4 py-3 rounded-xl shadow-xl border border-border dark:border-slate-700 max-w-xs text-base font-medium leading-relaxed" // text-base, leading-relaxed, py-3
          // style={{ borderRadius: "12px" }} // Ya tenemos rounded-xl que es 12px con el nuevo --radius
        >
          {message}
        </div>
        {/* Rabito de la burbuja - más integrado y estilizado */}
        <div
          className="absolute right-[18px] -bottom-[7px] w-4 h-4 bg-background dark:bg-slate-800 border-r border-b border-border dark:border-r-slate-700 dark:border-b-slate-700 transform rotate-45 shadow-sm"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 100%)"
          }}
        />
      </div>

      {/* Icono/Avatar del Bot al lado de la burbuja */}
      <motion.div
        className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-background dark:border-slate-800"
        initial={{ scale: 0, opacity: 0, x: 10 }}
        animate={{ scale: 1, opacity: 1, x: 0, transition: { type: "spring", stiffness: 260, damping: 18, delay: 0.4 } }}
      >
        <ChatbocLogoAnimated size={30} blinking /> {/* Aumentado a size={30} */}
      </motion.div>
    </motion.div>
  );
};

export default ProactiveBubble;
