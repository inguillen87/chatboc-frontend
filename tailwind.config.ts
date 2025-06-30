import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))", // Azul Cobalto Vibrante
          foreground: "hsl(var(--primary-foreground))", // Blanco para texto sobre primario
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))", // Turquesa o Verde Azulado Claro
          foreground: "hsl(var(--secondary-foreground))", // Texto oscuro para secundario
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Se mantienen los colores de sidebar por si se usan en algún panel de admin no móvil.
        // Para la app móvil principal, usaremos los colores estándar primario/secundario/etc.
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        // Opcional: Si queremos usar Satoshi para encabezados grandes
        // heading: ["Satoshi", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { // Estos ahora usarán el nuevo --radius de 0.75rem (12px)
        lg: "var(--radius)", // 12px
        md: "calc(var(--radius) - 4px)", // 8px (ajustado para que md sea más pequeño que lg)
        sm: "calc(var(--radius) - 6px)", // 6px (ajustado para que sm sea más pequeño que md)
      },
      fontSize: { // Ampliamos la escala de fuentes para tener más control
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px (en desktop, 17px en móvil debido al html font-size)
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
        // Nuevos tamaños para móvil, considerando que 1rem base en móvil será ~17px
        'text-body-mobile': ['1.0625rem', { lineHeight: '1.75' }], // ~18px, para cuerpo de texto principal en móvil
        'text-title-mobile': ['1.25rem', { lineHeight: '1.4' }], // ~20px, para títulos en móvil
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      backgroundImage: {
        "hero-pattern": "url('/images/hero-bg.svg')",
      },
      boxShadow: { // Añadido para MobileNavbar
        'top': '0 -4px 6px -1px rgba(0, 0, 0, 0.07), 0 -2px 4px -2px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("tailwind-scrollbar"),
  ],
}

export default config satisfies Config
