import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  usersTyping: { id: string; name: string }[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ usersTyping }) => {
  if (!usersTyping || usersTyping.length === 0) return null;

  const names = usersTyping.map(u => u.name).join(', ');
  const verb = usersTyping.length > 1 ? 'están escribiendo...' : 'está escribiendo...';

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 mb-2 h-5">
      <div className="flex items-center gap-1">
        <motion.span
          className="w-1 h-1 bg-muted-foreground rounded-full"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="w-1 h-1 bg-muted-foreground rounded-full"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
        />
        <motion.span
          className="w-1 h-1 bg-muted-foreground rounded-full"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
        />
      </div>
      <span className="truncate max-w-[200px] italic">
        <span className="font-medium">{names}</span> {verb}
      </span>
    </div>
  );
};
