# Chatboc frontend branding pack

## Recomendado para producción

### Navbar
- `branding/chatboc/navbar/chatboc-navbar-mark-circle.svg`
- alternativo transparente: `branding/chatboc/navbar/chatboc-navbar-mark-clean.svg`

### Widget chat web
- `branding/chatboc/widget/chatboc-widget-launcher-animated.svg`
- fallback estático: `branding/chatboc/widget/chatboc-widget-launcher-static.svg`

## Criterio UX/UI

- El launcher real del chat usa la variante **mini** porque escala mejor entre 56 y 64 px.
- La variante **rich** se conserva para piezas más grandes, demos o landing.
- El navbar usa un icono más limpio y menos recargado que el widget.
- Los SVG respetan `prefers-reduced-motion`.

## Tamaños sugeridos

### Navbar
- desktop: 36 px
- mobile: 32 px

### Widget
- desktop: 64 px
- mobile: 56 px

## Estructura

- `branding/chatboc/navbar/`
- `branding/chatboc/widget/`
- `components/`
- `docs/`

## IDs útiles del SVG del widget

- `cbm-head-bob`
- `cbm-left-arm`
- `cbm-left-hand`
- `cbm-eye-left`
- `cbm-eye-right`
- `cbm-pupil-left`
- `cbm-pupil-right`
- `cbm-badge`

## Recomendación práctica

- No usar el widget rich como launcher fijo de 56 px.
- No deformar los SVG por CSS.
- No aplicar filtros extra agresivos encima del asset.
