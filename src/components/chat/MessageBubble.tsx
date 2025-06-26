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
        hidden: { opacity: 0, y: 14, scale: 0.97 },
        visible: { opacity: 1, y: 0, scale: [1, 1.03, 1] },
      }}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
);

MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
