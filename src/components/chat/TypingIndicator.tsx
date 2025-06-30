import React from "react";
import { motion } from "framer-motion";

const LOGO_BOT = "/favicon/human-avatar.svg";

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2.5 justify-start">
    {/* Avatar del bot, bien integrado */}
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-card flex items-center justify-center border border-blue-100 dark:border-blue-800 shadow">
      <img
        src={LOGO_BOT}
        alt="Chatboc"
        className="w-7 h-7 object-contain"
      />
    </div>
    {/* Burbuja de puntos animados */}
    <motion.div
      className={`
        px-4 py-3 max-w-[320px] shadow-md relative
        bg-muted text-foreground rounded-b-2xl rounded-tr-2xl
        after:content-[''] after:absolute after:bottom-0
        after:left-[-8px] after:w-0 after:h-0 after:border-8 after:border-transparent
        after:border-t-muted after:border-r-muted
      `}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-end gap-1 h-6">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block w-2 h-2 rounded-full bg-primary dark:bg-primary/70"
            initial={{ y: 0, opacity: 0.6 }}
            animate={{
              y: [0, -5, 0],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 0.85,
              delay: i * 0.18,
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
