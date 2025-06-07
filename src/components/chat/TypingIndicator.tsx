import React from "react";
import { motion } from "framer-motion";

// Ruta al favicon PNG
const LOGO_BOT = "/favicon/favicon-48x48.png";

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-3 px-3 py-2">
    {/* Logo animado con efecto de "respiración" para simular la boquita */}
    <motion.img
      src={LOGO_BOT}
      alt="Chatboc"
      // MODIFICADO: Fondo y borde adaptativos (como en sugerencias anteriores)
      className="w-8 h-8 rounded-full bg-card border border-border shadow"
      initial={{ scale: 0.95, opacity: 0.7 }}
      // MODIFICADO: Animación para mover verticalmente y simular "boca"
      animate={{ 
        scale: [0.95, 1.05, 0.95], // Sutilmente más grande
        opacity: [0.7, 1, 0.7],
        y: [0, -2, 0] // Mover ligeramente hacia arriba y abajo
      }}
      transition={{
        duration: 1.1,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.12))" }}
    />
    {/* Puntos animados */}
    <div className="flex items-end gap-1 h-6">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          // MODIFICADO: Colores de los puntos adaptativos (como en sugerencias anteriores)
          className="block w-2 h-2 rounded-full bg-primary dark:bg-primary/60" // Usar primary para un azul temático
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