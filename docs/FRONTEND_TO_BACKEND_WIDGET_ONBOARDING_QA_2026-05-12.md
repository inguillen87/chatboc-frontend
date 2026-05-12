# Frontend to Backend QA - Widget Onboarding 2026-05-12

Objetivo: validar que el widget de landing inicia demos por pilar/rubro desde contratos backend-first, sin hardcodear municipio/pyme/colegio en React y sin abrir Socket.IO por defecto.

## Frontend aplicado

- `GET /api/public/widget-config` sin tenant se consume como selector plataforma cuando `onboarding.mode === "platform_sector_selector"`.
- El selector inicial muestra solo las opciones que llegan en `quick_menu`/`onboarding.quick_menu`, limitado por `ui_hints.max_visible_quick_replies` con default `3`.
- Al elegir una opcion se llama `POST /api/v2/demo/session` con `sector`, `tenant_slug` y `rubro`.
- Despues de la seleccion, frontend usa `workspace.chat_bootstrap` como fuente de endpoint, headers, query y payload.
- Frontend ya no arrastra el `quick_menu` de plataforma despues de crear demo session; usa `workspace.quick_replies` o `workspace.education.quick_menu`.
- Frontend ya no inyecta `tenant_slug="municipio"` cuando no hay tenant real; solo manda `tenant_slug` si backend/config lo entrego.
- Header del widget no muestra badge `Live` si backend no habilita live/realtime.
- Header y CTA de live chat respetan `realtime.socket_enabled`, `support_channels.live_chat.socket_enabled` y `visibility_rules.allow_websocket`.
- Las respuestas rapidas de mensajes se limitan por `ui_hints.max_visible_quick_replies`; si `collapse_extra_quick_replies=true`, el resto queda detras de `Mas`.
- El header queda compacto cuando backend manda `ui_hints.density=compact`, `composer.icon_buttons_only` o `toolbar.avoid_header_action_overload`.
- Adjuntar archivo/imagen, ubicacion, audio y emoji viven en el composer como icon buttons con `title`/`aria-label`; las capacidades se ocultan si backend o navegador no las habilitan.
- Socket global queda deshabilitado en `/` aunque exista token local; cuando se usa socket en zonas autenticadas, intenta `polling` primero.

## Contratos backend que necesitamos estables

### Widget plataforma

`GET /api/public/widget-config` sin tenant debe responder `200` con:

- `contract_version: public.widget_config.v1`
- `tenant.slug: chatboc-platform`
- `tenant.tipo: platform`
- `onboarding.contract_version: public.widget_onboarding.v1`
- `onboarding.mode: platform_sector_selector`
- `onboarding.selection_endpoint: /api/v2/demo/session`
- `onboarding.catalog_endpoint: /api/v2/demo/catalog`
- `quick_menu[]` con `label`, `sector`, `tenant_slug` y `rubro`
- `ui_hints.contract_version: widget.ui_hints.v1`
- `realtime.socket_enabled: false` cuando Socket.IO no este publicado

### Demo session

`POST /api/v2/demo/session` debe aceptar:

```json
{
  "sector": "educacion|gobierno|empresas",
  "tenant_slug": "colegio-demo|municipio|bodega",
  "rubro": "..."
}
```

Y devolver:

- `demo_session_id`
- `tenant.slug`
- `workspace.chat_bootstrap`
- `workspace.quick_replies` o `workspace.education.quick_menu`
- `workspace.media_capabilities`
- `workspace.conversion_ctas`
- `workspace.animation_tokens`
- `request_id` en errores

## Criterios de aceptacion runtime

- Landing sin tenant no debe iniciar chat generico antes de elegir pilar.
- Elegir Colegios/Gobiernos/Empresas debe crear demo session y abrir chat con `chat_bootstrap`.
- Los mensajes demo deben conservar `X-Demo-Session-Id`, `X-Chat-Session-Id` y `X-Tenant-Slug` desde `chat_bootstrap.headers`.
- No debe aparecer `/socket.io` en consola desde la landing cuando `realtime.socket_enabled !== true`.
- Si falla `widget-config`, frontend usa fallback local de selector plataforma, pero backend debe devolver contrato real en produccion.

## Pendientes backend solo si falla QA prod

- Confirmar deploy de `/api/public/widget-config` sin tenant en `chatboc.ar`.
- Confirmar que `POST /api/v2/demo/session` nunca responde 400 cuando recibe aliases `sector`, `tenant_slug`, `rubro`.
- Confirmar que `workspace.chat_bootstrap.endpoint` sea la ruta canonica que backend quiere que use frontend.
- Confirmar que `realtime.socket_enabled=false` llegue en widget config mientras Socket.IO no este listo.

## Verificacion frontend

- `vitest run src/utils/realtimeVoice.test.ts --pool=threads`: passed.
- `vitest run src/features/chat/chatApi.test.ts src/api/market.test.ts --pool=threads`: passed.
- `vite build`: passed.
- `tsc -p tsconfig.app.json --noEmit` sigue fallando por deuda previa no relacionada (BadgeProps, analytics exports, ErrorBoundary/SectionErrorBoundary, tipos de tests y `ChatbocLogoAnimated` en mensajes legacy). No bloquea el build de produccion.
