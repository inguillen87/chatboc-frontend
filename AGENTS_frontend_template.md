# AGENTS.md — frontend

## Objetivo del repo
Frontend enterprise para operación omnicanal, administración, analítica, PWA y widget embebible.

## Reglas de trabajo
- No hacer rediseños cosméticos sin impacto funcional.
- No hardcodear permisos ni contratos.
- Cubrir estados loading, empty, error, denied, offline y stale.
- Mantener mobile-first y accesibilidad razonable.
- Reusar patrones del design system antes de crear componentes nuevos.

## Estándares
- Consumir contratos del backend sin duplicar lógica de negocio.
- Realtime debe degradar a refetch/polling.
- Mantener componentes pequeños y hooks por dominio.
- Agregar tests si el repo ya tiene patrón de test para ese dominio.

## Qué NO hacer
- No tocar backend desde este repo.
- No mezclar cambios de varias épicas en un solo PR.
- No destruir estado de sesión sin necesidad.

## Definition of Done
- lint/typecheck verdes
- estados UX cubiertos
- responsive usable
- notas breves de endpoints y contratos usados
