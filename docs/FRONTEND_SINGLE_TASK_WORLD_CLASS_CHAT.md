# Frontend Task Única — World Class Chatboc UX (Widget + WhatsApp Inbox + CRM + Heatmaps)

> **Este es el único documento que hay que mandar al frontend.**
> Si FE necesita una sola tarea consolidada, usar esta.

---

## 1. Nombre de la tarea

**Construir la experiencia frontend unificada de Chatboc para operación world-class**, cubriendo en una sola entrega:
- widget web público/tenant,
- continuidad de sesión y contexto tenant,
- inbox omnicanal con realtime,
- creación guiada de reclamos y pedidos,
- CRM/boards operativos,
- heatmaps y dashboards tenant/superadmin.

---

## 2. Objetivo de negocio

El frontend debe permitir que Chatboc se sienta como un SaaS de nivel mundial:
- **más conversión** en widget demo/tenant,
- **menos fricción** para crear reclamos o pedidos,
- **más velocidad operativa** para agentes,
- **más claridad ejecutiva** para tenant admins y superadmin,
- **una sola UX coherente** entre web, WhatsApp, inbox, CRM y analítica.

---

## 3. Qué debe quedar listo en esta tarea

### A. Widget web unificado
Construir un widget que soporte:
- modo demo/showroom,
- modo tenant real,
- continuidad de sesión,
- captura progresiva de datos,
- audio/imagen/adjuntos,
- realtime opcional,
- UX guiada para reclamos/pedidos.

### B. Inbox omnicanal premium
Construir una vista operador con:
- lista de tickets/conversaciones,
- panel lateral 360,
- timeline,
- chat vivo,
- SLA badges,
- asignación,
- mapa sincronizado,
- eventos realtime.

### C. Tenant admin dashboards
Construir:
- dashboard bundle,
- heatmap summary,
- employee coverage,
- health/operación diaria.

### D. Superadmin / CRM / portfolio
Construir:
- strategic overview,
- tenant health ranking,
- executive summary,
- vistas accionables por tenant.

---

## 4. Entregables frontend obligatorios

### 4.1 Widget shell inteligente
El widget debe decidir entre:
- **demo shell**,
- **tenant shell real**.

Usar `ux_context` para decidir:
- `trusted_owner`
- `owner_resolution_source`
- `owner_tipo_chat`
- `owner_name`
- `tenant_slug`
- `should_render_demo_shell`
- `channel_capabilities`
- `recommended_experience`

### Regla de render
- Si `trusted_owner=true` y `should_render_demo_shell=false` → renderizar **tenant real**.
- En cualquier otro caso → renderizar **demo/showroom**.

---

### 4.2 Composer world-class
El input del chat debe soportar:
- texto,
- quick replies,
- botones,
- listas,
- adjuntar imagen,
- adjuntar archivo,
- grabar/enviar audio,
- compartir ubicación,
- realtime voice entrypoint cuando esté habilitado.

Debe leer desde `ux_context.channel_capabilities`:
- `supports_audio_input`
- `supports_file_upload`
- `supports_image_input`
- `supports_location_share`
- `supports_realtime`

---

### 4.3 Flujo guiado de reclamos/pedidos
Cuando backend mande `pedir_info`, frontend debe mostrar un paso guiado y no una UX genérica.

Casos típicos:
- `nombre`
- `telefono`
- `email`
- `ubicacion`
- `categoria`
- `descripcion`
- `nombre_cliente_pedido`
- `productos_del_pedido`

### Reglas UX
- mostrar chips/stepper de progreso,
- no perder transcript,
- no resetear el flujo si backend repregunta,
- si backend pide solo `email`, no volver a mostrar formulario completo,
- si backend trae botones/lista, renderizar interacción rica.

---

### 4.4 Inbox omnicanal operator-first
Construir una pantalla principal con layout:
- **columna izquierda:** lista de tickets / leads / conversaciones,
- **centro:** chat/timeline,
- **derecha o drawer:** ticket 360 / mapa / SLA / asignación.

### Cada item debe mostrar
- estado,
- último mensaje,
- tiempo desde última actividad,
- asignado o no,
- `sla_status`,
- `operational_badges`,
- canal,
- tenant,
- categoría,
- zona.

