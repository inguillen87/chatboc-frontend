Toma este paquete de branding de Chatboc y aplícalo en el frontend de forma limpia, sin romper el diseño existente.

OBJETIVO
1. Reemplazar el icono/logo visual del navbar por el nuevo asset de Chatboc.
2. Reemplazar el launcher del chat web por el nuevo widget circular animado.
3. Mantener accesibilidad, responsividad y `prefers-reduced-motion`.
4. El resultado debe verse más premium, más claro y menos recargado.

ASSETS A USAR
- Navbar principal: `branding/chatboc/navbar/chatboc-navbar-mark-circle.svg`
- Navbar alternativo si ya existe fondo/contendor propio: `branding/chatboc/navbar/chatboc-navbar-mark-clean.svg`
- Widget chat recomendado: `branding/chatboc/widget/chatboc-widget-launcher-animated.svg`
- Fallback estático: `branding/chatboc/widget/chatboc-widget-launcher-static.svg`

ALCANCE
- Detecta automáticamente el framework del proyecto.
- Si es Next.js, usa la carpeta `public/branding/chatboc/...`
- Si es Vite/React, usa `public/branding/chatboc/...` o la convención equivalente del repo.
- Encuentra el componente del navbar y reemplaza únicamente el asset visual, sin tocar el texto de marca si ya existe.
- Encuentra el componente del chat launcher flotante y reemplaza únicamente el asset del botón, manteniendo la lógica de abrir/cerrar el chat.

REQUISITOS DE IMPLEMENTACIÓN
- Navbar:
  - tamaño desktop: 36 px
  - tamaño mobile: 32 px
  - no deformar proporción
  - si el navbar es claro, prioriza `chatboc-navbar-mark-circle.svg`
  - si el navbar ya tiene un chip/círculo propio, usa `chatboc-navbar-mark-clean.svg`

- Widget launcher:
  - desktop: 64 x 64 px
  - mobile: 56 x 56 px
  - posición: bottom 24 / right 24 en desktop
  - posición: bottom 16 / right 16 en mobile
  - conservar `aria-label`
  - hover: `transform: translateY(-1px) scale(1.03)`
  - active: `transform: scale(0.98)`
  - focus visible: ring claro y profesional
  - sombra del botón contenida, no exagerada
  - usar el SVG animado por defecto
  - si el navegador o la configuración reduce motion lo requieren, caer al SVG estático

ACCESIBILIDAD
- respetar `prefers-reduced-motion`
- mantener contraste suficiente
- no usar autoplay de animaciones fuera del propio SVG
- no eliminar estados de foco del botón

LIMPIEZA
- elimina imports viejos no usados
- no dejes assets duplicados sin uso dentro del componente modificado
- si existe un asset anterior del widget o navbar, deja comentario corto indicando que fue reemplazado por el pack 2026-03-26 de Chatboc

ENTREGABLE
- modifica los archivos del frontend
- enumera exactamente qué archivos tocaste
- muestra el diff final
- si hay más de una opción razonable para el navbar, elige la mejor y explica por qué en una línea
