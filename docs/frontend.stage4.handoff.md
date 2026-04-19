# Frontend handoff — ejecución CRM omnicanal (alineado a backend)

> Documento de trabajo para equipo frontend (admin + portal + widget), diseñado para evitar drift con backend.

## 1) Contexto y objetivo

Backend quedó preparado para una estrategia más segura en runtime:

- El bootstrap automático de esquema (`db.create_all`) y tenant init ahora está **desactivado por defecto en producción**.
- Se habilita solo por flags (`ENABLE_RUNTIME_SCHEMA_SYNC`, `ENABLE_RUNTIME_TENANT_INIT`) para entornos de dev/diagnóstico.
- La expectativa operativa es: migraciones explícitas + contratos API estables.

**Objetivo frontend:** avanzar en UX omnicanal sin depender de comportamientos “mágicos” del backend.

---

## 2) Entregables frontend (prioridad alta)

## FE-01 · Canonical routing por tenant

### Qué implementar
- Definir un único path canónico para tenant-facing flows (recomendado: `/t/:tenantSlug/*`).
- Mantener prefijos legacy (`/market`, `/tenant`, `/municipio`, `/pyme`, etc.) solo como redirects client-side hacia canónico.

### Criterios de aceptación
- Deep links compartidos por WhatsApp siempre aterrizan en la ruta canónica.
- Analytics de pantalla (`screen_name`) usa nombres únicos y estables.
- Documentar tabla de redirecciones (legacy -> canónico).

### Riesgo que evita
- Fragmentación de navegación y métricas duplicadas por múltiples rutas equivalentes.

---

## FE-02 · Hardening de TypeScript (modo gradual)

### Qué implementar
- Activar `strict` progresivo por carpetas/módulos críticos:
  1. `src/api/*`
  2. `src/context/*`
  3. `src/pages/market/*`
  4. `src/pages/portal/*`

### Criterios de aceptación
- CI falla ante errores de tipos en módulos bajo alcance.
- No usar `any` salvo excepciones justificadas (con comentario y ticket).
- Reducir warnings por sprint con “type budget”.

### Riesgo que evita
- Bugs runtime por payloads ambiguos y contratos implícitos.

---

## FE-03 · Contrato de identidad omnicanal en requests

### Qué implementar
- En cliente web/widget agregar propagación de headers:
  - `X-Contact-Key`
  - `X-Conversation-Id` (si existe contexto WhatsApp/handoff)
- Centralizar en wrapper de fetch/axios para no duplicar lógica.

### Criterios de aceptación
- 100% requests críticas (market, claims, surveys, portal dashboard) envían `X-Contact-Key`.
- Cuando hay handoff desde WhatsApp, requests relevantes incluyen `X-Conversation-Id`.

### Riesgo que evita
- Pérdida de continuidad entre canales y funnels incompletos.

---

## FE-04 · Checkout E2E resiliente

### Qué implementar
- Orquestador de checkout con estados explícitos:
  - `idle`, `validating`, `creating_order`, `awaiting_payment`, `success`, `error`.
- Pantallas de reintento y recuperación de sesión/carro.

### Criterios de aceptación
- Usuario puede retomar checkout tras refresh/reingreso.
- Errores de API muestran CTA accionable (reintentar, volver al carrito, soporte).
- Se emiten eventos analytics por cada transición de estado.

### Riesgo que evita
- Abandono por estados inconsistentes y pérdida de sesión.

---

## FE-05 · Portal app separada (build aislado)

### Qué implementar
- Separar `portal-app` de `admin-app` a nivel build (sin forzar split de repositorio ahora).
- Mantener widget con entrypoint independiente.
- Definir manifest/scope PWA específico para portal.

### Criterios de aceptación
- Portal se despliega con bundle propio y sin cargar rutas/admin code innecesario.
- TTI y tamaño de bundle del portal mejoran frente al baseline.
- Installability PWA verificada para URL canónica del portal.

