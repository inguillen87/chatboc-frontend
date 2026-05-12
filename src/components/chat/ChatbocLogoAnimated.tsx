// src/components/chat/ChatbocLogoAnimated.tsx

import React from "react";
import { motion } from "framer-motion";

import { CHATBOC_ORBIT_AVATAR } from "@/utils/brandAssets";

interface ChatbocLogoAnimatedProps {
  size?: number;
  smiling?: boolean;
  movingEyes?: boolean;
  blinking?: boolean;
  floating?: boolean;
  pulsing?: boolean;
  style?: React.CSSProperties;
  src?: string | null;
  animation?: string;
}

const ChatbocLogoAnimated = ({
  size = 48,
  smiling = false,
  movingEyes = false,
  blinking = false,
  floating = false,
  pulsing = false,
  style = {},
  src,
  animation,
}: ChatbocLogoAnimatedProps) => {
  const actualSize = Math.max(size, 1);
  const resolvedSrc = src || CHATBOC_ORBIT_AVATAR;
  const isChatbocAvatar = resolvedSrc === CHATBOC_ORBIT_AVATAR;

  const getAnimationString = (anim: string | undefined) => {
    if (!anim || anim === "none") return undefined;
    if (anim === "pulse") return "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite";
    if (anim === "bounce") return "bounce 1s infinite";
    if (anim === "fade") return "fade-in 1s ease-out forwards";
    return anim;
  };

  const animationStyle = getAnimationString(animation);

  return (
    <motion.span
      aria-hidden="true"
      style={{
        width: actualSize,
        height: actualSize,
        position: "relative",
        display: "inline-grid",
        placeItems: "center",
        borderRadius: "50%",
        ...style,
      }}
      animate={{
        rotate: smiling ? [0, 3, -3, 2, -2, 0] : 0,
        y: floating ? [0, -3, 0, 1, 0] : 0,
        scale: pulsing ? [1, 1.035, 1] : 1,
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
        src={resolvedSrc}
        alt=""
        style={{
          width: actualSize,
          height: actualSize,
          display: "block",
          borderRadius: "50%",
          animation: animationStyle,
          objectFit: isChatbocAvatar ? "contain" : "cover",
          filter: isChatbocAvatar ? "drop-shadow(0 8px 18px rgba(15, 76, 220, 0.18))" : undefined,
        }}
        draggable={false}
      />
      {isChatbocAvatar && (movingEyes || blinking) ? (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full"
          animate={{ opacity: blinking ? [1, 0.82, 1] : 1, x: movingEyes ? [0, 1.5, -1, 0] : 0 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </motion.span>
  );
};

export default ChatbocLogoAnimated;
