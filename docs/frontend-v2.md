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

## Próximo paso recomendado
- Seguir desacoplando `apiFetch` en clientes por dominio (`panel/public/widget/demo`) para reducir lógica centralizada sin romper compatibilidad.

## QA mínimo automatizado
- Suite Playwright agregada en `tests/e2e/chatboc-smoke.spec.ts`.
- Script: `npm run test:e2e`.
- La suite mockea rutas API para evitar dependencia de producción y validar regresión de:
  - demo gobierno/pyme
  - login inválido
  - tickets/surveys base
  - apertura/cierre de widget
