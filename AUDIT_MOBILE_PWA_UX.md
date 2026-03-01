# AUDIT_MOBILE_PWA_UX

## Alcance
Auditoría frontend mobile sobre navegación principal y acceso a módulos críticos.

## Hallazgos
1. En menú mobile autenticado faltaba acceso directo a **Panel de encuestas** en la sección admin.
2. Diferencia de paridad desktop/mobile en atajos admin.

## Cambios aplicados
- Se agregó entrada mobile para `/admin/encuestas` cuando `FEATURE_ENCUESTAS` está habilitado.
- Se mantuvo bloque admin mobile visible aunque no haya `adminLinks` dinámicos, si encuestas está habilitado.

## Impacto
- Mejora inmediata de discoverability en PWA/mobile para Encuestas.

## Próximos pasos
- Auditoría por breakpoints (320/360/390/412/430/tablet) en páginas: Perfil, Analytics, Tickets, Pedidos.
- Ajuste sistemático de spacing y jerarquía visual mobile-first.
