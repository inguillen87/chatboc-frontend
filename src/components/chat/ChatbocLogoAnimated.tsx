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
        width: actualSize, // Usar actualSize
        height: actualSize, // Usar actualSize
        position: "relative",
        display: "inline-block",
        ...style,
      }}
      animate={{
        rotate: smiling ? [0, 5, -5, 5, -5, 0] : 0, // More playful, quicker rotation
        y: floating ? [0, -3, 0, 1, 0] : 0, // Softer, more natural float
        scale: pulsing ? [1, 1.03, 1] : 1, // Subtler pulse
      }}
      transition={{
        rotate: smiling ? { duration: 0.7, ease: "easeInOut" } : {},
        y: floating
          ? {
              repeat: Infinity,
              duration: 2.5, // Slightly longer duration for float
              ease: "easeInOut",
              repeatType: "reverse",
            }
          : {},
        scale: pulsing
          ? {
              repeat: Infinity,
              duration: 1.8, // Slightly longer duration for pulse
              ease: "easeInOut",
              repeatType: "reverse",
            }
          : {},
      }}
    >
      <img
        src="/favicon/favicon-512x512.png" // Assuming this is the base character image
        alt="Chatboc"
        style={{
          width: actualSize, // Usar actualSize
          height: actualSize, // Usar actualSize
          display: "block",
        }}
        draggable={false}
      />
      <motion.svg
        width={actualSize} // Usar actualSize
        height={actualSize} // Usar actualSize
        viewBox="0 0 56 56" // ViewBox should match the design coordinates
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {/* Ojos */}
        <motion.circle
          cx={leftEyeX || 0} // Fallback si leftEyeX es undefined
          cy={eyeBaseY || 0}  // Fallback si eyeBaseY es undefined
          r={3.5} // Slightly smaller eyes
          fill="#FFFFFF" // Ensure high contrast, pure white
          animate={{ cx: leftEyeX, cy: eyeBaseY }}
          transition={
            blinking
              ? { repeat: Infinity, duration: 0.1, repeatDelay: Math.random() * 5 + 3, ease: "easeOut" } // Randomized blink delay
              : movingEyes
              ? { repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: Math.random() * 0.5 }
              : { duration: 0.2 }
          }
          style={{ transformOrigin: "center" }}
        />
        <motion.circle
          cx={rightEyeX || 0} // Fallback si rightEyeX es undefined
          cy={eyeBaseY || 0}  // Fallback si eyeBaseY es undefined
          r={3.5} // Slightly smaller eyes
          fill="#FFFFFF"
          animate={{ cx: rightEyeX, cy: eyeBaseY }}
          transition={
            blinking
              ? { repeat: Infinity, duration: 0.1, repeatDelay: Math.random() * 5 + 3.1, ease: "easeOut" } // Randomized blink delay, slightly offset
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
          strokeWidth={2.5} // Slightly thinner mouth stroke
          strokeLinecap="round"
          fill="none"
          transition={{ d: { duration: 0.25, ease: "easeInOut" } }} // Smoother transition for mouth shape
        />
      </motion.svg>
    </motion.div>
  );
};

export default ChatbocLogoAnimated;