### Riesgo que evita
- UX pesada y percepción de “app mezclada”.

---

## FE-06 · Encuestas: contrato único sin fallback ambiguo

### Qué implementar
- Consumir un endpoint canónico de encuestas públicas (v1) y remover fallback en cascada cuando backend v1 esté activo.
- Normalizar shape de datos (tipos TS compartidos con capa API).

### Criterios de aceptación
- El listado público de encuestas funciona con un solo contrato estable.
- Alertar explícitamente cuando el backend devuelve shape inválido (telemetría + mensaje controlado).

### Riesgo que evita
- Comportamientos distintos según path/respuesta legacy.

---

## FE-07 · RBAC/capabilities consistente con backend

### Qué implementar
- Mantener guards por `requiredCapabilities`, pero agregar fallback UX cuando backend rechaza por permisos:
  - pantalla 403 usable,
  - CTA para solicitar acceso,
  - registro de intento denegado (analytics).
- Alinear `requiredCapabilities` por pantalla con `docs/rbac.capability_matrix.v1.md`.

### Criterios de aceptación
- No hay pantallas “rotas” por denegación de permisos.
- Cada denegación queda trazada por capability + pantalla + tenant.

### Riesgo que evita
- Fricción operativa y tickets internos de acceso sin contexto.

---

## 3) Contratos frontend/backend a congelar (interfaz mínima)

## Headers estándar
- `X-Tenant-Slug` (cuando aplique)
- `X-Contact-Key` (obligatorio en flujos de usuario)
- `X-Conversation-Id` (opcional, recomendado en handoffs)

## Convenciones de respuesta de error
```json
{
  "error": {
    "code": 400,
    "message": "detalle"
  }
}
```

## Convenciones de eventos analytics (mínimo)
- `event_name`
- `screen_name`
- `tenant_id`
- `channel`
- `contact_key`
- `metadata` (objeto libre pero acotado)

---

## 4) Plan de entrega sugerido (4 sprints)

### Sprint 1
- FE-01 (routing canónico base)
- FE-03 (headers de identidad)
- FE-07 (fallback de permisos)

### Sprint 2
- FE-02 (strict en `src/api` y `src/context`)
- FE-06 (contrato canónico encuestas)

### Sprint 3
- FE-04 (checkout state machine + reintentos)

### Sprint 4
- FE-05 (portal build aislado + PWA portal)

---

## 5) Definition of Done transversal

- Todo flujo crítico con telemetría (`screen_view`, `api_error`, `checkout_step`, `permission_denied`).
- Sin `any` nuevo en módulos bajo hardening.
- Documentación actualizada (README frontend + changelog técnico).
- Pruebas mínimas:
  - unitarias de hooks/utilidades,
  - integración de rutas,
  - smoke E2E de portal/market.

---

## 6) Checklist de QA antes de merge

- [ ] Deep links de WhatsApp abren pantalla correcta en ruta canónica.
- [ ] Carrito persiste entre refresh y reingreso.
- [ ] Checkout recupera estado tras error temporal de API.
- [ ] Portal instala como PWA con `start_url` y scope correctos.
- [ ] Errores 4xx/5xx muestran mensajes controlados y medibles.
- [ ] Denegaciones RBAC no rompen navegación.

---

## 7) Notas de coordinación con backend

- Backend prioriza migraciones explícitas; no asumir “auto-create tables” en runtime.
- Si aparece `5xx` en ambientes nuevos, validar primero estado de migraciones (`flask db upgrade`) antes de debug UI.
- Cualquier endpoint nuevo debe salir con contrato versionado y ejemplo de payload para tipado inmediato en frontend.

---

## 8) Novedades backend (Etapa 3) para consumir en frontend

- `/analytics/event` ahora devuelve también:
  - `contract_version` (`analytics.event_ingest.v1`)
  - `contact_key`
  - `conversation_id`
  - `identity_source`
