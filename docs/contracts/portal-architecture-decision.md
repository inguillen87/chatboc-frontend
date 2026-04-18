# ADR — Portal usuario separado del panel admin

Estado: **Aceptado**  
Fecha: 2026-04-14

## Decisión

El portal usuario debe operar como app/build separado del panel admin, compartiendo design system y base de autenticación cuando convenga, pero sin mezclar bundles ni navegación de backoffice.

## Razones

1. Reduce contaminación UX entre backoffice y experiencia ciudadano/cliente.
2. Mejora TTI y peso de bundle del portal.
3. Aísla release cadence y reduce regresiones cruzadas.

## Implicancias

- Rutas canónicas de portal bajo scope tenant (`/t/:tenantSlug/...`).
- Manifest/scope PWA específico del portal.
- Widget y WhatsApp handoff deben aterrizar en portal sin cargar módulos admin.
