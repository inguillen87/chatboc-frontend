// src/components/chat/ChatbocLogoAnimated.tsx

import React from "react";
import { motion } from "framer-motion";

const ChatbocLogoAnimated = ({
  size = 48,
  smiling = false,
  movingEyes = false,
  style = {},
}) => {
  // Ajusta los valores para que coincidan con tu logo si lo ves raro
  const leftEye = movingEyes ? 20 : 18;
  const rightEye = movingEyes ? 36 : 34;
  const safeLeftEye = leftEye || 0;
  const safeRightEye = rightEye || 0;
  const mouthPath = smiling
    ? "M18,34 Q28,44 38,34"
    : "M20,34 Q28,38 36,34";

  return (
    <motion.div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-block",
        ...style,
      }}
      animate={smiling ? { rotate: [0, 8, -8, 0] } : {}}
      transition={{ duration: 0.8 }}
    >
      <img
        src="/favicon/favicon-512x512.png"
        alt="Chatboc"
        style={{
          width: size,
          height: size,
          display: "block",
        }}
        draggable={false}
      />
      {/* Capa de animación SVG encima */}
      <motion.svg
        width={size}
        height={size}
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
          cx={safeLeftEye}
          cy={24 || 0}
          r={4}
          fill="#fff"
          animate={movingEyes ? { cy: [24, 22, 24] } : undefined}
          transition={
            movingEyes ? { repeat: Infinity, duration: 1.5 } : undefined
          }
        />
        <motion.circle
          cx={safeRightEye}
          cy={24 || 0}
          r={4}
          fill="#fff"
          animate={movingEyes ? { cy: [24, 26, 24] } : undefined}
          transition={
            movingEyes
              ? { repeat: Infinity, duration: 1.5, delay: 0.2 }
              : undefined
          }
        />
        {/* Boca */}
        <motion.path
          d={mouthPath}
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          style={{ transition: "d 0.25s" }}
        />
      </motion.svg>
    </motion.div>
  );
};

export default ChatbocLogoAnimated;
