# Frontend Task Board – Demo UX + CRM Superadmin (Parallel Work)

> Documento consolidado recomendado: `docs/FRONTEND_SINGLE_TASK_WORLD_CLASS_CHAT.md`.
> Documento complementario de detalle: `docs/FRONTEND_UNIFIED_HANDOFF.md`.

## Sprint objetivo
Subir conversión de demo y velocidad comercial con UX consistente entre widget público y CRM superadmin.

---

## EPIC A — Widget Demo UX (Público)

### FE-101 · Bootstrap robusto
**Descripción:** enviar `__INIT__` y mantener `X-Chat-Session-Id` estable en todos los mensajes.
**Backend contrato:** `/api/ask/{tipo}` + respuesta `fuente=demo_selector`.
**Aceptación:** al abrir widget en chatboc.ar, siempre aparece selector rubro.

### FE-102 · Selector de rubros visual
**Descripción:** render `options_list/botones` con cards y CTA claros.
**Aceptación:** click envía `action_id=demo_select_rubro:<key>`.

### FE-103 · Captura de lead 3 pasos
**Descripción:** flujo UI para `open_demo_form` + `pedir_info=nombre/telefono/email`.
**Aceptación:** se ve progreso 1/3, 2/3, 3/3 y confirma `#nro_ticket`.

### FE-104 · Estados de error amigables
**Descripción:** validar teléfono/email antes de enviar y mostrar errores inline.
**Aceptación:** usuario corrige sin romper conversación.

### FE-105 · Continuidad tenant real vs demo
**Descripción:** consumir `ux_context` en la respuesta del chat para decidir si el widget debe renderizar shell demo o shell tenant real.
**Backend contrato:** `/api/ask/{tipo}` devuelve `ux_context.trusted_owner`, `ux_context.owner_tipo_chat`, `ux_context.should_render_demo_shell`.
**Aceptación:** si `trusted_owner=true` y `owner_tipo_chat=municipio`, nunca reaparece el showroom genérico al segundo turno.

### FE-106 · Propagación fuerte de contexto
**Descripción:** reenviar en todos los mensajes `entityToken`/`X-Entity-Token`, `X-Chat-Session-Id`, `X-Anon-Id` y `pin` cuando el usuario venga desde seguimiento de reclamo.
**Aceptación:** no hay saltos de contexto entre saludo inicial, captura de nombre y mensajes siguientes; el seguimiento público no vuelve a `403`.

---

## EPIC B — CRM Superadmin Multitenant

### FE-201 · Dashboard KPI
**Descripción:** cards usando `/api/admin/leads/pipeline`.
**Métricas:** `total`, `conversion_rate`, `avg_first_response_seconds`, `ganado/perdido`.

### FE-202 · Kanban pipeline
**Descripción:** columnas por `stage` y cards por lead.
**Datos:** `items[]` del endpoint pipeline.

### FE-203 · Cambio de etapa (nuevo)
**Descripción:** drag/drop o selector que llama:
`PATCH /api/admin/leads/{ticket_id}/stage` con `{ "stage": "...", "note": "..." }`.
**Stages válidos:**
`nuevo`, `contactado`, `calificado`, `demo_agendada`, `propuesta_enviada`, `ganado`, `perdido`.

### FE-204 · Filtros globales
**Descripción:** filtros por `tenant_slug` y `since_days` en pipeline e interactions.

### FE-205 · Contacto rápido
**Descripción:** acciones `wa.me`, `mailto`, copiar datos.
**Aceptación:** 1 click para contactar prospecto.

---

## EPIC C — Tracking & Analytics UX

### FE-301 · Telemetría onboarding
Eventos: `widget_opened`, `demo_selector_rendered`, `demo_option_clicked`, `lead_cta_clicked`, `lead_completed`.

### FE-302 · Funnel visual
Vista embudo usando `by_stage` + filtros.

---

## EPIC D — Unified Inbox + SLA

### FE-401 · Inbox omnicanal
**Descripción:** unificar ticket, mensajes, estados y adjuntos en una sola vista viva.
**Backend contrato sugerido:** usar `ux_context` + timeline canónica + sockets por ticket (`conversation.message.created`, `ticket.status.changed`, `ticket.assignment.changed`).
**Aceptación:** el operador no cambia de módulo para ver chat, estado, mapa y últimos eventos.

