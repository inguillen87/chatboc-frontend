# Frontend v2 (estado inicial)

## Qué quedó listo
- Cliente API v2 ligero en `src/api/v2/client.ts` con wrappers `panelApi`, `publicApi`, `widgetApi`, `demoApi`.
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

## Próximo paso recomendado
- Migrar consumo real de `/demo` a `src/features/demo/DemoWorkspace.tsx` como flujo único para `/demo` y `/demo/:slug`.
