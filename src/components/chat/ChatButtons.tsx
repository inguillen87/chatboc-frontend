import React from "react";
import { motion } from "framer-motion";

// Ruta al favicon PNG (la que usarás para el TypingIndicator)
const LOGO_BOT = "/favicon/favicon-48x48.png"; // Asegúrate de que esta ruta sea correcta

const TypingIndicator: React.FC = () => (
  // Envolvemos el indicador en una burbuja para que se vea como si el bot estuviera "escribiendo" en su propia burbuja
  <div className="flex items-end gap-2.5 justify-start"> {/* Alineación a la izquierda como los mensajes del bot */}
    {/* Avatar del bot (similar al que aparece en ChatMessage) */}
    <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        className={`
            flex-shrink-0 w-10 h-10 rounded-full bg-card flex items-center justify-center 
            border-2 transition-all duration-200 ease-in-out
            border-blue-500 shadow-lg shadow-blue-500/50 scale-105 // Estilo de "escribiendo"
        `}
    >
        <img 
            src={LOGO_BOT}
            alt="Chatboc" 
            className="w-7 h-7 object-contain animate-pulse-subtle" // Usamos el pulso sutil aquí
        />
    </motion.div>

    {/* Contenedor de la burbuja del TypingIndicator */}
    <motion.div
      className={`
        px-4 py-3 max-w-[320px] shadow-md relative
        bg-muted text-foreground rounded-b-2xl rounded-tr-2xl dark:bg-[#333a4d] dark:text-gray-100 // Estilo de burbuja de bot
        after:content-[''] after:absolute after:bottom-0 
        after:left-[-8px] after:w-0 after:h-0 after:border-8 after:border-transparent after:border-t-muted after:border-r-muted dark:after:border-t-[#333a4d] dark:after:border-r-[#333a4d]
      `}
      initial={{ opacity: 0, y: 10, scale: 0.98 }} // Animación de entrada de la burbuja
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-end gap-1 h-6">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block w-2 h-2 rounded-full bg-primary dark:bg-primary/60"
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
    </motion.div>
  </div>
);

export default TypingIndicator;