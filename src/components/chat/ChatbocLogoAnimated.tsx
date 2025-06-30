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
  const eyeBaseY = 24;
  const leftEyeX = Number(movingEyes ? 19 : 18); // Ensure numeric values
  const rightEyeX = Number(movingEyes ? 37 : 38); // Ensure numeric values

  const mouthPath = smiling
    ? "M18,35 Q28,46 38,35" // Wider, happier smile
    : "M20,36 Q28,40 36,36"; // Neutral mouth slightly adjusted

  return (
    <motion.div
      style={{
        width: size,
        height: size,
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
        src="/favicon/human-avatar.svg" // Human avatar base image
        alt="Chatboc"
        style={{
          width: size,
          height: size,
          display: "block",
        }}
        draggable={false}
      />
      <motion.svg
        width={size}
        height={size}
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
          cx={leftEyeX}
          cy={eyeBaseY}
          r={3.5} // Slightly smaller eyes
          fill="#FFFFFF" // Ensure high contrast, pure white
          animate={
            blinking
              ? { scaleY: [1, 0.05, 1], cx: leftEyeX, cy: eyeBaseY, transitionEnd: { scaleY: 1 } } // Quick blink, ensure cx/cy are defined
              : movingEyes
              ? { cy: [eyeBaseY, eyeBaseY - 1, eyeBaseY, eyeBaseY + 1, eyeBaseY], cx: [leftEyeX, leftEyeX +1, leftEyeX -1, leftEyeX, leftEyeX] } // More dynamic eye movement
              : { cy: eyeBaseY, cx: leftEyeX } // Static position
          }
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
          cx={rightEyeX}
          cy={eyeBaseY}
          r={3.5} // Slightly smaller eyes
          fill="#FFFFFF"
          animate={
            blinking
              ? { scaleY: [1, 0.05, 1], transitionEnd: { scaleY: 1 } } // Quick blink
              : movingEyes
              ? { cy: [eyeBaseY, eyeBaseY + 1, eyeBaseY, eyeBaseY - 1, eyeBaseY], cx: [rightEyeX, rightEyeX -1, rightEyeX + 1, rightEyeX, rightEyeX] } // More dynamic eye movement
              : { cy: eyeBaseY, cx: rightEyeX } // Static position
          }
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
