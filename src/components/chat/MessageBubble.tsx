import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  className?: string;
  children: React.ReactNode;
}

const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ className, children }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        "rounded-2xl shadow-md px-5 py-3 font-medium text-base leading-relaxed whitespace-pre-line break-words",
        className
      )}
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 }, // Slightly more y offset and smaller initial scale
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
        },
      }}
      initial="hidden"
      animate="visible"
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        opacity: { duration: 0.2, ease: "easeIn" } // Faster opacity fade-in
      }}
    >
      {children}
    </motion.div>
  )
);

MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
