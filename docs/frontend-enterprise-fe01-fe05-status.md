# Frontend FE-01 a FE-05 — estado operativo

## Cobertura implementada

- FE-01 App shell: navegación enterprise y guards centralizados de acceso (roles + capacidades).
- FE-02 Inbox omnicanal: lista de conversaciones, filtros por canal/estado/área/agente/prioridad, timeline y panel de detalle.
- FE-03 Live/admin bridge: fallback a polling cuando realtime no está disponible.
- FE-04 Roles/empleados: rutas operativas unificadas para gestión de equipo.
- FE-05 Notifications/templates: rutas y accesos operativos desde shell enterprise.

## Endpoints usados por frontend (sin inventar contratos)

- `GET /tickets/{tipo}` (lista de tickets)
- `GET /tickets/{tipo}/{ticketId}/timeline` (timeline unificado)
- `GET /tickets/{tipo}/{ticketId}/mensajes` (historial de mensajes)
- `POST /tickets/{tipo}/{ticketId}/mensajes` (envío de mensaje)
- `PUT /tickets/{tipo}/{ticketId}/estado` (cambio de estado)
- `POST /tickets/{tipo}/{ticketId}/assign` y variantes soportadas por fallback en cliente

## UX states contemplados

- loading
- empty
- error
- denied
- offline
- stale
- partial
