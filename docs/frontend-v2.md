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
  - `/analytics/operations`

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
- Las acciones de inbox usan `/api/v2/inbox/omnichannel/{ticket_id}/actions` y caen a `/api/v2/inbox/omnichannel/actions` solo si el endpoint por id no esta disponible; el `ticket_id` viaja tambien en body.

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
- El selector demo ahora lee `sectors` y `sector_groups` de `demo.catalog.v2`; si llega `educacion`, permite iniciar demo educativa con `POST /api/v2/demo/session` y usa `chat_bootstrap` sin reconstruir endpoint/payload.
- Widget config educativo consume `quick_menu` top-level y fallback `education.quick_menu`/`builder_config.education.quick_menu`; labels e intents escolares quedan backend-driven.
- `media_capabilities` controla el composer: placeholder, botones visibles, endpoint de upload, `upload_response_key` y audio multipart hacia `/ask`.
- El composer standalone muestra vista previa de imagen/archivo, permite cancelar/reintentar y mantiene el flujo backend `upload_endpoint` -> `upload_response_key` -> payload de chat.
- `conversion_ctas.rules.max_visible` limita acciones renderizadas; labels, intents y endpoints vienen del backend.
- `lead_capture` usa `POST /api/public/lead-capture` cuando corresponde, envia `tenant_slug`, `chat_session_id`, `anon_id`, `trigger/intent` e `Idempotency-Key`, y acepta `deduplicated=true` como exito.
- La respuesta `public.lead_capture.v1` se renderiza con `message_body`, `next_actions` y trazabilidad compacta (`lead_id`, `ticket_id`, `status`, `request_id`) provistos por backend.
- `empty_states` y `first_visit` reemplazan copy local cuando backend los envia; si faltan, queda un fallback neutro.
- `trust_signals` se renderiza como fila compacta de confianza con `label/detail`.
- `experience_blueprint.agent_copilot.suggestions` ya alimenta botones sugeridos en el inbox agente.

## Operational analytics P4 2026-05-01
- `src/features/analytics/analyticsApi.ts` consume `GET /api/v2/analytics/operations/dashboard`, `GET /api/v2/analytics/operations/heatmap` y `GET /api/v2/analytics/operations/action-center`.
- Tambien consume `GET /api/v2/analytics/operations/freshness` para distinguir datos frescos, stale o vacios.
- `OperationsDashboardPanel` reutiliza el analytics actual para renderizar `summary`, `trends.items`, `tickets.*`, `surveys.*`, `chats.*`, `live_chat`, `employees`, `maps.heatmap.hotspots`, `alerts` y `next_best_actions`.
- `FreshnessBanner` muestra fuentes `stale/empty/degraded` y sus `recommended_action` cuando backend las envia.

## Education + WhatsApp UX 2026-05-02
- `src/api/education.ts` suma clientes para `GET /api/v1/education/admin/menu`, `GET /api/v1/education/whatsapp/playbook` y `GET /api/v1/education/tenant/capabilities`.
- `src/api/education.ts` tambien consume `GET /api/v1/education/operations/summary` (`education.operations_summary.v1`) para KPIs escolares, breakdown y acciones recomendadas.
- `src/api/education.ts` consume `GET /api/v1/education/operations/heatmap` (`education.operations_heatmap.v1`) y `GET /api/v1/education/cases?...&envelope=1` para previews filtrados.
- Los hooks educativos adjuntan `X-Tenant-Slug` cuando `TenantContext` ya resolvio el slug de la ruta tenant-aware.
- `EducationStaffInboxPage` renderiza `panel_sections`, `profile_fields`, `quick_menu` y preview de `whatsapp_playbook` desde backend, sin crear panel educativo paralelo.
- `EducationStaffInboxPage` muestra `summary`, `breakdown` y `next_best_actions` del resumen operativo escolar sin ejecutar endpoints automaticamente.
- `EducationStaffInboxPage` muestra mapa compacto con `MapLibreMap` solo cuando el contrato trae puntos escolares con coordenadas; si `render_contract.state` es `empty`, muestra estado vacio accionable.
- El heatmap escolar tambien muestra previews compactas de `cells` y `hotspots` cuando backend los envia.
- Las acciones recomendadas del resumen escolar abren el listado de casos con `envelope=1` y conservan filtros del endpoint backend.
- La preview WhatsApp escolar muestra `welcome`, `starter_messages`, menu, `accepted_media`, `sensitivity_level`, `requires_verification` y `requires_handoff` desde el contrato.
- Tickets v2 e inbox omnicanal preservan `ticket.school_case` (`education.case_alias.v1`) para que el staff vea el vinculo escolar cuando backend lo resuelve.
- `DemoWorkspace` reutiliza `workspace.education.quick_menu` como acciones del chat cuando backend lo entrega.
- El heatmap operacional usa `MapLibreMap` y respeta `render_contract.layers`; cuando el contrato viene `empty` o freshness indica `can_render_heatmap=false`, muestra estado vacio en vez de mapa roto.
- El action center muestra acciones priorizadas del backend con `endpoint`, `method`, `payload_template` y `ui_hint`, sin ejecutar cambios automaticos.
- `/analytics`, `/analytics/hub` y `/analytics/operations` comparten el mismo panel, para mejorar lo existente sin crear una app paralela.

## API v2 Foundation 2026-05-01
- `src/api/v2/foundation.ts` agrega `GET /api/v2/health` como healthcheck publico v2.
- `src/api/v2/auth.ts` mantiene Google login y suma clientes canonicos para `POST /api/v2/auth/login`, `POST /api/v2/auth/refresh`, `POST /api/v2/auth/logout` y `GET /api/v2/auth/me`.
- `src/api/v2/tenants.ts` suma `GET /api/v2/tenants/current` sin fallback implicito, respetando resolucion estricta por header/token/demo/widget.
- `/enterprise` muestra `GET /api/v2/health` y `GET /api/v2/tenants/current` junto al resto de contratos SaaS para detectar foundation/tenant resolver en runtime.
- `src/api/v2/sla.ts` agrega clientes para `GET|POST /api/v2/sla/policies` y `GET /api/v2/sla/breaches`, con normalizadores tolerantes para `items`, `policies` y `breaches`.
- Demo session preserva `tenant.slug`, `tenant_slug`, `chat_bootstrap`, `request_id` y `contract_version`; lee `chat_bootstrap` top-level, en `workspace` y en `chat_seed`.
- `Demo.tsx` ya no usa `demo_session_id` como tenant slug y, cuando existe `chat_bootstrap`, usa `method`, `endpoint`, `fallback_endpoint`, `headers`, `query` y `payload` para saludo inicial y mensajes.
- Los llamados de demo con `chat_bootstrap` no agregan tenant/query/chat-session locales desde `apiFetch`: se respeta `X-Chat-Session-Id`, `X-Demo-Session-Id` y `X-Tenant-Slug` enviados por backend.
- `chat_bootstrap.supports` se combina con `media_capabilities` para habilitar/ocultar texto, imagen, audio, ubicacion y archivo en el composer de demo.
- `features/chat/ChatPanel` tambien puede enviar mensajes standalone usando `chat_bootstrap` cuando backend lo provee.
- Tickets v2 ya no queda solo en lista: `ticketsApi.ts` suma create, patch, comments y events canonicos sobre `/api/v2/tickets`.
- Surveys v2 suma clientes admin/publicos canonicos: listar, crear, obtener, actualizar, publicar, cerrar, analytics, leer encuesta publica y responder por `public_token`.
