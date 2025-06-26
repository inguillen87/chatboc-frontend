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
        {/* Hair */}
        <path d="M8 20 Q28 4 48 20 V32 H8 Z" fill="#92400e" />
        {/* Face */}
        <circle cx="28" cy="30" r="22" fill="#f9d4b4" stroke="#e5e7eb" strokeWidth="2" />
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
