# Frontend Masterpeace Unificado — Chatboc Enterprise

Este documento centraliza el estado FE/BE para la iteración enterprise.

## Backend listo
- Demo login: `POST /auth/demo` con `demo_mode`.
- Analytics: `GET /admin/analytics/overview`, `GET /admin/analytics/heatmap`, export CSV/PDF, `POST /analytics/event`.
- IA admin: resumen ejecutivo, resumen por ticket, recomendaciones, OCR draft.
- Bot settings tenant-aware: `GET/PUT /admin/bot/settings`.
- Seguridad multi-tenant/RBAC y guardrails de checkout/puntos.

## Prioridades frontend
1. Demo entry completo + banner modo demo.
2. Dashboard analytics productivo + tracking base.
3. IA visible en negocio (resúmenes, recomendaciones, OCR draft editable).
4. Bot settings usable para tenant.
5. Manejo homogéneo de errores (`400/403/404/500`) + estados loading/empty/retry.

## Contratos clave
- Incluir `tenant_id` explícito en endpoints admin enterprise.
- Preservar contexto `{ tenantId, tenantSlug, demoMode }` en frontend.
- `fallback_behavior` válido: `derivar_humano | auto_reply | silent`.
- OCR: extensiones `.pdf/.png/.jpg/.jpeg/.webp` y máximo `5MB`.

## Definición de listo enterprise
- Demo sin fricción.
- Analytics con KPIs + heatmap + exportables.
- IA operable en panel.
- Bot settings funcional por tenant.
- Sin fugas de contexto tenant.
- Errores y estados vacíos robustos.
