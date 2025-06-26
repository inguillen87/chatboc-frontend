import React from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";

const UserTypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2.5 justify-end">
    <motion.div
      className="flex-shrink-0 w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-blue-300 shadow"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <User className="w-5 h-5 text-primary" />
    </motion.div>
    <motion.div
      className="px-4 py-3 max-w-[320px] shadow-md relative bg-gradient-to-tr from-blue-500 to-blue-700 text-white rounded-b-2xl rounded-tl-2xl after:content-[''] after:absolute after:bottom-0 after:right-[-8px] after:w-0 after:h-0 after:border-8 after:border-transparent after:border-t-blue-700 after:border-l-blue-700"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-end gap-1 h-6">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block w-2 h-2 rounded-full bg-white/80"
            initial={{ y: 0, opacity: 0.6 }}
            animate={{ y: [0, -5, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.85, delay: i * 0.18, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  </div>
);

export default UserTypingIndicator;
