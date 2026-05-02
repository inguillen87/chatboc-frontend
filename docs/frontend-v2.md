# Frontend v2 (estado actual)

## Qué quedó listo
- Cliente API v2 ligero en `src/api/v2/client.ts` con wrappers `panelApi`, `publicApi`, `widgetApi`, `demoApi`.
  - No infiere tenant automáticamente cuando no se envía `tenantSlug`.
  - Adjunta `X-Tenant-Slug` solo cuando el llamado lo requiere.
  - Fallback legacy explícito únicamente para errores de endpoint no implementado (`404/405/501`).
- Módulo auth v2 con fallback legacy para Google login en `src/api/v2/auth.ts`.
- Módulo tenants v2 en `src/api/v2/tenants.ts`.
- Estructura por features creada:
  - `src/features/demo/*`
  - `src/features/tickets/*`
  - `src/features/surveys/*`
  - `src/features/analytics/*`
- Nuevas rutas SaaS base:
  - `/tickets/board`
  - `/surveys`
  - `/analytics/hub`

## Fallbacks legacy activos
- Google login: `/api/v2/auth/google` -> fallback `/api/google-login`.
- Tickets v2: `/api/v2/tickets` -> fallback `/tickets`.
- Surveys draft v2: `/api/v2/surveys/draft` -> fallback `/municipal/surveys`.
- Analytics overview v2: `/api/v2/analytics/overview` -> fallback `/analytics/overview`.
- Demo catalog/session: intenta `/api/v2/demo/*` con fallback local/rubros y `/api/v1/demo/session`.
- Demo session normaliza `demo_session_id` y `session_id` para compatibilidad entre contratos backend.
- Educación staff inbox se resuelve en ruta tenant-aware (`/t/:tenant/educacion/staff/inbox`) para evitar slug incorrecto en `useTenant()`.

## Próximo paso recomendado
- Seguir desacoplando `apiFetch` en clientes por dominio (`panel/public/widget/demo`) para reducir lógica centralizada sin romper compatibilidad.
- Ola 2026-05-01: PWA maskable/offline, widget multi-instancia, error envelope `shared.error.v1`, estados UX v2, normalizadores tickets/analytics y demo workspace alimentado por contrato backend.

## QA mínimo automatizado
- Suite Playwright agregada en `tests/e2e/chatboc-smoke.spec.ts`.
- Script: `npm run test:e2e`.
- La suite mockea rutas API para evitar dependencia de producción y validar regresión de:
  - demo gobierno/pyme
  - handoff visible al pedir humano
  - login inválido
  - tickets/surveys base
  - apertura/cierre de widget

## Sync backend 2026-05-01
- Auth/widget: `/auth/widget/token` y `/auth/widget/refresh` son canonicos; `/auth/widget-token` y `/auth/widget-refresh` quedan como fallback `404/405/501`.
- Educacion: `/api/v1/education/me/family-context` y rutas plurales `guardians/*` son canonicas; rutas singulares documentadas quedan como fallback.
- Marketplace/PWA: tenant info usa `/api/pwa/public/tenant-info` como primario; carrito conserva `checkout_options`, `checkout_preview` y `mercadopago_ready` sin defaults optimistas.
- Encuestas publicas: el voto exitoso acepta `request_id` y los errores usan `action_hint`/`reason_code` como mensaje accionable.

## Ola 2 UX/SaaS 2026-05-01
- `AppShellStatusBar` queda montado una sola vez en `src/App.tsx`.
- `/surveys` ahora tiene builder con editor por pregunta, preview, save panel y cola offline.
- `/tickets/board` ahora expone tablero operativo con KPIs derivados del payload real, distribucion por estado/canal y retry profesional.
- `/analytics/hub` ahora muestra hub ejecutivo, estado parcial cuando backend no completa el summary y secciones Operaciones/Experiencia.
- `/enterprise` ahora comunica readiness FE/backend y blockers reales para coordinar la siguiente tanda.
- Educacion admissions/billing/attendance/documents usan shells contract-ready en vez de placeholders.

## SaaS P1 backend sync 2026-05-01
- Cliente canonico nuevo: `src/api/v2/saas.ts`.
- Endpoints integrados: employee coverage, tenant health, superadmin executive summary, notifications hooks, notifications delivery status e inbox omnicanal.
- `/enterprise` muestra estado live de los contratos P1 y versiones detectadas.
- `/empleados`, `/superadmin` y el inbox tenant-aware existente (`/t/:tenant/inbox`) consumen las rutas v2 canonicas.
- `/notificaciones` conserva el wrapper actual por tenant; las llamadas existentes de `apiClient` ahora usan notifications hooks v2 con fallback legacy.
- El inbox omnicanal ya no usa mocks locales: si backend no envia lista/timeline, se muestra estado vacio/parcial.

## SaaS P2 backend sync 2026-05-01
- `src/api/market.ts` suma clientes P2 para payments checkout status/capabilities/preview/session/status y rewards profile/redeem.
- `startMarketCheckout` no duplica flujo: usa `/api/v2/payments/checkout-session`, fallback `/api/v2/payments/preference` y ultimo fallback legacy.
- `/market/:tenant/cart` muestra wallet/redenciones reales desde `rewards.profile.v1` y canjea con `rewards.redeem.v1` usando `Idempotency-Key`.
- `/t/:tenant/checkout` valida `payments.checkout_preview.v1` antes de crear orden.
- `/t/:tenant/inbox` ejecuta actions reales (`assign`, `reply`, `handoff`, `close`, `reopen`, `set_priority`) con `POST /api/v2/inbox/omnichannel/{ticket_id}/actions`.

## Experience contracts P3 2026-05-01
- Widget y demo consumen `experience_blueprint`, `lead_capture`, `media_capabilities`, `conversion_ctas`, `animation_tokens` y `empty_states` sin hardcode por tenant/rubro.
- Widget config soporta ambos endpoints backend: `/api/public/tenants/{slug}/widget-config` y fallback `/api/public/widget-config?tenant={slug}`.
- Los contratos Agent Experience se leen top-level, desde `builder_config`, desde `widget`/`widget.builder_config` y desde `chat_seed.sample_conversations`.
- `media_capabilities` controla el composer: placeholder, botones visibles, endpoint de upload, `upload_response_key` y audio multipart hacia `/ask`.
- `conversion_ctas.rules.max_visible` limita acciones renderizadas; labels, intents y endpoints vienen del backend.
- `lead_capture` usa `POST /api/public/lead-capture` cuando corresponde y preserva el flujo legacy de captura conversacional cuando backend pide datos paso a paso.
- `empty_states` y `first_visit` reemplazan copy local cuando backend los envia; si faltan, queda un fallback neutro.
