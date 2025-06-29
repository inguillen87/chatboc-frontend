import * as React from "react"

import { cn } from "@/lib/utils"

// Interfaz InputProps extendida para incluir una posible variante de tamaño
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  sizeVariant?: "default" | "lg"; // Añadimos una variante de tamaño opcional
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, sizeVariant = "default", ...props }, ref) => {
    // Define las clases base y las variantes de tamaño
    const baseClasses = "flex w-full rounded-md border border-input bg-background px-4 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150 ease-in-out";

    const sizeClasses = {
      default: "h-10 text-sm", // Tamaño por defecto, texto un poco más pequeño
      lg: "h-12 text-base",   // Tamaño más grande para mayor prominencia o facilidad táctil
    };

    return (
      <input
        type={type}
        className={cn(
          baseClasses,
          sizeClasses[sizeVariant], // Aplica la clase de tamaño según la prop
          "focus-visible:border-primary", // Cambia el color del borde al color primario en focus
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
