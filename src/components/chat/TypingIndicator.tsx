import React from "react";
import { motion } from "framer-motion";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

interface TypingIndicatorProps {
  logoUrl?: string;
  logoAnimation?: string;
  text?: string;
}

const DEFAULT_PRIMARY = "217 100% 50%";

const primaryColorValue = (alpha?: number) =>
  alpha !== undefined
    ? `hsl(var(--primary, ${DEFAULT_PRIMARY}) / ${alpha})`
    : `hsl(var(--primary, ${DEFAULT_PRIMARY}))`;

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ logoUrl, logoAnimation, text }) => {
  const avatarStyle: React.CSSProperties = {
    background: primaryColorValue(0.15),
    border: `1px solid ${primaryColorValue(0.35)}`,
    boxShadow: `0 8px 20px -12px ${primaryColorValue(0.35)}`,
  };

  const bubbleStyle: React.CSSProperties = {
    background: primaryColorValue(0.12),
    borderColor: primaryColorValue(0.25),
    boxShadow: `0 12px 32px -18px ${primaryColorValue(0.45)}`,
  };

  const tailStyle: React.CSSProperties = {
    left: "-10px",
    bottom: "10px",
    width: "12px",
    height: "12px",
    background: primaryColorValue(0.12),
    borderBottom: `1px solid ${primaryColorValue(0.25)}`,
    borderLeft: `1px solid ${primaryColorValue(0.25)}`,
    borderBottomLeftRadius: "12px",
    transform: "rotate(45deg)",
    boxShadow: `0 6px 18px -14px ${primaryColorValue(0.4)}`,
  };

  const dotStyle: React.CSSProperties = {
    background: primaryColorValue(),
    boxShadow: `0 0 0 1px ${primaryColorValue(0.3)}`,
  };

  return (
    <div className="flex items-end gap-2.5 justify-start">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow"
        style={avatarStyle}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Asistente"
            className="w-7 h-7 object-contain rounded-full"
            style={{ animation: logoAnimation ?? undefined }}
          />
        ) : (
          <ChatbocLogoAnimated
            size={26}
            blinking
            floating
            pulsing
            movingEyes
          />
        )}
      </div>
      <motion.div
        className="px-4 py-3 max-w-[320px] shadow-md relative rounded-b-2xl rounded-tr-2xl text-foreground border"
        style={bubbleStyle}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <span aria-hidden className="absolute block pointer-events-none" style={tailStyle} />
        <div className="flex items-end gap-2 h-6">
          <div className="flex items-end gap-1 h-full pb-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block w-2 h-2 rounded-full"
                style={dotStyle}
                initial={{ y: 0, opacity: 0.6 }}
                animate={{
                  y: [0, -5, 0],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 0.85,
                  delay: i * 0.18,
                  repeat: Infinity,
                  repeatType: "loop",
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          {text && (
            <span className="text-xs font-medium opacity-80 self-center pb-0.5 ml-1">{text}</span>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TypingIndicator;
