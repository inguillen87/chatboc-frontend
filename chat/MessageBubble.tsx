import React from "react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  className?: string;
  children: React.ReactNode;
  isBot?: boolean; // Opcional, para diferenciar estilos si es necesario en el futuro
}

const MessageBubble = React.forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ className, children, isBot }, ref) => { // isBot ahora se usa para lógica condicional de estilo
    // Base classes aplicables a todas las burbujas
    const baseClasses = "shadow-md px-3.5 py-2 text-sm font-medium leading-relaxed whitespace-pre-wrap break-words min-w-[40px]"; // whitespace-pre-wrap, min-w, px-3.5, py-2

    // Clases condicionales basadas en si es bot o usuario
    // Para el bot (isBot = true): esquinas redondeadas específicas para dar forma de "cola" a la izquierda.
    // Para el usuario (isBot = false): esquinas redondeadas específicas para dar forma de "cola" a la derecha.
    const conditionalClasses = isBot
      ? "rounded-tr-xl rounded-br-xl rounded-bl-md rounded-tl-xl" // Esquina inferior izquierda menos redondeada
      : "rounded-tl-xl rounded-bl-xl rounded-br-md rounded-tr-xl"; // Esquina inferior derecha menos redondeada

    // Si no se especifica isBot (undefined), se usa un redondeo estándar.
    const defaultRounding = "rounded-xl";

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          typeof isBot === 'boolean' ? conditionalClasses : defaultRounding,
          className // Permite sobreescribir o añadir clases desde la prop
        )}
      >
        {children}
      </div>
    );
  }
);

MessageBubble.displayName = "MessageBubble";

export default MessageBubble;