- `/analytics/event/schema` expone catálogo canónico de eventos + dimensiones requeridas/recomendadas (`analytics.event_schema.v1`).
- Endpoints analytics empiezan a exigir capabilities explícitas:
  - lectura (`analytics.read`)
  - acciones operativas/ingesta (`analytics.admin`)
- `/auth/widget/bootstrap` ahora expone `contract_version` (`auth.widget_bootstrap.v1`).
- `/auth/widget-token` y `/auth/widget-refresh` ahora devuelven `contract_version` (`auth.widget_token.v1`).
- Nuevo endpoint de tracking público de reclamos: `/tickets/public/status` (`tickets.public_status.v1`).
- Nuevo endpoint de metadata de workflow de tickets: `/tickets/workflow/metadata` (`tickets.workflow.v1`).
- Nuevo endpoint canónico de encuesta pública: `/public/encuestas/v1/<slug>` (`encuestas.public.v1`).
- `POST /public/encuestas/<slug>/respuestas` ahora devuelve `contract_version` (`encuestas.public_response.v1`).
- El backend enriquece telemetry payload con identidad omnicanal cuando está disponible.
- `market/cart` prioriza `conversation_id` para continuidad de sesión.
- `market/cart` mantiene `recompensas_demo` por compatibilidad, pero con `mode: "disabled"` y wallet en cero cuando `ENABLE_DEMO_MODE=false`.
- `public/encuestas/<slug>/respuestas` ahora puede devolver:
  - `contact_key`
  - `conversation_id`
- `tenant-profile` puede incluir `rubro_profile.education_profile` para colegios públicos/privados (módulos sugeridos de asistencia/comunicados/agenda/trámites).
- `tenant-profile` ahora devuelve `contract_version: public.tenant_profile.v1` para tipado/validación de bootstrap.
- `widget-config`/bootstrap de widget prioriza quick menu educativo (`asistencia`, `comunicados`, `agenda`, `trámites`) cuando el rubro del tenant es colegio/escuela.
- `widget-config` devuelve `contract_version: public.widget_config.v1` para validación de bootstrap.
- `/auth/demo/catalog` y `/auth/demo` devuelven 404 contractado (`auth.demo.v1`) cuando `ENABLE_DEMO_MODE=false`.
- El 404 de demo mode off incluye `request_id` en payload y `X-Request-Id` en headers para trazabilidad FE/BE.
- Alias legacy `/api/auth/demo/catalog` y `/api/auth/demo` devuelven el mismo 404 contractado (`auth.demo.v1`) para evitar drift entre clientes con prefijos distintos.
- Endpoints de tickets empiezan a usar identidad global para `anon_id`, reduciendo diferencias entre header legacy y contexto omnicanal.
- `tickets/<tipo>/<id>/timeline` puede incluir `contact_key` y `anon_id` para conservar estado en UI realtime.
- Nuevo endpoint de monitoreo: `/analytics/identity/coverage` (lectura `analytics.read`) para tablero de cobertura omnicanal.
- `/analytics/identity/coverage` acepta `target_pct` y devuelve `slo_status` (`ok` | `below_target`).
- `/analytics/identity/coverage` ahora incluye `alerts` y `alert_count` para disparar banners de calidad de datos.
- `/analytics/identity/coverage` acepta `target_by_channel` (JSON o `canal:valor`) para metas diferenciadas por canal.
- `/analytics/identity/coverage` permite `emit_alert_events=1` para registrar eventos `identity_coverage_alert` cuando haya brechas (esta emisión requiere `analytics.admin`).
- `/admin/analytics/whatsapp-funnel` ahora incluye `unique_contacts` por etapa para correlación de continuidad.
- `/admin/analytics/whatsapp-funnel` ahora incluye `contract_version` para versionar el contrato de visualización.
- Modo demo backend ahora es **opt-in** (`ENABLE_DEMO_MODE=true`): sin esa flag no se inyectan tenants/rubros virtuales.

