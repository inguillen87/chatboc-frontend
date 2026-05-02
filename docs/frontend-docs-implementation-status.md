# Frontend docs implementation status

Fecha: 2026-05-01

Este archivo baja los MD de `/docs` a estado ejecutable para frontend. La regla aplicada es la de `AGENTS.md`: el frontend es white label, muestra contratos y datos del backend, y no personaliza por municipio/pyme dentro de componentes React.

## Implementado en esta ola

- PWA: `docs/frontend-ux-ui/pwa-setup.md` ahora tiene iconos maskable reales (`public/favicon/favicon-maskable-192x192.png`, `public/favicon/favicon-maskable-512x512.png`) conectados en `vite.config.ts`, `manifest.json` y `public/manifest.json`.
- Offline UX: `AppShellStatusBar` queda montado globalmente en `src/App.tsx`; las vistas v2 de tickets, analytics y surveys muestran estados `offline/loading/error/empty`.
- Error envelope: `src/utils/api.ts` ahora prioriza `error.message` cuando el backend responde con `shared.error.v1`.
- Widget enterprise: `widget.js` deja de bloquear la ejecucion por un singleton global y permite multi-instancia controlada por `data-widget-id`/registry`.
- Demo/chat v2: `src/features/chat/ChatPanel.tsx` y `src/features/demo/DemoWorkspace.tsx` dejan de generar quick replies verticales fijas; ahora reciben `quick_replies`, `welcome_message`, `value_cards` y `handoff_labels` desde el contrato de demo/backend.
- Tickets v2: `src/features/tickets/ticketsApi.ts` normaliza respuestas `{items}`, `{tickets}` o arrays legacy, y `TicketsBoardPage` muestra SLA, prioridad, canal, categoria, asignado y estados UX.
- Analytics v2: `src/features/analytics/analyticsApi.ts` normaliza `summary`/campos legacy y `AnalyticsHubPage` expone KPIs con estados UX.
- Surveys v2: `SurveyBuilderPage` guarda drafts online y encola `survey_draft` offline mediante `OfflineDraftQueue`.
- Tenant context: `TenantContextValue` declara `setTenantSlug`, alineado con el uso real de demo/portal.

## Sync backend 2026-05-01

- Auth/widget: `apiClient` y `widget.js` usan primero `/auth/widget/token` y `/auth/widget/refresh`; las rutas legacy `/auth/widget-token` y `/auth/widget-refresh` quedan solo como fallback ante `404/405/501`.
- Educacion: se agrego `src/api/education.ts` con cliente para `guardians/lookup`, `guardians/verify`, `guardians/link-student`, `me/family-context`, `schools/{id}`, `campuses`, `sections` y acciones de `cases/{id}`. Los endpoints singulares legacy quedan como fallback controlado.
- Familia: `useEducationFamilyContext` consulta `/api/v1/education/me/family-context` y mantiene el shell como respaldo visual.
- Marketplace/PWA: tenant public info usa primero `/api/pwa/public/tenant-info` y no tapa `pwa.public_tenant_resolution.v1`; `MarketCartResponse` y normalizadores preservan `mercadopago_ready`, `checkout_options.payment_required`, `checkout_options.requires_contact_or_auth`, `checkout_options.gateway_hint`, `checkout_preview.payment_ready` y `checkout_preview.contact_ready` sin asumir MercadoPago listo por defecto.
- Checkout: las paginas de carrito/checkout respetan `requires_contact_or_auth`; si backend informa contacto listo, el frontend no fuerza login o telefono localmente.
- Encuestas publicas: `postPublicResponse` acepta `request_id` en respuestas exitosas, y `apiFetch` usa `action_hint`/`reason_code` como mensaje accionable cuando el error publico no trae `message`.

## Ola 2 UX/SaaS 2026-05-01

- App shell: se elimino el montaje duplicado de `AppShellStatusBar`; ahora queda solo global en `src/App.tsx`.
- Surveys v2: `SurveyBuilderPage`, `SurveyQuestionEditor` y `SurveyPreview` pasaron a una experiencia de producto con cards, badges, preview mobile-first, tipos de pregunta, remover/agregar preguntas, save panel y cola offline.
- Tickets v2: `TicketsBoardPage` agrega dashboard operativo derivado del payload real: total, SLA vencido, asignados, cantidad de estados, distribucion por estado/canal, retry con `Button` y `staleTime`.
- Analytics v2: `AnalyticsHubPage` agrega hub ejecutivo con metricas, secciones Operaciones/Experiencia, estado parcial cuando backend no entrega todo el `summary` y retry con `Button`.
- Enterprise: `EnterpriseOpsPage` se convirtio en hub de readiness con modulos, estados FE/backend y blockers backend concretos.
- Educacion: admissions, billing, attendance y documents dejaron de ser placeholders y ahora usan `EducationContractPendingCard`, indicando endpoints esperados y blockers sin hardcodear contenido por tenant.

## SaaS P1 backend sync 2026-05-01

- Se agrego `src/api/v2/saas.ts` como cliente canonico para `employee.coverage.v1`, `tenant.health.v1`, `superadmin.executive_summary.v1`, `notifications.hooks.v1`, `notifications.delivery_status.v1` e `inbox.omnichannel.v1`.
- `/enterprise` ahora consulta health, coverage, hooks, delivery, inbox y executive summary cuando el usuario es superadmin; muestra `contract_version` runtime y contadores reales.
- `/empleados` reemplazo coverage legacy por `GET /api/v2/tenants/{slug}/employee-coverage` con fallback a `GET /api/v2/employee-coverage`.
- `/notificaciones` mantiene el wrapper existente por tipo de tenant; `apiClient.adminGetNotificationSettings` y `adminUpdateNotificationSettings` usan `GET|POST /api/v2/notifications/hooks` con fallback legacy, para no reemplazar las pantallas actuales.
- `/superadmin` ahora usa `GET /api/v2/superadmin/executive-summary` con fallback a `/api/v2/super-admin/executive-summary`; el ranking health consume filas normalizadas del contrato.
- El inbox tenant-aware existente (`/t/:tenant/inbox`) ya consume `GET /api/v2/inbox/omnichannel`, sin mocks locales; lista, timeline, presence, summary, suggested reply y actions salen del backend.

## SaaS P2 backend sync 2026-05-01

- Pagos: `src/api/market.ts` intenta `POST /api/v2/payments/checkout-session`, luego `POST /api/v2/payments/preference` y recien despues el checkout legacy `/api/market/{tenant}/checkout/start` ante `404/405/501`.
- Checkout: la pagina existente de checkout llama `POST /api/v2/payments/checkout-preview` antes de crear la orden y respeta `payment_required`, `payment_ready`, `contact_ready`, `checkout_options` y `next_steps` si backend los envia.
- Capacidades/estado de pago: quedaron clientes para `GET /api/v2/payments/checkout-status`, `GET /api/v2/payments/capabilities` y `GET|POST /api/v2/payments/status`, normalizando `request_id`, gateway, missing, checkout URLs y timeline.
- Rewards: el carrito actual consume `GET /api/v2/rewards/profile`, muestra wallet, puntos pendientes del carrito y redenciones disponibles desde backend.
- Canjes: el carrito ejecuta `POST /api/v2/rewards/redeem` con `Idempotency-Key`; al volver exitoso invalida carrito y perfil de puntos.
- Inbox omnicanal: `TicketConversationPane` ahora ejecuta `POST /api/v2/inbox/omnichannel/{ticket_id}/actions` para actions backend y para `reply`, sin crear una pantalla paralela.

## Experience contracts P3 2026-05-01

- Widget/demo: `ChatWidgetInner`, `DemoWorkspace` y `features/chat/ChatPanel` preservan `experience_blueprint`, `first_visit`, `sample_conversations`, `trust_signals`, `empty_states`, `lead_capture`, `media_capabilities`, `conversion_ctas` y `animation_tokens` desde backend.
- Widget config: `tenantService.getPublicWidgetConfig` usa `/api/public/tenants/{slug}/widget-config` y cae a `/api/public/widget-config?tenant={slug}` solo si la ruta primaria no existe.
- Agent Experience: el widget lee contratos tanto top-level como en `builder_config`, `widget`, `widget.builder_config` y `chat_seed.sample_conversations`.
- Composer multimedia: `ChatInput` usa `media_capabilities` como fuente de verdad para mostrar/ocultar imagen, audio, ubicacion y archivo; tambien respeta placeholder, labels, upload endpoint y `upload_response_key`.
- Audio: cuando backend envia `media_capabilities.input_modes.audio`, la nota de voz se manda multipart a `/ask` con el campo `multipart_field` o `audio_file`, conservando `X-Chat-Session-Id` via `apiFetch`.
- Lead capture: `features/chat/ChatPanel` puede abrir/enviar formularios dinamicos con `lead_capture.fields` y `POST /api/public/lead-capture`; el widget legacy postea leads sin campos directamente cuando una CTA apunta a lead capture.
- Conversion CTAs: widget y demo renderizan `conversion_ctas.actions` respetando `rules.max_visible`; labels/intents/endpoints salen del backend.
- Empty states: el widget reemplaza el copy local por `experience_blueprint.first_visit` o `empty_states.*` cuando backend los provee.

## Backend sync esperado

- Demo session puede devolver `workspace.title`, `workspace.welcome_message`, `workspace.quick_replies[]`, `workspace.value_cards[]` y `workspace.handoff_labels`.
- Auth/widget debe exponer `contract_version` en bootstrap/token/refresh; frontend valida `auth.widget_bootstrap.v1` y `auth.widget_token.v1`.
- Educacion ya puede servir los endpoints canonicos de la tanda backend 2026-05-01; frontend conserva compatibilidad legacy solo para rutas documentadas.
- Tickets puede devolver `items[]` o `tickets[]`; frontend normaliza `id/title/status/priority/sla_status/channel/category/assignee`.
- Analytics puede devolver top-level o `summary` con `conversations/open_tickets/overdue_tickets/response_time/survey_responses/nps/csat/handoff_rate`.
- Errores controlados deben usar `error.message`, `action_hint`, `reason_code` y `request_id` cuando sea posible.

## Per-file coverage index

| Doc | Estado frontend |
| --- | --- |
| `00_chatboc_codex_master.md` | Aplicado como criterio: no reescritura, contratos, trazabilidad API. Backend/IA tools quedan fuera de este repo. |
| `00_README_ENVIO_JULES_CODEX.md` | Usado como paquete de coordinacion frontend/backend. |
| `00-chatboc-vision-compartida-educacion.md` | Rutas educacion y shell ya existen; quick menu debe llegar por backend. |
| `01_MASTER_VERTICAL_EDUCACION_SAAS.md` | Frontend fundacional existente; pagos/rewards base integrados por P2, admisiones completas dependen de backend. |
| `02_chatboc_frontend_codex.md` | API v2 y estados UX reforzados; seguir desacoplando clientes por dominio. |
| `02-chatboc-frontend-educacion.md` | Portal/staff/familia existen; mantener separacion de shells. |
| `03_FRONTEND_VERTICAL_EDUCACION_CODEX.md` | Cliente educacion canonico agregado; family context usa `/api/v1/education/me/family-context`. |
| `06_PROMPT_FRONTEND_EDUCACION_AUDITORIA.md` | Auditado dentro de esta lectura; sin cambios readonly pendientes. |
| `07_PROMPT_FRONTEND_EDUCACION_IMPLEMENTACION.md` | Fundacion ya existe; no se amplio billing/admissions completos por restriccion del propio doc. |
| `agenda-paste.md` | Componente existente; sin cambio en esta ola. |
| `analytics.identity_coverage.v1.contract.md` | Parser/cliente existente; se mantiene tolerancia a campos opcionales. |
| `analytics/bi-stacks.md` | Documento de arquitectura BI; sin implementacion frontend directa salvo analytics/maps existentes. |
| `analytics/README.md` | AnalyticsHub ahora maneja estados y normalizacion; mapas existentes siguen con debounce/fallback. |
| `analytics_frontend_backend_audit.md` | Estados de demo/analytics reforzados; bbox debounce ya estaba implementado. |
| `attachment-storage.md` | Widget ya renderiza adjuntos; storage y miniaturas dependen de backend. |
| `auth.demo.v1.contract.md` | Error envelope/request id mejorado; fallback demo existente. |
| `backend-live-chat-prompt.md` | Frontend no inventa escalamiento; espera botones/actions del backend. |
| `backlog-omnicanal-executable.md` | CT/RBAC/API respetados; siguientes olas: inbox omnicanal completo. |
| `bi-no-code-integrations.md` | Playbook/BI es mayormente backend/admin content. |
| `catalog-files.md` | Wizard/catalogo existente; sin cambio en esta ola. |
| `codex_frontend.md` | White-label y tenant-aware respetado; quick replies pasan a contrato. |
| `codex_frontend_repo_plan.md` | FE-09/FE-10/FE-11 parcialmente reforzados con PWA, widget y estados. |
| `CODEX_FRONTEND_V2.md` | API/features v2 ya existian; se endurecieron estados y normalizadores. |
| `codex-multitenant-spec.md` | Tenant headers/contexto ya existen; multi-instancia widget corregida. |
| `commerce-flow.md` | Frontend debe seguir renderizando botones/listas del backend; sin copy nuevo. |
| `commerce-multi-tenant.md` | Rutas canonicas ya existentes; sin cambio. |
| `contracts/analytics-events-v1.md` | Telemetria existente; mantener `trackFrontendEvent`. |
| `contracts/omnicanal-v1.md` | Headers ya en `apiFetch`; error envelope mejorado. |
| `contracts/platform-contract-freeze-v1.md` | No se rompio v1; cambios agregan compatibilidad. |
| `contracts/portal-architecture-decision.md` | Portal separado en build/rutas existente. |
| `contracts/rbac-capabilities-v1.md` | `AccessRoute`/capabilities existentes; sin hardcode nuevo. |
| `feature-proposals.md` | Backlog producto; no todo es implementable sin backend. |
| `frontend.stage4.handoff.md` | Contexto widget/tenant y headers existentes; quick replies desde backend reforzado. |
| `frontend.stage4.handoff.packet.md` | Alineado con contratos stage4; sin ruptura. |
| `frontend.stage4.payload_examples.md` | Normalizadores toleran shapes legacy/v2. |
| `FRONTEND_ENTERPRISE_EXECUTION_PACK.md` | Estados y base enterprise reforzados. |
| `FRONTEND_MASTERPEACE_UNIFICADO.md` | Parcial: UX transversal; resto requiere olas por modulo. |
| `FRONTEND_SINGLE_TASK_WORLD_CLASS_CHAT.md` | Parcial: widget/contexto/PWA/estados; inbox premium completo queda siguiente ola. |
| `FRONTEND_UNIFIED_HANDOFF.md` | Handoff labels pasan a contrato; frontend no inventa botones. |
| `frontend-demo-widget-handoff.md` | Demo workspace ahora lee contrato de backend. |
| `frontend-enterprise-fe01-fe05-status.md` | Se refuerza FE-01/FE-05 por estados; revisar detalle en siguiente ola. |
| `frontend-next-pack.md` | Render gate por `ux_context` ya existe en legacy ChatPanel; contexto headers ya existe; quick replies backend. |
| `frontend-task-board.md` | Usado como backlog; no se completo entero en una sola ola. |
| `frontend-unified-handoff.md` | Igual que `FRONTEND_UNIFIED_HANDOFF.md`. |
| `frontend-ux-ui/landing-page.md` | Sin redisenio landing en esta ola para no romper white-label/demo. |
| `frontend-ux-ui/pwa-setup.md` | Iconos maskable + indicador offline implementados. |
| `frontend-v2.md` | Actualizar con esta ola; features v2 quedan menos fragiles. |
| `ideas-municipios.md` | Ideas/backend content; frontend mantiene configuracion por JSON/backend. |
| `market-flow.md` | Flujo existente; backend define catalogo/checkout y frontend respeta flags `checkout_options`/`checkout_preview`. |
| `marketplace-public.md` | Experiencia existente; sin hardcode por tenant y sin asumir `mercadopago_ready=true`. |
| `municipal-features.md` | Mapas y stats existentes; solo mostrar mapas con datos. |
| `municipios/junin.md` | No se agrego nada especifico de Junin a React. |
| `notifications.md` | Backend hooks pendientes; frontend templates/settings existentes. |
| `opinar-ar.md` | Encuestas existentes; builder ahora tiene offline draft y voto publico preserva `request_id`. |
| `permission-denied.md` | `AccessRoute` existente; estados UX mejorados en features v2. |
| `portal-backend-contract.md` | Portal sigue leyendo backend; sin fallback demo implicito nuevo. |
| `portal-build-size.md` | Build separado existente; no se pudo medir sin dependencias locales. |
| `profile-map.md` | Regla respetada por `TicketMap`/perfil: mapa solo con direccion/coordenadas. |
| `proposal.md` | Resumen producto; sin implementacion directa. |
| `public.tenant_profile.v1.contract.md` | 404 no tiene fallback silencioso en tenant context. |
| `public.widget_config.v1.contract.md` | Quick menu debe venir de backend; widget lo consume. |
| `pyme-features.md` | Catalogo/metricas existentes; backend define botones/textos. |
| `rbac.capability_matrix.v1.md` | Capabilities v1 ya linkeado a rutas. |
| `README-paquete.md` | Coordinacion de paquete; frontend no mezcla backend. |
| `reclamos-flow.md` | Ticket map y adjuntos existentes; alertas dependen de backend. |
| `roles.md` | UI depende de roles/capabilities del backend. |
| `shared.error.v1.contract.md` | Implementado en `resolveApiErrorMessage`. |
| `style-guide/01-design-tokens.md` | `ViewState` ajustado a radio menor y componentes existentes. |
| `style-guide/02-componentes-ui.md` | Se reutiliza `ViewState`; proxima ola puede migrar botones a shadcn en features v2. |
| `surveys/README.md` | Seeds siguen fuera de React; builder offline agregado. |
| `system-overview-es.md` | Pagos/puntos reales base ya consumen P2; queda UX post-pago/rewards premium. |
| `technical-audit-chatboc.md` | Error UX, tenant context, widget multi-instancia y API error envelope reforzados. |
| `tenant-routing.md` | Rutas canonicas existentes preservadas. |
| `widget-embedding.md` | Multi-instancia y permisos existentes; registry corregido. |
| `widget-requirements.md` | Multi-instancia, mobile/safe-area y shadow DOM existentes/corregidos. |
| `widget.quick_menu.education.v1.contract.md` | Frontend consume `quick_menu`; labels deben venir del backend. |

## Pendientes honestos para siguientes olas

- Inbox omnicanal premium completo con mapa, drawer 360, filtros avanzados y estados por presencia en vivo.
- Post-pago premium: pantalla de tracking con `payments.status.v1`, polling controlado y timeline comercial.
- Rewards premium: catalogo de beneficios, historial detallado y reglas visuales completas desde backend.
- Migrar mas pantallas legacy a `ViewState` y componentes UI comunes.
- Ejecutar build/typecheck cuando haya `npm`/`node_modules` disponibles en el entorno.
