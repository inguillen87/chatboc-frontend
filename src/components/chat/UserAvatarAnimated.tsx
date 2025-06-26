import React from "react";
import { motion } from "framer-motion";

interface UserAvatarAnimatedProps {
  size?: number;
  talking?: boolean;
}

const UserAvatarAnimated: React.FC<UserAvatarAnimatedProps> = ({ size = 24, talking = false }) => {
  const mouthVariants = {
    idle: "M18,34 Q28,38 38,34",
    talking: [
      "M18,34 Q28,38 38,34",
      "M18,34 Q28,44 38,34",
      "M18,34 Q28,38 38,34",
    ],
  };

  return (
    <motion.div
      style={{ width: size, height: size }}
      className="flex items-center justify-center"
      animate={talking ? { rotate: [0, 5, -5, 0] } : {}}
      transition={talking ? { repeat: Infinity, duration: 1 } : {}}
    >
      <svg width={size} height={size} viewBox="0 0 56 56">
        <defs>
          <linearGradient id="hairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#b26a2a" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          <linearGradient id="skinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe0c0" />
            <stop offset="100%" stopColor="#f9d4b4" />
          </linearGradient>
        </defs>
        {/* Hair */}
        <path d="M8 20 Q28 4 48 20 V32 H8 Z" fill="url(#hairGradient)" />
        {/* Face */}
        <circle cx="28" cy="30" r="22" fill="url(#skinGradient)" stroke="#e5e7eb" strokeWidth="2" />
        {/* Eyes */}
        <motion.circle
          cx="20"
          cy="28"
          r="3"
          fill="#000"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, repeatDelay: 4 }}
        />
        <motion.circle
          cx="36"
          cy="28"
          r="3"
          fill="#000"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, repeatDelay: 4.1 }}
        />
        {/* Nose */}
        <path d="M28 32 Q27 34 28 36" stroke="#000" strokeWidth={1.5} strokeLinecap="round" fill="none" />
        {/* Mouth */}
        <motion.path
          d={mouthVariants.idle}
          stroke="#000"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          animate={talking ? { d: mouthVariants.talking } : {}}
          transition={talking ? { repeat: Infinity, duration: 0.8 } : {}}
        />
      </svg>
    </motion.div>
  );
};

export default UserAvatarAnimated;
