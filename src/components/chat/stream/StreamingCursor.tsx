import React from 'react';
import { motion } from 'framer-motion';

export const StreamingCursor: React.FC = () => {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        repeat: Infinity,
        duration: 0.8,
        ease: "easeInOut"
      }}
      className="inline-block w-2.5 h-4 ml-1 align-middle bg-primary rounded-sm"
    />
  );
};
