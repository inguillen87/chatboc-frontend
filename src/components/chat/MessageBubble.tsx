import React from "react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  className?: string;
  children: React.ReactNode;
  isBot?: boolean; // Opcional, para diferenciar estilos si es necesario en el futuro
}

const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ className, children /*, isBot */ }, ref) => ( // No se usa isBot por ahora
    <div // Cambiado de motion.div a div simple
      ref={ref}
      className={cn(
        "rounded-xl shadow-md px-4 py-2.5 font-medium whitespace-pre-line break-words", // Eliminado text-sm y leading-normal
        // El tamaño de fuente y el interlineado ahora se controlan completamente desde el contenido (ChatMessagePyme/Municipio)
        // className se aplica después, por lo que puede sobreescribir estos defaults
        className
      )}
    >
      {children}
    </div>
  )
);

MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
