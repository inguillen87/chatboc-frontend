import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Actualizado para reflejar la nueva dirección visual y añadir variante "premium" y "rounded"
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: // Azul Cobalto, texto blanco. Hover más oscuro.
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        destructive: // Rojo, texto blanco. Hover más oscuro.
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline: // Borde primario, texto primario. Hover fondo primario muy sutil.
          "border border-primary text-primary bg-transparent hover:bg-primary/5",
        secondary: // Turquesa, texto blanco. Hover más oscuro.
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm",
        ghost: // Transparente, texto primario. Hover fondo primario muy sutil.
          "text-primary hover:bg-primary/5",
        link: // Texto primario, subrayado. Hover más intenso.
          "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        premium: // Gradiente, texto blanco, sombra más pronunciada.
          "bg-gradient-to-r from-primary via-blue-600 to-secondary text-primary-foreground hover:shadow-lg hover:from-primary/90 hover:to-secondary/90 shadow-md transform active:scale-[0.97]",
      },
      size: {
        default: "h-10 px-6 py-2", // Ligeramente más padding horizontal
        sm: "h-9 px-4 text-xs", // Más pequeño y texto más pequeño
        lg: "h-12 px-8 text-base", // Más grande para CTAs importantes
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8", // Icono más pequeño
      },
      rounded: { // Nueva variante para radios de borde
        default: "rounded-md", // Usa var(--radius) de CSS que es 0.5rem (8px por defecto en shadcn)
        sm: "rounded-sm",   // calc(var(--radius) - 4px) -> 4px
        lg: "rounded-lg",   // calc(var(--radius) + 4px) -> 12px (si var(--radius) es 8px)
        full: "rounded-full",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "default", // Usamos el radio por defecto de shadcn (md)
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, rounded, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, rounded, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
