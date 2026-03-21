# Frontend demo/widget handoff

Este documento resume qué conviene mandarle hoy mismo al equipo frontend para cerrar bien la integración entre widget, demo shell, contexto de sesión y operación de tickets.

## Resumen ejecutivo

Si hay que mandar una versión corta, priorizar esto:

1. Reenviar siempre `X-Chat-Session-Id`, `entityToken`/`X-Entity-Token`, `X-Anon-Id` y `pin` si existe.
2. Decidir demo vs tenant real con `ux_context.should_render_demo_shell` y `ux_context.trusted_owner`.
3. Escuchar eventos realtime `conversation.message.created`, `ticket.status.changed` y `ticket.assignment.changed`.
4. Pintar prioridad operativa con `sla_status`, `operational_badges` y `operational_metrics`.
5. Siguiente salto UX: inbox omnicanal con KPI strip + lista/mapa + panel lateral 360.

## Qué sí vale la pena enviarle hoy al frontend

### 1. Propagación de contexto en cada request

El frontend debe preservar y reenviar de forma consistente:

- `X-Chat-Session-Id`: continuidad de conversación, handoff y trazabilidad.
- `entityToken` o `X-Entity-Token`: resolución del tenant/entidad activa.
- `X-Anon-Id`: continuidad anónima entre sesiones y embebidos.
- `pin`: acceso o restauración de tracking público cuando aplique.

### 2. Contrato mínimo de `ux_context`

El frontend debe consumir `ux_context` como contrato principal de render y comportamiento.

Campos prioritarios:

- `should_render_demo_shell`: gate maestro para mostrar shell demo o experiencia tenant real.
- `trusted_owner`: confirma si el contexto pertenece a un owner confiable.
- `demo_selector`: datos para seleccionar demo/cuenta/tenant cuando backend lo indique.
- `suggested_next_actions`: acciones recomendadas para CTA o workflow contextual.
- `visibility_rules`: flags de visibilidad para paneles, mapas, tabs o bloques.

Regla práctica:

- Si `ux_context.should_render_demo_shell` es `true`, el frontend debe renderizar experiencia demo.
- Si `ux_context.should_render_demo_shell` es `false`, debe priorizar tenant real.
- Si además existe `trusted_owner`, usarlo para endurecer decisiones de shell/contexto y evitar mezclas de demo con tenant productivo.

### 3. Eventos realtime normalizados

El frontend debe estar listo para reaccionar a estos eventos como primera capa operacional:

- `conversation.message.created`
- `ticket.status.changed`
- `ticket.assignment.changed`

Comportamientos esperados:

- actualizar timeline o chat sin recarga completa
- refrescar badges, contadores y estado operativo del ticket
- invalidar cachés locales del ticket, inbox o panel lateral afectado
- mostrar feedback visual sobrio cuando cambia estado o asignación

### 4. Prioridad operativa de tickets

El frontend debe mostrar la prioridad usando payload del backend, no lógica inventada.

Campos a observar:

- `sla_status`
- `operational_badges`
- `operational_metrics`

Representación recomendada:

- badge principal por `sla_status`
- chips secundarios por `operational_badges`
- métricas compactas por `operational_metrics` en strip o panel lateral

## Roadmap UX/UI posterior

### Paneles operativos

- inbox omnicanal más premium
- colas por prioridad/SLA
- filtros por canal, estado, asignación y severidad
- KPI strip persistente arriba del layout operativo

### Mapas y operación territorial

- lista + mapa en vivo sincronizados
- filtros por zona, categoría, estado y riesgo
- markers diferenciados por tipo de entidad o criticidad
- clustering y acciones rápidas desde mapa

### Perfil tenant

- resumen de onboarding, activación y uso
- integraciones conectadas/desconectadas
- health score, riesgo de churn y señales de adopción
- estado comercial y operativo en una sola vista

### CRM superadmin

- vista ejecutiva de pipeline, revenue intelligence y health score
- cartera por etapa, win-rate y riesgo
- priorización de tenants por expansión, activación o rescate
- playbooks operativos/comerciales sobre cuentas críticas

### Dashboards y heatmaps

- dashboards por operación, soporte, comercial y founders
- heatmaps por zona/categoría/volumen/SLA
- alertas visuales por backlog o desbalance operativo
- vista transversal de tickets, chats y performance por tenant

## Qué le mandaría al frontend ya mismo

Texto corto sugerido para enviar tal cual:

> Reenviar siempre `X-Chat-Session-Id`, `entityToken`/`X-Entity-Token`, `X-Anon-Id` y `pin` si existe. Decidir demo vs tenant real con `ux_context.should_render_demo_shell` + `trusted_owner`. Escuchar `conversation.message.created`, `ticket.status.changed` y `ticket.assignment.changed`. Pintar prioridad con `sla_status`, `operational_badges` y `operational_metrics`. Próximo salto UX: inbox omnicanal con panel lateral + lista/mapa + KPI strip.