### Acción frontend inmediata
1. Leer `X-Contact-Key` y `X-Conversation-Id` de responses críticas y persistir en storage seguro por tenant.
2. Reinyectar esos headers en requests subsiguientes para mantener continuidad.
3. En módulo encuestas, guardar `contact_key`/`conversation_id` devueltos para asociar siguientes interacciones del usuario.
4. En bootstrap público (`/tenant-profile`), manejar `404` explícito sin fallback demo (estado vacío + CTA soporte).

## Referencia ejecutable

Ver `BACKLOG_EJECUTABLE_FULLSTACK_OWNERSHIP.md` para la versión operativa por ownership (CT/BE/FE, prioridades y DoD).

## Contratos compartidos (nuevo)

- `docs/analytics.identity_coverage.v1.contract.md`
- `docs/shared.error.v1.contract.md`
- `docs/public.tenant_profile.v1.contract.md`
- `docs/widget.quick_menu.education.v1.contract.md`
- `docs/public.widget_config.v1.contract.md`
- `docs/auth.demo.v1.contract.md`

Frontend debe tipar clientes API tomando estos contratos como fuente de verdad.

Además, FE-07 (permisos) debe tomar como referencia:
- `docs/rbac.capability_matrix.v1.md`

---

## 9) Plan de ejecución inmediato (siguiente sprint)

### 9.1 Entregables obligatorios del sprint

1. Integrar almacenamiento por tenant de `X-Contact-Key` y `X-Conversation-Id`.
2. Actualizar cliente de analytics admin para tipar:
   - `unique_contacts` (por etapa),
   - `contract_version` (payload funnel),
   - `alerts`, `alert_count`, `slo_status` (coverage endpoint).
3. Instrumentar eventos UI:
   - `identity_context_attached`
   - `identity_context_missing`
   - `coverage_alert_banner_seen`

### 9.2 Criterios de aceptación (QA + datos)

- 100% de requests críticas desde frontend incluyen `X-Contact-Key` cuando exista identidad resuelta.
- Pantalla de funnel rechaza payload sin `contract_version` (fallback visual controlado + log).
- Banner de calidad de datos visible cuando `alert_count > 0`.
- Ningún flujo crítico rompe navegación por ausencia de `conversation_id` (degradación elegante).

### 9.3 Definition of Done específica del sprint

- PR frontend con tests de contrato para:
  - parser de funnel WhatsApp,
  - parser de identity coverage.
- Evidencia de QA manual en 3 contextos:
  - tenant municipio,
  - tenant pyme,
  - sesión sin identidad previa (nuevo usuario).

---

## 10) Paquete de entrega para frontend (listo para compartir)

- Documento resumido de implementación inmediata:
  - `docs/frontend.stage4.handoff.packet.md`
- Ejemplos de payload para tipado/QA:
  - `docs/frontend.stage4.payload_examples.md`
- Contratos base a incluir en tipado:
  - `docs/analytics.identity_coverage.v1.contract.md`
  - `docs/shared.error.v1.contract.md`
  - `docs/rbac.capability_matrix.v1.md`
  - `docs/public.tenant_profile.v1.contract.md`
  - `docs/widget.quick_menu.education.v1.contract.md`
  - `docs/public.widget_config.v1.contract.md`
  - `docs/auth.demo.v1.contract.md`

### Checklist de envío FE (owner backend)

1. Compartir packet + roadmap por canal interno.
2. Adjuntar payloads reales de staging para:
   - `/analytics/identity/coverage`
   - `/admin/analytics/whatsapp-funnel`
   - (usar `docs/frontend.stage4.payload_examples.md` como baseline de tipado)
3. Crear tickets FE separados por bloque:
   - identidad headers,
   - coverage UI/banners,
   - funnel contract validation,
   - alineación RBAC.
