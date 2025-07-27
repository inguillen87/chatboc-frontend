// src/components/chat/ChatbocLogoAnimated.tsx

import React from "react";
import { motion } from "framer-motion";

const ChatbocLogoAnimated = ({
  size = 48,
  smiling = false,
  movingEyes = false,
  blinking = false,
  floating = false,
  pulsing = false,
  style = {},
}) => {
  const actualSize = Math.max(size, 1); // Asegurar que el tamaño no sea 0 o negativo

  const eyeBaseY = 24;
  const leftEyeX = movingEyes ? 19 : 18;
  const rightEyeX = movingEyes ? 37 : 38;

  const mouthPath = smiling
    ? "M18,35 Q28,46 38,35"
    : "M20,36 Q28,40 36,36";

  return (
    <div
      style={{
        width: actualSize,
        height: actualSize,
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      <img
        src="/favicon/favicon-512x512.png"
        alt="Chatboc"
        style={{
          width: actualSize,
          height: actualSize,
          display: "block",
        }}
        draggable={false}
      />
    </div>
  );
};

export default ChatbocLogoAnimated;
