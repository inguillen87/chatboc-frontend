# Frontend Enterprise Execution Pack — Chatboc

## TL;DR

El frontend debe operar como cliente enterprise de conversación en tiempo real y reconciliar listas/tickets desde eventos delta, no solo desde refetches completos.

---

## Contrato realtime actualizado

Además de escuchar:
- `conversation.message.created`
- `conversation.message.read`
- `ticket.status.changed`
- `ticket.assignment.changed`
- `ticket.presence.changed`

frontend ahora también debe escuchar:
- `ticket.unread.changed`

### Regla nueva de reconciliación
- usar `ticket.unread.changed` para actualizar badges/counters de listas e inbox sin hacer full refetch
- seguir usando `conversation.message.created` para insertar el mensaje/timeline
- usar `conversation.message.read` y `ticket.unread.changed` juntos para bajar contadores cuando alguien marca leído

---

## Presencia derivada

El backend ahora puede exponer además:
- `effective_presence_status = active | idle | inactive`
- `response.realtime_state.presence.idle_count`
- `response.realtime_state.read_state.viewers[*].effective_presence_status`

### Regla de UI sugerida
- `active` => viewer visible/activo ahora
- `idle` => viewer conectado pero sin actividad reciente
- `inactive` => viewer fuera del ticket o sin sesión vigente

---

## Métricas de colaboración por agente

En vistas dashboard/team pueden venir métricas por agente como:
- `active_ticket_views`
- `idle_ticket_views`
- `unread_ticket_views`

Usarlas para priorización operativa, badges por agente y vistas de carga/cobertura.

---

## Endpoints/contratos ya relevantes

- `dashboard-bundle.summary.active_viewers`
- `dashboard-bundle.summary.unread_viewers`
- `dashboard-bundle.leads.items[*].collaboration_state`
- `tickets/unread-summary.items[*].collaboration_state`

---

## Prioridad de implementación FE

1. adaptar listener/socket a `ticket.unread.changed`
2. reconciliar unread counters en listas sin refetch
3. mostrar `effective_presence_status` en inbox/tracking
4. fusionar métricas de agente (`active/idle/unread_ticket_views`) en dashboards/team
