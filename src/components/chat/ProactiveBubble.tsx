import React, { useEffect, useRef } from "react";
import { motion, useReducedMotionConfig } from "framer-motion";
import { X } from 'lucide-react';

interface ProactiveBubbleProps {
  message: string;
  onClick: () => void;
  visible: boolean;
  onDismiss: (restoreFocus: boolean) => void;
  onInteractionChange?: (interacting: boolean) => void;
}

const ProactiveBubble: React.FC<ProactiveBubbleProps> = ({
  message,
  onClick,
  visible,
  onDismiss,
  onInteractionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const hovered = useRef(false);
  useEffect(() => {
    if (visible) return;
    focused.current = false;
    hovered.current = false;
    onInteractionChange?.(false);
  }, [visible, onInteractionChange]);
  const dismiss = () => onDismiss(Boolean(containerRef.current?.contains(document.activeElement)));
  const reducedMotion = useReducedMotionConfig();
  if (!visible) return null;

  return (
    <motion.div
      key="proactive-bubble"
      ref={containerRef}
      onFocusCapture={() => { focused.current = true; onInteractionChange?.(true); }}
      onBlurCapture={event => {
        if (containerRef.current?.contains(event.relatedTarget as Node | null)) return;
        focused.current = false;
        onInteractionChange?.(hovered.current);
      }}
      onPointerEnter={event => {
        if (event.pointerType !== 'mouse') return;
        hovered.current = true;
        onInteractionChange?.(true);
      }}
      onPointerLeave={() => { hovered.current = false; onInteractionChange?.(focused.current); }}
      className="absolute bottom-0 right-[calc(100%+1rem)] mb-4 w-max max-w-[min(22rem,calc(100dvw-6.5rem-env(safe-area-inset-right)))]"
      initial={reducedMotion ? false : { opacity: 0, x: 20 }}
      animate={reducedMotion ? { opacity: 1, x: 0, transition: { duration: 0 } } : {
        opacity: 1,
        x: 0,
        transition: { type: "spring", stiffness: 280, damping: 25, delay: 0.2 }
      }}
      exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 20, transition: { duration: 0.2, ease: "easeOut" } }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="relative flex items-start rounded-lg bg-primary text-primary-foreground shadow-lg font-semibold"
        style={{
            boxShadow: 'var(--shadow)',
        }}
      >
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 max-h-[min(20rem,calc(100dvh-8rem))] flex-1 overflow-y-auto rounded-lg px-4 py-3 text-left whitespace-normal [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {message}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar sugerencia"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div
          aria-hidden="true"
          className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 transition-colors duration-300"
          style={{
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderLeft: '16px solid hsl(var(--primary))',
          }}
        />
      </div>
    </motion.div>
  );
};

export default ProactiveBubble;
