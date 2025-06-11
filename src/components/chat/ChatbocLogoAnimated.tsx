import React from "react";
import { motion } from "framer-motion";

interface Props {
  size?: number;
  smiling?: boolean; // true: sonrisa ancha, false: boca neutra
}

// Azul: #1876d1 (el que tenés en tu PNG)
const ChatbocLogoAnimated: React.FC<Props> = ({ size = 36, smiling = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 96 96"
    fill="none"
    style={{ display: "block" }}
  >
    {/* Fondo azul marino */}
    <circle cx="48" cy="48" r="48" fill="#1876d1" />
    {/* OJOS */}
    <ellipse cx="34" cy="43" rx="8" ry="8" fill="#fff" />
    <ellipse cx="62" cy="43" rx="8" ry="8" fill="#fff" />
    {/* BOCA animada */}
    <motion.path
      d={
        smiling
          ? "M32,64 Q48,80 64,64" // Sonrisa ancha
          : "M38,62 Q48,70 58,62" // Sonrisa suave (neutra)
      }
      stroke="#fff"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
      initial={false}
      animate={{ d: smiling
        ? "M32,64 Q48,80 64,64"
        : "M38,62 Q48,70 58,62"
      }}
      transition={{ duration: 0.2 }}
    />
  </svg>
);

export default ChatbocLogoAnimated;
