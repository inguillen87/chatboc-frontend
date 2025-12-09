import React from "react";
import { motion } from "framer-motion";

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
      className="absolute bottom-0 right-[calc(100%+1rem)] mb-4 cursor-pointer group"
      initial={{ opacity: 0, x: 20 }}
      animate={{
        opacity: 1,
        x: 0,
        transition: { type: "spring", stiffness: 280, damping: 25, delay: 0.2 }
      }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.2, ease: "easeOut" } }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      role="alert"
      aria-live="polite"
      style={{
        animation: 'float 3s ease-in-out infinite',
      }}
    >
      <div
        className="relative bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg font-semibold transition-colors duration-300"
        style={{
            boxShadow: 'var(--shadow)',
            animation: 'pulse-shadow 3s ease-in-out infinite',
        }}
      >
        <span className="block">{message}</span>
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 transition-colors duration-300"
          style={{
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderLeft: '16px solid hsl(var(--primary))',
          }}
        />
      </div>
    </motion.div>
  );
};

export default ProactiveBubble;
