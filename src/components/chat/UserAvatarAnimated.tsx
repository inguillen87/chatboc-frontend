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
      animate={talking ? { scale: [1, 1.05, 1] } : {}}
      transition={talking ? { repeat: Infinity, duration: 1 } : {}}
    >
      <svg width={size} height={size} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="26" fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="2" />
        {/* Eyes */}
        <motion.circle
          cx="20"
          cy="24"
          r="3"
          fill="#1f2937"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, repeatDelay: 4 }}
        />
        <motion.circle
          cx="36"
          cy="24"
          r="3"
          fill="#1f2937"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, repeatDelay: 4.1 }}
        />
        {/* Mouth */}
        <motion.path
          d={mouthVariants.idle}
          stroke="#1f2937"
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
