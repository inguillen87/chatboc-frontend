# Guía de Estilo: Componentes UI Clave

Este documento describe el uso y estilo de los componentes de UI clave en la plataforma Chatboc, basados principalmente en la biblioteca `shadcn/ui` y personalizados según los [Design Tokens](./01-design-tokens.md).

## Principio General

Se debe priorizar el uso de los componentes predefinidos en `src/components/ui/` para mantener la consistencia visual y funcional en toda la aplicación. Estos componentes ya están estilizados para heredar los tokens de diseño (colores, tipografía, border-radius).

## 1. Botones (`Button`)

- **Componente:** `src/components/ui/button.tsx`
- **Uso:** Para todas las acciones clickeables que desencadenan una operación.
- **Estilo Base:** Hereda `--radius` (actualmente `0.25rem`), `font-medium`, transiciones suaves, y efectos de foco/activo.

### Variantes Principales:

-   **`default`**: (Primaria)
    -   **Estilo:** `bg-primary text-primary-foreground hover:bg-primary/90`
    -   **Uso:** Para la acción principal en una vista o componente (ej. "Guardar", "Enviar", CTAs principales).
    -   Ej: `<Button>Acción Principal</Button>`

-   **`secondary`**:
    -   **Estilo:** `bg-secondary text-secondary-foreground hover:bg-secondary/80`
    -   **Uso:** Para acciones secundarias que necesitan menos énfasis que la primaria, pero más que un `outline` o `ghost`.
    -   Ej: `<Button variant="secondary">Acción Secundaria</Button>`

-   **`outline`**:
    -   **Estilo:** `border border-input bg-background hover:bg-accent hover:text-accent-foreground`
    -   **Uso:** Para acciones secundarias o alternativas donde se desea un menor peso visual (ej. "Cancelar", "Ver Detalles").
    -   Ej: `<Button variant="outline">Acción Outline</Button>`

-   **`destructive`**:
    -   **Estilo:** `bg-destructive text-destructive-foreground hover:bg-destructive/90`
    -   **Uso:** Para acciones que resultan en destrucción de datos o son potencialmente peligrosas (ej. "Eliminar", "Borrar Cuenta").
    -   Ej: `<Button variant="destructive">Eliminar</Button>`

-   **`success`**:
    -   **Estilo:** `bg-success text-success-foreground hover:bg-success/90`
    -   **Uso:** Para acciones que indican un resultado positivo o de confirmación (ej. "Aceptar", "Completado").
    -   Ej: `<Button variant="success">Aceptar</Button>`

-   **`warning`**:
    -   **Estilo:** `bg-warning text-warning-foreground hover:bg-warning/90`
    -   **Uso:** Para acciones que requieren precaución o indican un estado de advertencia.
    -   Ej: `<Button variant="warning">Precaución</Button>`

-   **`ghost`**:
    -   **Estilo:** `hover:bg-accent hover:text-accent-foreground shadow-none`
    -   **Uso:** Para acciones muy sutiles, a menudo usadas en conjunto con iconos o en menús. Sin borde ni fondo.
    -   Ej: `<Button variant="ghost">Acción Fantasma</Button>`

-   **`link`**:
    -   **Estilo:** `text-primary underline-offset-4 hover:underline shadow-none`
    -   **Uso:** Para acciones que deben parecerse a un enlace de texto estándar pero con comportamiento de botón.
    -   Ej: `<Button variant="link">Soy un Enlace</Button>`

### Tamaños:

-   **`default`**: Altura `h-10` (40px). Usar para la mayoría de los casos.
-   **`sm`**: Altura `h-9` (36px). Para contextos donde se necesita un botón más compacto.
-   **`lg`**: Altura `h-11` (44px). Para CTAs principales o botones que necesitan mayor prominencia.
-   **`icon`**: Altura y Ancho `h-10 w-10` (40px). Para botones que solo contienen un icono.

### Uso con Iconos:

Los botones están diseñados para alinear iconos (`lucide-react` u otros SVG) junto al texto usando `gap-2`.
```jsx
import { Mail } from "lucide-react";
// ...
<Button>
  <Mail className="mr-2 h-4 w-4" /> Login with Email
</Button>
```

## 2. Tarjetas (`Card`)

- **Componente:** `src/components/ui/card.tsx`
- **Uso:** Para agrupar contenido relacionado en un contenedor visualmente distinto. Ampliamente utilizado en la landing page y se prevé su uso en dashboards y vistas de perfil del CRM.
- **Estructura:**
  - `<Card>`: Contenedor principal.
  - `<CardHeader>`: Sección opcional para el encabezado.
    - `<CardTitle>`: Título de la tarjeta.
    - `<CardDescription>`: Descripción opcional.
  - `<CardContent>`: Contenido principal de la tarjeta.
  - `<CardFooter>`: Sección opcional para el pie de la tarjeta (ej. botones de acción).
- **Estilo Base:** `bg-card text-card-foreground`, `rounded-lg` (usa `--radius`), `border border-border`, `shadow-lg` (o `shadow-xl` según la implementación).

## 3. Inputs y Formularios

- **Componentes:** `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/select.tsx`, `src/components/ui/textarea.tsx`, etc.
- **Uso:** Para toda la entrada de datos del usuario.
- **Estilo Base:**
  - **Inputs/Textarea/Select:** `bg-input border-input text-foreground`, `rounded-md` (usa `calc(var(--radius) - 2px)`), foco con `ring-ring`.
  - **Labels:** Estilizadas para asociarse claramente con su input.
  - **Form (`src/components/ui/form.tsx`):** Se integra con `react-hook-form` para la gestión y validación de formularios, lo cual es la práctica recomendada.

## 4. Otros Componentes Shadcn/ui

La carpeta `src/components/ui/` contiene muchos otros componentes útiles (Avatar, Badge, Dialog, DropdownMenu, Table, Tabs, etc.).
- **Recomendación:** Antes de crear un componente de UI personalizado desde cero, verificar si existe un componente adecuado en `shadcn/ui` que pueda ser utilizado o adaptado.
- **Estilo:** Todos estos componentes están diseñados para heredar los tokens de diseño (colores, fuentes, radio de borde) definidos en `src/index.css` y `tailwind.config.ts`.

---

Esta guía de componentes debe servir como referencia para asegurar la consistencia en el uso y apariencia de los elementos de UI a lo largo de la aplicación.
