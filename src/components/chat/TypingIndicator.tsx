import React from "react";
import { motion } from "framer-motion";

// Ruta al favicon PNG
const LOGO_BOT = "/favicon/favicon-48x48.png"; // Asegúrate de que esta ruta sea correcta

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-3 px-3 py-2">
    {/* Logo animado con efecto de "boquita" */}
    <motion.img
      src={LOGO_BOT}
      alt="Chatboc"
      className="w-8 h-8 rounded-full bg-card border border-border shadow" // Usando bg-card y border-border para adaptación al tema
      initial={{ scale: 0.95, opacity: 0.7 }}
      animate={{
        scale: [0.95, 1.05, 0.95], // Zoom in/out para simular la "respiración"
        opacity: [0.7, 1, 0.7],
        y: [0, -2, 0] // Movimiento sutil hacia arriba y abajo
      }}
      transition={{
        duration: 1.1,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.12))" }}
    />
    {/* Puntos animados del indicador de escritura */}
    <div className="flex items-end gap-1 h-6">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-2 h-2 rounded-full bg-primary dark:bg-primary/60" // bg-primary para un color temático
          initial={{ y: 0, opacity: 0.6 }}
          animate={{
            y: [0, -5, 0],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 0.85,
            delay: i * 0.22,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  </div>
);

export default TypingIndicator;