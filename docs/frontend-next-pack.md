# Frontend next pack

Este archivo deja un resumen corto, accionable y en orden de prioridad para implementación inmediata.

## Prioridad real

### 1. Render gate por `ux_context.should_render_demo_shell`

- usar `ux_context.should_render_demo_shell` como fuente de verdad para decidir demo shell vs tenant real
- reforzar decisión con `trusted_owner` cuando esté presente
- evitar mezclar vistas demo y productivas en el mismo flujo

### 2. Reenvío completo de contexto

- reenviar `X-Chat-Session-Id`
- reenviar `entityToken` o `X-Entity-Token`
- reenviar `X-Anon-Id`
- reenviar `pin` cuando exista tracking público o restauración de acceso

### 3. Realtime nuevo

Escuchar y reaccionar a:

- `conversation.message.created`
- `ticket.status.changed`
- `ticket.assignment.changed`

### 4. Prioridad operativa visible

Pintar prioridad operativa con:

- `sla_status`
- `operational_badges`
- `operational_metrics`

## Siguiente salto UX recomendado

- inbox omnicanal con lista + mapa sincronizados
- panel lateral 360 del ticket
- KPI strip persistente por operación
- acciones rápidas de estado, asignación y contacto
