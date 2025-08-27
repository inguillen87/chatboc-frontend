import React from "react";
import { motion } from "framer-motion";

interface UserAvatarAnimatedProps {
  size?: number;
  talking?: boolean;
  blinking?: boolean;
  smiling?: boolean;
}

const UserAvatarAnimated: React.FC<UserAvatarAnimatedProps> = ({
  size = 32,
  talking = false,
  blinking = true,
  smiling = false,
}) => {
  const mouthPath = smiling
    ? "M24 38 Q32 44 40 38"
    : "M25 39 Q32 41 39 39";

  return (
    <motion.div
      style={{ width: size, height: size, position: "relative" }}
      animate={talking ? { scaleY: [1, 1.05, 1], y: [0, -1, 0] } : {}}
      transition={talking ? { repeat: Infinity, duration: 0.6, ease: "easeInOut" } : {}}
    >
      <img
        src="/favicon/human-avatar.svg"
        alt="Avatar"
        style={{ width: size, height: size, display: "block" }}
        draggable={false}
      />
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        <motion.ellipse
          cx="23"
          cy="36"
          rx="3"
          ry="4"
          fill="#40312B"
          animate={blinking ? { scaleY: [1, 0.1, 1] } : {}}
          transition={blinking ? { repeat: Infinity, repeatDelay: 2.5, duration: 0.1 } : {}}
        />
        <motion.ellipse
          cx="41"
          cy="36"
          rx="3"
          ry="4"
          fill="#40312B"
          animate={blinking ? { scaleY: [1, 0.1, 1] } : {}}
          transition={blinking ? { repeat: Infinity, repeatDelay: 2.5, duration: 0.1 } : {}}
        />
        <motion.path
          d={mouthPath}
          stroke="#B98A60"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          transition={{ d: { duration: 0.25 } }}
        />
      </motion.svg>
    </motion.div>
  );
};

export default UserAvatarAnimated;