### FE-402 · Badge SLA / urgencia
**Descripción:** mostrar badges `sin_asignar`, `por_vencer`, `vencido`, `respuesta_pendiente`.
**Backend contrato sugerido:** consumir `sla_status`, `operational_badges` y `operational_metrics`.
**Aceptación:** priorización visual inmediata en lista y detalle.

### FE-403 · Layout lista + mapa en vivo
**Descripción:** combinar inbox con mapa sincronizado para que cada filtro aplique tanto a cards como a puntos/celdas.
**Backend contrato sugerido:** usar detalle ticket + endpoints de mapa (`/tickets/<tipo>/mapa`) + `operational_badges`.
**Aceptación:** click en ticket centra mapa y click en zona/mapa filtra la lista.

### FE-404 · Panel lateral de ticket 360
**Descripción:** abrir drawer lateral con timeline, chat, adjuntos, ubicación, SLA y asignación sin salir del board.
**Backend contrato sugerido:** `timeline`, `conversation.message.created`, `ticket.status.changed`, `ticket.assignment.changed`.
**Aceptación:** operador resuelve casi todo desde el panel lateral.

---

## EPIC E — Paneles Operativos + Heatmaps

### FE-501 · Dashboard operativo diario
**Descripción:** cards de `backlog`, `sin asignar`, `por vencer`, `vencidos`, `primera respuesta` y `resueltos hoy`.
**Aceptación:** permite priorizar la mañana operativa en menos de 30 segundos.

### FE-502 · Heatmap por categoría y zona
**Descripción:** vista geográfica con capas `puntos`, `clusters` y `heatmap`.
**Backend contrato sugerido:** endpoints de mapa/analytics + filtros por `estado`, `categoria`, `zona`.
**Aceptación:** identificar hotspots y saltar a tickets de esa área en un click.

### FE-503 · Filtros ejecutivos persistentes
**Descripción:** guardar filtros (tenant, canal, SLA, agente, zona, categoría) en querystring/local storage.
**Aceptación:** soporte comercial y operaciones comparten links exactos con el mismo estado visual.

---

## EPIC F — Perfil Tenant + Health Score

### FE-601 · Tenant profile 360
**Descripción:** ficha del tenant con branding, owner, plan, canales, dominios, integraciones y métricas clave.
**Aceptación:** superadmin entiende “estado de cuenta” sin navegar módulos sueltos.

### FE-602 · Checklist de activación
**Descripción:** onboarding visual con pasos `branding`, `widget`, `WhatsApp`, `catálogo`, `encuestas`, `tracking`, `analytics`.
**Aceptación:** queda claro qué falta para llevar cada tenant a producción seria.

### FE-603 · Health score del tenant
**Descripción:** score compuesto con uso, conversión, SLA, actividad y completitud de setup.
**Aceptación:** permite priorizar cuentas en riesgo o con mayor potencial.

---

## EPIC G — Superadmin CRM + Revenue Intelligence

### FE-701 · Portfolio board de tenants
**Descripción:** board/tablero de cuentas con ranking por `pipeline`, `win_rate`, `sla_breached`, `actividad`.
**Aceptación:** dirección comercial detecta rápido dónde intervenir.

### FE-702 · CRM account drilldown
**Descripción:** entrar a una cuenta y ver funnel, últimos leads, health score, timeline y actividad omnicanal.
**Aceptación:** el superadmin tiene vista “account executive” real.

### FE-703 · Dashboard ejecutivo
**Descripción:** combinar KPIs, evolución temporal, comparación entre tenants y alertas accionables.
**Aceptación:** sirve tanto para founders como para operaciones/comercial.

---

## Dependencias backend (ya listas)
- `GET /api/admin/leads/pipeline`
- `PATCH /api/admin/leads/{ticket_id}/stage`
- `GET /api/admin/leads/interactions`
- Flujo demo lead capture: `action_id=open_demo_form`
- Respuesta chat enriquecida con `ux_context`
- Eventos realtime normalizados: `conversation.message.created`, `ticket.status.changed`, `ticket.assignment.changed`
- Tickets con `sla_status`, `operational_badges`, `operational_metrics`


## Update de colaboración realtime

- escuchar `ticket.unread.changed` para reconciliar unread counters de listas
- usar `effective_presence_status = active | idle | inactive` cuando venga en presencia/read-state
- contemplar `response.realtime_state.presence.idle_count`
- contemplar métricas team/agent: `active_ticket_views`, `idle_ticket_views`, `unread_ticket_views`
