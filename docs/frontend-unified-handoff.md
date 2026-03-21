# Frontend Unified Handoff – Widget, Inbox, CRM, Heatmaps & Superadmin

> **Fuente única sugerida para frontend.**
> Si hay que compartir un solo documento, usar este.

## 1. TL;DR para pasar por Slack/WhatsApp

### Persistir en todos los requests del widget

- `X-Chat-Session-Id`
- `entityToken` o `X-Entity-Token` cuando exista tenant real
- `X-Anon-Id`
- `pin` cuando el usuario venga desde seguimiento público

### Decisión demo vs tenant real

Consumir `ux_context`:

- `trusted_owner`
- `owner_tipo_chat`
- `owner_name`
- `should_render_demo_shell`

**Regla de render recomendada**

- `trusted_owner=true` y `should_render_demo_shell=false` => shell tenant real
- en cualquier otro caso => shell/showroom demo

### Realtime que frontend debe escuchar

- `conversation.message.created`
- `ticket.status.changed`
- `ticket.assignment.changed`

### Prioridad operativa de tickets

Consumir:

- `sla_status`
- `operational_badges`
- `operational_metrics`

### Nuevos endpoints backend importantes

- `GET /api/admin/leads/pipeline`
- `GET /api/admin/leads/interactions`
- `GET /api/admin/leads/strategic-overview`
- `GET /api/admin/analytics/tenant-health`
- `GET /api/admin/analytics/executive-summary`
- `GET /api/admin/tenants/<slug>/profile-360`
- `GET /api/admin/tenants/<slug>/dashboard-bundle`
- `GET /api/admin/analytics/heatmap-categories-zones`

---

## 2. Widget público / tenant continuity

### Objetivo

En `chatboc.ar`, el primer contacto debe abrir demo selector, pero cuando haya contexto tenant válido el frontend debe pasar al shell real sin “volver” al showroom genérico.

### Backend ya cubre

- selector demo en origen público anónimo
- `ux_context` estable en respuestas de chat
- restauración segura de contexto tenant solo cuando corresponde
- protección contra fuga de owner por cookie JWT en landing pública

### Qué debe hacer frontend

1. Primer request:
   - `POST /api/ask/{tipo}`
   - `pregunta: "__INIT__"`
   - `X-Chat-Session-Id` estable
2. Reenviar en todos los turnos:
   - `entityToken/X-Entity-Token` cuando exista tenant real
   - `X-Anon-Id`
   - `pin` si viene desde tracking
3. Si llega:
   - `fuente: "demo_selector"`
   - `options_list` o `botones`
     entonces renderizar selector y reenviar `action_id=demo_select_rubro:<key>`
4. Evitar doble init con `initSent`

### Telemetría FE recomendada

- `widget_opened`
- `demo_selector_rendered`
- `demo_option_clicked`
- `tenant_context_restored`
- `tenant_context_lost`
- `demo_shell_render_blocked`
- `lead_cta_clicked`

---

## 3. Inbox omnicanal + SLA

### Contrato backend ya listo

#### Ticket list/detail

- `sla_status`
- `operational_badges`
- `operational_metrics.age_hours`
- `operational_metrics.inactivity_hours`
- `timeline`
- `asignado_a`

#### Realtime

- `conversation.message.created`
- `ticket.status.changed`
- `ticket.assignment.changed`

### UX recomendada

- vista `lista + mapa`
- tabs: `Abiertos`, `Sin asignar`, `SLA`, `Mío`, `Omnicanal`
- drawer lateral 360 con:
  - timeline
  - chat
  - adjuntos
  - mapa
  - SLA
  - asignación

### Badges FE sugeridos

- `sin_asignar`
- `por_vencer`
- `vencido`
- `respuesta_pendiente`

---

## 4. Heatmaps / mapas operativos

### Endpoint backend

- `GET /api/admin/analytics/heatmap-categories-zones?since_days=30`

### Payload esperado

- `top_categories`
- `top_zones`
- `heatmap_points`

### UX sugerida

- switch `puntos | clusters | heatmap`
- click en categoría/zona => filtra inbox/dashboard
- layout sincronizado `lista + mapa`

---

## 5. Superadmin CRM

### Endpoints principales

- `GET /api/admin/leads/pipeline`
- `GET /api/admin/leads/interactions`
- `PATCH /api/admin/leads/{ticket_id}/stage`
- `PATCH /api/admin/leads/bulk-stage`
- `GET /api/admin/leads/{ticket_type}/{ticket_id}/timeline`
- `POST /api/admin/leads/{ticket_type}/{ticket_id}/timeline`
- `POST /api/admin/leads/playbooks/run`
- `GET /api/admin/leads/strategic-overview?since_days=30`

