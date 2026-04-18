# Backlog ejecutable omnicanal (separado por ownership)

> Objetivo: evitar drift frontend/backend y bajar el plan a tareas pequeñas, verificables y con dependencias explícitas.

---

## 0) Contratos compartidos (bloqueantes)

### CT-01 · Contrato API/eventos v1 congelado
**Owner:** Frontend + Backend  
**Salida:** `docs/contracts/omnicanal-v1.md` versionado con changelog.

**Incluye**
- Auth/session headers: `X-Tenant-Slug`, `X-Contact-Key`, `X-Conversation-Id`, `X-Chat-Session-Id`, `X-Anon-Id`.
- Flujos: tickets, encuestas, marketplace, portal usuario, analytics y deep links WhatsApp/widget.
- Eventos socket: nombre, payload mínimo y semántica.

**DoD**
- Existe tabla de endpoints/eventos con payload de ejemplo.
- Cambios incompatibles requieren versión (`v2`) y deprecación.

---

### CT-02 · Matriz de roles/capabilities única
**Owner:** Backend (source of truth) + Frontend (consumo UI).  
**Salida:** `docs/contracts/rbac-capabilities-v1.md`.

**Roles mínimos**
- `superadmin`
- `tenant_admin`
- `employee`/`agent`
- `catalog_manager`
- `analytics_viewer`
- `end_user`/`chat_user`

**DoD**
- Backend expone capabilities por sesión.
- Frontend renderiza navegación por capabilities (no por hardcode ad-hoc).

---

### CT-03 · Esquema analítico único
**Owner:** Data + Frontend + Backend.  
**Salida:** `docs/contracts/analytics-events-v1.md`.

**Eventos mínimos**
- `message_received`
- `ticket_created`
- `ticket_assigned`
- `ticket_resolved`
- `survey_answered`
- `vote_submitted`
- `product_viewed`
- `cart_started`
- `checkout_created`
- `location_shared`
- `widget_session_opened`
- `portal_session_opened`

**DoD**
- Cada evento define `event_name`, `screen_name`, `tenant_id`, `channel`, `contact_key`, `metadata`.

---

## 1) Backlog frontend (chunked)

## P0

### FE-01A · API client: persistencia identidad por tenant
**Owner:** Frontend  
**Scope:** `src/utils/api.ts`, `src/api/client.ts`.

**DoD**
- Si backend responde `X-Contact-Key` / `X-Conversation-Id`, se persiste por tenant.
- Requests siguientes reinyectan headers automáticamente.

---

### FE-01B · API client: fallback global de identidad
**Owner:** Frontend  
**DoD**
- Si no existe snapshot por tenant, usar snapshot global.
- No se pierde continuidad entre flujos públicos y tenant-scoped.

---

### FE-02A · Guards de rutas por capabilities
**Owner:** Frontend  
**Scope:** rutas admin, market, portal interno.

**DoD**
- Si capability falta: pantalla 403 usable + CTA solicitar acceso.
- Registrar `permission_denied` con capability + screen + tenant.

---

### FE-02B · Menú por rol/capabilities
**Owner:** Frontend  
**DoD**
- Sidebar/navbar sólo muestra módulos habilitados.
- No hay “opciones fantasma” que backend rechaza luego.

---

### FE-03A · Inbox operativo mínimo (reclamos)
**Owner:** Frontend  
**DoD**
- Filtros por SLA, prioridad, estado, categoría, asignado.
- Timeline + leído/no leído en la misma vista.

---

### FE-04A · UI de reglas de asignación
**Owner:** Frontend  
**DoD**
- Pantalla para mapear categoría/zona/prioridad -> equipo/agente.
- Persistencia vía API versionada (sin lógica local hardcode).

---

### FE-05A · Builder encuestas/votaciones
**Owner:** Frontend  
**DoD**
- Crear/publicar/cerrar + resultados + exportar.
- UX separada para “encuesta” vs “votación”.

---

### FE-07A · Wizard catálogo/marketplace
**Owner:** Frontend  
**DoD**
- Carga de catálogo, preview storefront, estados, media y variantes.

---

### FE-08A · Portal usuario app separada (build)
**Owner:** Frontend  
**DoD**
- Bundle del portal aislado de admin.
- Rutas mínimas: inicio, catálogo, producto, carrito, pedidos, reclamos, perfil.

---

### FE-09A · Deep link desde WhatsApp/widget al portal correcto
**Owner:** Frontend  
**DoD**
- Entrada contextual por tenant, sin pasos manuales extra.

---

### FE-10A · Widget móvil reclamos (fricción mínima)
**Owner:** Frontend  
**DoD**
- Subida foto/audio/ubicación, seguimiento estado y continuidad de conversación.

---

## 2) Backlog backend (para coordinación)

### BE-01 · Endpoints versionados + ejemplos de payload
**DoD**
- Cada endpoint nuevo sale con contrato y ejemplo para tipado FE inmediato.

### BE-02 · Capabilities por sesión + rechazo estándar
**DoD**
- Rechazo homogéneo con `error.code`/`error.message`.

### BE-03 · Omnichannel identity first-class
**DoD**
- `contact_key` y `conversation_id` en respuestas críticas (analytics, market, encuestas, tickets).

### BE-04 · Realtime estable
**DoD**
- Eventos socket con naming consistente y payload mínimo documentado.

---

## 3) Orden sugerido (4 sprints)

### Sprint 1
- CT-01, CT-02, FE-01A, FE-01B, FE-02A

### Sprint 2
- FE-02B, FE-03A, FE-04A, FE-05A

### Sprint 3
- FE-07A, FE-09A, FE-10A

### Sprint 4
- FE-08A + hardening de performance/TTI/PWA

