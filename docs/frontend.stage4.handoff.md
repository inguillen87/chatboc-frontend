# Frontend handoff — ejecución CRM omnicanal (alineado a backend)

> Documento de trabajo para equipo frontend (admin + portal + widget), diseñado para evitar drift con backend.

## 1) Contexto y objetivo

Backend quedó preparado para una estrategia más segura en runtime:

- El bootstrap automático de esquema (`db.create_all`) y tenant init está desactivado por defecto en producción.
- Se habilita solo por flags (`ENABLE_RUNTIME_SCHEMA_SYNC`, `ENABLE_RUNTIME_TENANT_INIT`) para entornos de dev/diagnóstico.
- La expectativa operativa es: migraciones explícitas + contratos API estables.

**Objetivo frontend:** avanzar en UX omnicanal sin depender de comportamientos “mágicos” del backend.

---

## 2) Entregables frontend (prioridad alta)

### FE-01 · Canonical routing por tenant
- Definir path canónico único: `/t/:tenantSlug/*`.
- Mantener prefijos legacy (`/market`, `/tenant`, `/municipio`, `/pyme`, etc.) solo como redirects.

### FE-02 · Hardening de TypeScript (modo gradual)
- Activar `strict` progresivo por módulos:
  1. `src/api/*`
  2. `src/context/*`
  3. `src/pages/market/*`
  4. `src/pages/portal/*`

### FE-03 · Contrato de identidad omnicanal en requests
- Propagar headers en cliente/web/widget:
  - `X-Contact-Key`
  - `X-Conversation-Id` (si existe contexto WhatsApp/handoff)
- Centralizar en wrapper de fetch/axios.

### FE-04 · Checkout E2E resiliente
- Orquestador con estados: `idle`, `validating`, `creating_order`, `awaiting_payment`, `success`, `error`.
- Reintento y recuperación de sesión/carro.

### FE-05 · Portal app separada (build aislado)
- Separar `portal-app` de `admin-app` a nivel build.
- Mantener widget en entrypoint independiente.
- Definir manifest/scope PWA específico de portal.

### FE-06 · Encuestas: contrato único
- Consumir endpoint canónico de encuestas públicas (v1).
- Remover fallback ambiguo cuando backend v1 esté activo.

### FE-07 · RBAC/capabilities consistente
- Mantener guards por `requiredCapabilities`.
- Fallback UX por permisos: 403 usable + CTA acceso + analytics de intento denegado.

---

## 3) Contratos frontend/backend a congelar

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

### Convención de eventos analytics
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
- Docs actualizadas.
- Tests mínimos: unitarios util/hook + integración rutas + smoke E2E portal/market.

---

## 6) Checklist QA antes de merge

- [ ] Deep links de WhatsApp abren pantalla correcta en ruta canónica.
- [ ] Carrito persiste entre refresh/reingreso.
- [ ] Checkout recupera estado tras error temporal.
- [ ] Portal instala como PWA con `start_url` y `scope` correctos.
- [ ] Errores 4xx/5xx muestran mensajes controlados y medibles.
- [ ] Denegaciones RBAC no rompen navegación.

---

## 7) Notas de coordinación con backend

- Backend prioriza migraciones explícitas; no asumir auto-create en runtime.
- Si aparece `5xx` en ambientes nuevos, validar primero estado de migraciones.
- Todo endpoint nuevo debe salir con contrato versionado + ejemplo de payload.

---

## 8) Novedades backend (Etapa 3) para FE

- `/analytics/event` devuelve `contract_version`, `contact_key`, `conversation_id`, `identity_source`.
- `/analytics/event/schema` expone catálogo canónico (`analytics.event_schema.v1`).
- Endpoints analytics con capabilities explícitas (`analytics.read`, `analytics.admin`).
- `/auth/widget/bootstrap` -> `auth.widget_bootstrap.v1`.
- `/auth/widget-token` y `/auth/widget-refresh` -> `auth.widget_token.v1`.
- `/tickets/public/status` -> `tickets.public_status.v1`.
- `/tickets/workflow/metadata` -> `tickets.workflow.v1`.
- `/public/encuestas/v1/<slug>` -> `encuestas.public.v1`.
- `POST /public/encuestas/<slug>/respuestas` -> `encuestas.public_response.v1`.
- `tenant-profile` -> `public.tenant_profile.v1` (+ `rubro_profile.education_profile`).
- `widget-config` -> `public.widget_config.v1` (quick menu educativo por rubro colegio/escuela).
- `/auth/demo/catalog` y `/auth/demo` -> 404 contractado con `auth.demo.v1` cuando demo mode off.
- Coverage `/analytics/identity/coverage` con `slo_status`, `alerts`, `alert_count`, `target_by_channel`, `emit_alert_events`.
- Funnel `/admin/analytics/whatsapp-funnel` con `contract_version` + `unique_contacts`.

### Acción frontend inmediata
1. Leer `X-Contact-Key`/`X-Conversation-Id` de responses críticas y persistir por tenant.
2. Reinyectar headers en requests subsiguientes.
3. En encuestas, guardar `contact_key`/`conversation_id` del ack.
4. En `/tenant-profile`, manejar 404 explícito sin fallback demo.

---

## 9) Contratos compartidos (fuente de verdad)

- `docs/analytics.identity_coverage.v1.contract.md`
- `docs/shared.error.v1.contract.md`
- `docs/public.tenant_profile.v1.contract.md`
- `docs/widget.quick_menu.education.v1.contract.md`
- `docs/public.widget_config.v1.contract.md`
- `docs/auth.demo.v1.contract.md`
- `docs/rbac.capability_matrix.v1.md`