### Qué ya devuelve backend

#### `strategic-overview`

- `totals`
- `by_stage`
- `by_tenant`
- `portfolio.top_open_tenants`
- `portfolio.active_tenants`
- `alerts`

#### `interactions`

- `sla_breached`
- `lead_score`

#### `executive-summary`

- `strategic_overview`
- `tenant_health`
- `realtime`
- `heatmap`
- `recommended_actions`

### UX sugerida

- kanban pipeline
- tabla priorizada por `lead_score`
- filtro 1-click “solo SLA vencido”
- preview + confirm para playbooks
- dashboard ejecutivo con cards + ranking por tenant
- usar `executive-summary` para reducir roundtrips en vistas CEO/superadmin

---

## 6. Tenant profile / account executive view

### Nuevo endpoint backend

- `GET /api/admin/tenants/<slug>/profile-360?since_days=30`
- `GET /api/admin/tenants/<slug>/dashboard-bundle?since_days=30`

### Devuelve

- `tenant`
- `owner`
- `health`
- `metrics`
- `onboarding`
- `meta`

### Casos de uso frontend

- perfil tenant 360
- health score
- checklist de activación
- alertas de cuenta (`sla_breached`, `catalog_missing`, `whatsapp_not_connected`, etc.)

### Vista recomendada

- header con branding + plan + owner + dominio
- cards KPI
- score + alertas
- checklist onboarding:
  - branding
  - widget
  - whatsapp
  - catálogo
  - encuestas
  - tracking
  - analytics

### Panel operativo tenant (`dashboard-bundle`)

#### Devuelve

- `tenant`
- `summary`
- `leads`
- `surveys`
- `unread`
- `team`
- `recommended_actions`
- `meta`

#### Qué desbloquea en frontend

- dashboard tenant con una sola llamada
- backlog de leads/SLA
- tickets con mensajes sin leer
- carga del equipo / workload operativo
- recomendaciones priorizadas para operar

#### Reemplaza roundtrips separados a

- leads
- encuestas / overview
- tickets unread summary
- employees workload

---

## 7. Tenant health ranking

### Endpoint backend

- `GET /api/admin/analytics/tenant-health?since_days=30`

### Devuelve por tenant

- `health_score`
- `win_rate`
- `response_rate`
- `sla_breached`
- `alerts`
- `onboarding_completion`
- `catalog_items`
- `survey_responses`

### UX sugerida

- ranking de tenants
- filtros por plan/tipo/riesgo
- badge de riesgo y score visible
- drilldown hacia `profile-360`

---

## 8. Widget lead capture / catálogo

### Flujo demo lead capture

- botón `open_demo_form`
- backend responde `fuente: "demo_lead_capture"`
- secuencia `pedir_info`: `nombre -> telefono -> email`

### Recomendación FE

- barra 1/3, 2/3, 3/3
- transcript persistente
- no resetear progreso en re-preguntas

### Render comercial estructurado

Cuando `fuente` sea:

- `catalogo_qdrant_con_promos_v2`
- `catalogo_fallback_faq`
- `catalogo_fallback_web`

Mostrar:

- resumen
- hasta 3 productos destacados
- CTAs:
  - `pedir_presupuesto_pyme`
  - `hablar_con_agente_pyme_catalogo`
  - `ver_catalogo_pyme_buscar_otra`

---

## 9. Roadmap UX/UI recomendado

### Operaciones

- inbox omnicanal premium
- panel lateral 360
- heatmap + hotspots
- dashboard diario operativo

### Superadmin / comercial

- portfolio board de tenants
- account executive drilldown
- vista health/risk
- revenue intelligence + ranking

### Tenant profile

- activación
- integraciones
- health score
- onboarding checklist

### Analytics

- KPI strip ejecutivo
- funnel por tenant/canal
- heatmap geográfico
- cohortes/series temporales

---

## 10. Orden sugerido de implementación frontend

### Fase 1

1. `ux_context`
2. persistencia de headers/contexto
3. realtime inbox
4. badges SLA

### Fase 2

5. lista + mapa
6. drawer ticket 360
7. strategic overview
8. tenant health ranking

### Fase 3

9. tenant `profile-360`
10. tenant `dashboard-bundle`
11. playbooks
12. dashboards ejecutivos
13. heatmaps avanzados

---

## 11. Criterio práctico

Si me pedís qué mandarle al frontend **hoy**, mandales este archivo y deciles:

> “Tomen este MD como contrato único backend->frontend. Si implementan primero `ux_context`, realtime, badges SLA, `strategic-overview`, `tenant-health`, `profile-360` y `dashboard-bundle`, ya podemos mostrar un producto muy serio de cara a demo, operaciones, tenant admin y superadmin.”
