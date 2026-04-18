# Frontend handoff — ejecución CRM omnicanal (alineado a backend)

> Documento de trabajo para equipo frontend (admin + portal + widget), diseñado para evitar drift con backend.

## 1) Contexto y objetivo

Backend quedó preparado para una estrategia más segura en runtime:

- El bootstrap automático de esquema (`db.create_all`) y tenant init está desactivado por defecto en producción.
- Se habilita solo por flags (`ENABLE_RUNTIME_SCHEMA_SYNC`, `ENABLE_RUNTIME_TENANT_INIT`) para dev/diagnóstico.
- La expectativa operativa es: migraciones explícitas + contratos API estables.

**Objetivo frontend:** avanzar en UX omnicanal sin depender de comportamientos automáticos del backend.

---

## 2) Entregables frontend (prioridad alta)

### FE-01 · Canonical routing por tenant
- Path canónico único para tenant-facing flows: `/t/:tenantSlug/*`.
- Prefijos legacy (`/market`, `/tenant`, `/municipio`, `/pyme`, etc.) solo como redirects.

**Aceptación**
- Deep links de WhatsApp aterrizan en ruta canónica.
- `screen_name` de analytics estable/único.
- Tabla de redirecciones legacy → canónico documentada.

### FE-02 · Hardening de TypeScript (gradual)
- Activar strict progresivo por módulos críticos:
  1. `src/api/*`
  2. `src/context/*`
  3. `src/pages/market/*`
  4. `src/pages/portal/*`

**Aceptación**
- CI falla por type errors en alcance.
- Sin `any` nuevo salvo excepción justificada con comentario + ticket.

### FE-03 · Contrato de identidad omnicanal en requests
- Propagar headers en cliente/web/widget:
  - `X-Contact-Key`
  - `X-Conversation-Id` (si hay contexto de handoff)
- Centralizar en wrapper de red.

**Aceptación**
- Requests críticas (market, claims, surveys, portal dashboard) envían `X-Contact-Key`.
- Requests relevantes de handoff incluyen `X-Conversation-Id`.

### FE-04 · Checkout E2E resiliente
- State machine de checkout: `idle`, `validating`, `creating_order`, `awaiting_payment`, `success`, `error`.
- Reintentos y recuperación tras refresh/reingreso.

### FE-05 · Portal app separada (build aislado)
- Build de portal desacoplado de admin-app.
- Widget conserva entrypoint independiente.
- Manifest/scope PWA específico para portal.

### FE-06 · Encuestas: contrato único sin fallback ambiguo
- Consumir endpoint canónico público v1.
- Eliminar cascada de fallback legacy cuando backend v1 esté activo.

### FE-07 · RBAC/capabilities consistente con backend
- Mantener `requiredCapabilities` por pantalla.
- En denegación: 403 usable + CTA solicitar acceso + telemetry de intento denegado.

---

## 3) Contratos FE/BE a congelar

### Headers estándar
- `X-Tenant-Slug` (cuando aplique)
- `X-Contact-Key` (obligatorio en flujos de usuario)
- `X-Conversation-Id` (opcional, recomendado en handoffs)

### Convención de error
```json
{
  "error": {
    "code": 400,
    "message": "detalle"
  }
}
```

### Convención mínima de analytics
- `event_name`, `screen_name`, `tenant_id`, `channel`, `contact_key`, `metadata`.

---

## 4) Plan sugerido (4 sprints)

- **Sprint 1:** FE-01 + FE-03 + FE-07
- **Sprint 2:** FE-02 (`src/api`, `src/context`) + FE-06
- **Sprint 3:** FE-04
- **Sprint 4:** FE-05

---

## 5) Definition of Done transversal

- Telemetría en flujos críticos (`screen_view`, `api_error`, `checkout_step`, `permission_denied`).
- Sin `any` nuevo en módulos bajo hardening.
- Docs actualizadas (README frontend + changelog técnico).
- Tests mínimos: unitarios util/hook + integración rutas + smoke E2E portal/market.

---

## 6) Checklist QA previo a merge

- [ ] Deep links de WhatsApp abren ruta canónica correcta.
- [ ] Carrito persiste entre refresh/reingreso.
- [ ] Checkout recupera estado tras error temporal.
- [ ] Portal instala como PWA con `start_url` y `scope` correctos.
- [ ] Errores 4xx/5xx muestran mensaje controlado y medible.
- [ ] Denegaciones RBAC no rompen navegación.

---

## 7) Novedades backend (Etapa 3) a consumir en FE

- `/analytics/event` devuelve `contract_version`, `contact_key`, `conversation_id`, `identity_source`.
- `/analytics/event/schema` publica catálogo canónico + dimensiones.
- Analytics requiere capabilities explícitas (`analytics.read`, `analytics.admin`).
- `/auth/widget/bootstrap` -> `auth.widget_bootstrap.v1`.
- `/auth/widget-token` y `/auth/widget-refresh` -> `auth.widget_token.v1`.
- `/tickets/public/status` -> `tickets.public_status.v1`.
- `/tickets/workflow/metadata` -> `tickets.workflow.v1`.
- `/public/encuestas/v1/<slug>` -> `encuestas.public.v1`.
- `POST /public/encuestas/<slug>/respuestas` -> `encuestas.public_response.v1` (+ puede devolver `contact_key`, `conversation_id`).
- `tenant-profile` -> `public.tenant_profile.v1` (+ `rubro_profile.education_profile`).
- Coverage endpoint `/analytics/identity/coverage` con `slo_status`, `alerts`, `alert_count`, `target_by_channel`, `emit_alert_events=1`.
- `/admin/analytics/whatsapp-funnel` con `contract_version` y `unique_contacts`.

### Acción FE inmediata
1. Persistir `X-Contact-Key`/`X-Conversation-Id` por tenant desde responses críticas.
2. Reinyectar headers en requests subsiguientes.
3. En encuestas, guardar `contact_key`/`conversation_id` del ack.
4. En bootstrap público (`/tenant-profile`), manejar 404 explícito sin fallback demo.

---

## 8) Contratos compartidos (fuente de verdad)

- `docs/analytics.identity_coverage.v1.contract.md`
- `docs/shared.error.v1.contract.md`
- `docs/public.tenant_profile.v1.contract.md`
- `docs/widget.quick_menu.education.v1.contract.md`
- `docs/rbac.capability_matrix.v1.md`