### Drawer 360
Debe mostrar:
- conversación,
- timeline,
- adjuntos,
- mapa/ubicación,
- estado,
- asignación,
- badges SLA,
- acciones rápidas.

---

### 4.5 Realtime socket UX
Frontend debe escuchar y actualizar vivo con:
- `conversation.message.created`
- `ticket.status.changed`
- `ticket.assignment.changed`

Y mantener compatibilidad con eventos legacy si siguen llegando.

### Comportamiento esperado
- nuevo mensaje → actualizar lista + panel abierto,
- cambio de estado → badge instantáneo,
- cambio de asignación → refresh del item y del detail drawer,
- no romper scroll ni foco del operador.

---

### 4.6 Mapas / heatmaps
Construir vistas geográficas para:
- tenant admin,
- superadmin,
- inbox operativo.

### Modos visuales mínimos
- puntos,
- clusters,
- heatmap.

### Interacciones mínimas
- click en punto → abre ticket/detail,
- click en hotspot/categoría/zona → filtra lista,
- filtros persistidos en querystring.

---

### 4.7 Dashboards tenant
Construir cards y vistas para:
- `GET /api/admin/tenants/<slug>/dashboard-bundle`
- `GET /api/admin/tenants/<slug>/heatmap-summary`
- `GET /api/admin/tenants/<slug>/employees/coverage`

### Mostrar como mínimo
#### dashboard-bundle
- summary,
- recommended_actions,
- unread tickets,
- leads/timeline,
- surveys/widgets si vienen.

#### heatmap-summary
- `top_categories`
- `top_zones`
- `hotspots`
- `heatmap_points`

#### employees/coverage
- cobertura por:
  - categorías,
  - zonas,
  - permisos,
- lista de empleados con `scope`.

---

### 4.8 Superadmin portfolio / CRM
Construir vistas usando:
- `GET /api/admin/leads/strategic-overview`
- `GET /api/admin/analytics/tenant-health`
- `GET /api/admin/analytics/heatmap-categories-zones`
- `GET /api/admin/analytics/executive-summary`

### UX mínima esperada
- ranking de tenants,
- cards ejecutivas,
- tabla portfolio,
- alertas accionables,
- drilldown por tenant,
- heatmap ejecutivo,
- filtros por ventana temporal.

---

## 5. Contrato backend que frontend debe consumir

## 5.1 Chat / widget
### Inicialización
- `POST /api/ask/{tipo}` con `pregunta: "__INIT__"`

### Headers / contexto que FE debe persistir y reenviar siempre
- `X-Chat-Session-Id`
- `X-Anon-Id`
- `X-Entity-Token` o `entityToken` cuando exista
- `pin` si viene desde tracking público

### Campos relevantes de respuesta
- `message_body`
- `options_list`
- `botones`
- `message_type`
- `fuente`
- `pedir_info`
- `ux_context`
- `audio_url` / `audio`
- `data`

---

## 5.2 Tenant admin
- `GET /api/admin/tenants/<slug>/dashboard-bundle`
- `GET /api/admin/tenants/<slug>/heatmap-summary`
- `GET /api/admin/tenants/<slug>/employees/coverage`

---

## 5.3 Superadmin / analytics
- `GET /api/admin/leads/strategic-overview`
- `GET /api/admin/analytics/tenant-health`
- `GET /api/admin/analytics/heatmap-categories-zones`
- `GET /api/admin/analytics/executive-summary`

---

## 5.4 Realtime público/widget
Si el widget tiene realtime habilitado, contemplar:
- `POST /api/public/realtime/session`
- `POST /api/public/realtime/action-event`

Y atributos de config tipo:
- `data-realtime-model`
- `data-realtime-voice-enabled`
- `data-realtime-video-enabled`

---

## 6. Diseño UX/UI esperado

## 6.1 Widget
Estilo premium, no chatbot “viejo”.

### Debe tener
- header con branding tenant/demo,
- transcript limpio,
- quick replies modernas,
- cards/listas visuales,
- composer sticky,
- adjuntos con preview,
- estados de carga elegantes,
- empty states buenos,
- barra/indicador de progreso en flujos guiados.

