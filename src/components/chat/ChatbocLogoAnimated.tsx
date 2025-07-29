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
    <motion.div
      style={{
        width: actualSize,
        height: actualSize,
        position: "relative",
        display: "inline-block",
        ...style,
      }}
      animate={{
        rotate: smiling ? [0, 5, -5, 5, -5, 0] : 0,
        y: floating ? [0, -3, 0, 1, 0] : 0,
        scale: pulsing ? [1, 1.03, 1] : 1,
      }}
      transition={{
        rotate: smiling ? { duration: 0.7, ease: "easeInOut" } : {},
        y: floating
          ? {
              repeat: Infinity,
              duration: 2.5,
              ease: "easeInOut",
              repeatType: "reverse",
            }
          : {},
        scale: pulsing
          ? {
              repeat: Infinity,
              duration: 1.8,
              ease: "easeInOut",
              repeatType: "reverse",
            }
          : {},
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
      <motion.svg
        width={actualSize}
        height={actualSize}
        viewBox="0 0 56 56"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {/* Ojos */}
        <motion.circle
          cx={leftEyeX ?? 18}
          cy={eyeBaseY ?? 24}
          r={3.5}
          fill="#FFFFFF"
          animate={{ cx: leftEyeX ?? 18, cy: eyeBaseY ?? 24 }}
          transition={
            blinking
              ? { repeat: Infinity, duration: 0.1, repeatDelay: Math.random() * 5 + 3, ease: "easeOut" }
              : movingEyes
              ? { repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: Math.random() * 0.5 }
              : { duration: 0.2 }
          }
          style={{ transformOrigin: "center" }}
        />
        <motion.circle
          cx={rightEyeX ?? 38}
          cy={eyeBaseY ?? 24}
          r={3.5}
          fill="#FFFFFF"
          animate={{ cx: rightEyeX ?? 38, cy: eyeBaseY ?? 24 }}
          transition={
            blinking
              ? { repeat: Infinity, duration: 0.1, repeatDelay: Math.random() * 5 + 3.1, ease: "easeOut" }
              : movingEyes
              ? { repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: Math.random() * 0.5 + 0.1 }
              : { duration: 0.2 }
          }
          style={{ transformOrigin: "center" }}
        />
        {/* Boca */}
        <motion.path
          d={mouthPath}
          stroke="#FFFFFF"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          transition={{ d: { duration: 0.25, ease: "easeInOut" } }}
        />
      </motion.svg>
    </motion.div>
  );
};

export default ChatbocLogoAnimated;
