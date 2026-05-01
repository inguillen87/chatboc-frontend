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