### Comportamientos clave
- si backend pide ubicación → CTA visible de compartir ubicación,
- si backend manda opciones → render atractivo y grande para mobile,
- si backend solo pide email → input puntual, no formulario masivo,
- si canal permite realtime → CTA “hablar” o “audio” visible.

---

## 6.2 Inbox
Debe sentirse mezcla de:
- Intercom,
- Zendesk,
- HubSpot Inbox,
- Linear/Notion clarity,
- map-driven operations.

### Prioridades visuales
- SLA vencido muy visible,
- sin asignar muy visible,
- unread/recent activity muy visible,
- filtros rápidos arriba,
- panel 360 sin navegar de página.

---

## 6.3 Dashboards
No hacer dashboards “solo métricas”.

Deben ser:
- accionables,
- con alertas,
- con drilldown,
- con filtros persistentes,
- con links directos a tickets/leads.

---

## 7. Casos de uso críticos a cubrir

### Caso 1 — widget público demo
Usuario entra a `chatboc.ar` → ve selector demo → elige rubro → conversa → deja lead.

### Caso 2 — widget tenant real
Usuario entra con tenant/contexto válido → no debe volver al showroom demo → conversación sigue con tenant correcto.

### Caso 3 — reclamo municipal guiado
Usuario inicia reclamo → backend pide solo lo faltante → FE muestra flujo por pasos → confirma ticket.

### Caso 4 — pedido pyme guiado
Usuario manda texto/audio/foto/PDF → FE muestra resumen, productos y contacto → backend guía hasta cierre.

### Caso 5 — operador inbox
Agente ve lista + badge SLA + chat + mapa + asignación en una sola vista.

### Caso 6 — tenant admin operativo
Admin entra a dashboard-bundle + heatmap + employee coverage y entiende backlog, hotspots y gaps de cobertura.

### Caso 7 — superadmin ejecutivo
Superadmin entra a overview + tenant health + executive summary y detecta cuentas críticas/oportunidades.

---

## 8. Criterios de aceptación

## 8.1 Widget
- persiste `X-Chat-Session-Id` en toda la conversación,
- usa `ux_context` para demo vs tenant real,
- renderiza `pedir_info` como flujo guiado,
- soporta botones/listas/adjuntos/audio,
- no rompe contexto en refresh,
- mobile first real.

## 8.2 Inbox
- actualiza con realtime,
- muestra badges SLA y asignación,
- tiene drawer 360,
- conecta lista y mapa,
- filtra sin recargar toda la app.

## 8.3 Dashboards
- tenant dashboard bundle usable,
- heatmap usable,
- employee coverage legible,
- executive summary superadmin claro,
- drilldown fácil.

## 8.4 Calidad visual
- diseño consistente,
- componentes reutilizables,
- loading/skeletons correctos,
- estados vacíos y errores bien resueltos,
- listo para vender/demo enterprise.

---

## 9. Orden sugerido de implementación FE

### Fase 1
- widget shell
- `ux_context`
- composer premium
- guided intake (`pedir_info`)

### Fase 2
- inbox omnicanal
- realtime events
- ticket 360 + SLA badges

### Fase 3
- tenant admin dashboards
- heatmap summary
- employee coverage

### Fase 4
- superadmin portfolio
- tenant health
- executive summary

---

## 10. Copy-paste corto para mandar al front

**TAREA FRONT ÚNICA:**
Construir la experiencia frontend unificada de Chatboc: widget web premium con continuidad tenant/demo usando `ux_context`, flujo guiado de creación de reclamos/pedidos usando `pedir_info`, inbox omnicanal con realtime (`conversation.message.created`, `ticket.status.changed`, `ticket.assignment.changed`), panel ticket 360 con SLA badges, mapas/heatmaps sincronizados, dashboard tenant (`dashboard-bundle`, `heatmap-summary`, `employees/coverage`) y superadmin portfolio (`strategic-overview`, `tenant-health`, `executive-summary`). Tiene que verse y sentirse world-class, mobile-first y lista para demo enterprise.

---

## 11. Fuente relacionada

Si FE necesita más detalle complementario, puede mirar después:
- `docs/FRONTEND_UNIFIED_HANDOFF.md`
- `docs/frontend-task-board.md`
- `docs/frontend-demo-widget-handoff.md`
- `docs/frontend-next-pack.md`
