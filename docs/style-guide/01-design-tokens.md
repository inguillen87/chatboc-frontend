# Guía de Estilo: Design Tokens

Este documento describe los tokens de diseño fundamentales utilizados en la plataforma Chatboc para asegurar una consistencia visual y facilitar el desarrollo. Estos tokens se definen principalmente en `src/index.css` como variables CSS y se configuran en `tailwind.config.ts`.

## 1. Paleta de Colores

Los colores se definen semánticamente para su uso en componentes y temas (claro/oscuro).

### Colores Primarios y Semánticos (Light Mode)

| Nombre Semántico (Variable CSS) | Valor HSL (en `src/index.css`) | Valor Hex (Aprox.) | Uso Principal                                      |
|---------------------------------|--------------------------------|--------------------|----------------------------------------------------|
| `--primary`                     | `217 100% 50%`                 | `#007AFF`          | CTAs principales, acentos importantes, enlaces.    |
| `--primary-foreground`          | `210 20% 98%`                  | `#FAFBFC`          | Texto sobre fondos de color primario.              |
| `--secondary`                   | `220 14.3% 95.9%`              | `#F4F6F8`          | Fondos de elementos secundarios, divisores sutiles.|
| `--secondary-foreground`        | `220.9 39.3% 11%`              | `#1C202B`          | Texto sobre fondos de color secundario.            |
| `--muted`                       | `220 14.3% 95.9%`              | `#F4F6F8`          | Elementos discretos o deshabilitados.              |
| `--muted-foreground`            | `210 9% 45%`                   | `#6C757D`          | Texto secundario, placeholders, descripciones.     |
| `--accent`                      | `220 14.3% 95.9%`              | `#F4F6F8`          | Acentos para interacciones (hover, focus sutil).   |
| `--accent-foreground`           | `220.9 39.3% 11%`              | `#1C202B`          | Texto sobre fondos de color de acento.             |

### Colores de Estado (Light Mode)

| Nombre Semántico (Variable CSS) | Valor HSL (en `src/index.css`) | Valor Hex (Aprox.) | Uso Principal                                 |
|---------------------------------|--------------------------------|--------------------|-----------------------------------------------|
| `--destructive`                 | `0 84.2% 60.2%`                | `#FF3B30`          | Acciones destructivas (eliminar), errores.    |
| `--destructive-foreground`      | `210 20% 98%`                  | `#FAFBFC`          | Texto sobre fondos destructivos.              |
| `--success`                     | `134 61% 41%`                  | `#28A745`          | Acciones exitosas, confirmaciones positivas.  |
| `--success-foreground`          | `0 0% 100%`                    | `#FFFFFF`          | Texto sobre fondos de éxito.                  |
| `--warning`                     | `45 100% 51%`                  | `#FFC107`          | Advertencias, alertas no críticas.            |
| `--warning-foreground`          | `0 0% 0%`                      | `#000000`          | Texto sobre fondos de advertencia.            |

### Colores Neutros y de UI (Light Mode)

| Nombre Semántico (Variable CSS) | Valor HSL (en `src/index.css`) | Valor Hex (Aprox.) | Uso Principal                                     |
|---------------------------------|--------------------------------|--------------------|---------------------------------------------------|
| `--background`                  | `0 0% 100%`                    | `#FFFFFF`          | Fondo principal de la aplicación.                 |
| `--foreground`                  | `224 71.4% 4.1%`               | `#0A0A0A`          | Texto principal de la aplicación.                 |
| `--card`                        | `0 0% 100%`                    | `#FFFFFF`          | Fondo para componentes tipo tarjeta.              |
| `--card-foreground`             | `224 71.4% 4.1%`               | `#0A0A0A`          | Texto dentro de las tarjetas.                     |
| `--popover`                     | `0 0% 100%`                    | `#FFFFFF`          | Fondo para popovers y menús desplegables.       |
| `--popover-foreground`          | `224 71.4% 4.1%`               | `#0A0A0A`          | Texto dentro de popovers.                         |
| `--border`                      | `220 13% 91%`                  | `#E4E7EB`          | Bordes para inputs, tarjetas, separadores.      |
| `--input`                       | `0 0% 98%`                     | `#FAFAFA`          | Fondo para campos de input.                       |
| `--ring`                        | `217 91.2% 59.8%`              | `#3B82F6`          | Color del anillo de foco (generalmente primario). |

*Nota: Los valores para el modo oscuro (`.dark`) también están definidos en `src/index.css` y siguen una lógica similar pero con colores invertidos o adaptados para fondos oscuros.*

## 2. Tipografía

- **Fuente Principal:** `Inter`
  - Aplicada a: Todo el cuerpo de texto, elementos de UI y titulares.
  - Importada desde Google Fonts en `src/index.css`.
- **Pesos Utilizados (configurados a través de clases de Tailwind):**
  - `font-normal` (400)
  - `font-medium` (500)
  - `font-semibold` (600)
  - `font-bold` (700)
- **Configuración en `tailwind.config.ts`:**
  ```javascript
  fontFamily: {
    sans: ["Inter", "sans-serif"],
  }
  ```
- **Estilos base en `src/index.css`:**
  ```css
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3, h4, h5, h6 {
    @apply font-semibold text-dark; /* o text-foreground */
  }
  ```

## 3. Border Radius

- El radio de borde base para la mayoría de los componentes (botones, tarjetas, inputs) se define mediante la variable CSS `--radius`.
- **Valor Actual:** `0.25rem` (4px)
  - Definido en `src/index.css`: `:root { --radius: 0.25rem; }`
- **Aplicación:**
  - Los componentes de `shadcn/ui` utilizan esta variable internamente.
  - En Tailwind, se puede acceder a través de `rounded-lg` (que usa `var(--radius)`), `rounded-md` (`calc(var(--radius) - 2px)`), y `rounded-sm` (`calc(var(--radius) - 4px)`) según la configuración en `tailwind.config.ts`. Para consistencia con el `--radius` de `0.25rem`, `rounded-md` sería `2px` y `rounded-sm` sería `0px` o `1px` (o se ajusta la configuración de Tailwind). Típicamente, `rounded-lg` (o simplemente `rounded` si se ajusta el default de Tailwind) sería el más usado para seguir el `--radius` base.
  - La configuración actual de `tailwind.config.ts` es:
    ```javascript
    borderRadius: {
      lg: "var(--radius)", // 0.25rem
      md: "calc(var(--radius) - 2px)", // aprox 0.125rem o 2px
      sm: "calc(var(--radius) - 4px)", // 0rem o se ajusta a un mínimo
    },
    ```
    Se recomienda usar `rounded-lg` para el radio de `0.25rem` o ajustar las clases de Tailwind para que `rounded-md` o `rounded` coincidan con `var(--radius)`. Por defecto, los componentes shadcn/ui usarán `var(--radius)`.

## 4. Espaciado

- El espaciado se maneja principalmente a través de las **clases de utilidad de Tailwind CSS** (ej. `p-4`, `m-2`, `space-x-2`, `gap-4`).
- Se recomienda el uso de la escala de espaciado predeterminada de Tailwind (basada en múltiplos de `0.25rem`) para mantener la consistencia.

---

Esta guía de tokens de diseño debe ser la referencia para cualquier nuevo desarrollo o modificación en el frontend.
