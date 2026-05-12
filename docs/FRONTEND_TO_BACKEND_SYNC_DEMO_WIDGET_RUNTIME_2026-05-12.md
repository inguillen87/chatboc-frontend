# Frontend to Backend Sync - Demo, Landing y Widget Runtime 2026-05-12

Fecha: 2026-05-12

Objetivo: dejar documentado lo que frontend ya corrigio para landing/demo/widget y lo que backend deberia mantener por compatibilidad con builds cacheados o deploys viejos.

## Estado frontend

Frontend ya aplica estas mitigaciones:

- La seccion de demos de la landing inicia demos publicas con sesion local-first.
- El flujo publico de `/demo` ya no depende de `/api/v2/demo/session` para los tres pilares plataforma: `educacion`, `gobierno`, `empresas`.
- El widget plataforma evita tratar `demo-catalogs` como tenant real.
- El widget evita pedir catalogo publico para tenants fantasma como `demo-catalogs`.
- El demo de colegios muestra catalogo correcto y descarga PDF desde el navegador.
- El copy visible de landing/demo se limpio para no mostrar palabras tecnicas como `backend`, `contrato`, `fallback`, `404` o `deploy`.
- El chat demo puede responder en modo local cuando no hay `chat_bootstrap` remoto usable.
- El widget filtra y descarta el selector legacy de dos rubros (`Soluciones Para Empresas` / `Soluciones Para Sector Publico`) si llega desde un bundle o payload viejo.
- El widget ya no consulta horarios de live chat si `support_channels.live_chat` / `realtime.socket_enabled` no lo habilitan.
- Hotfix frontend 2026-05-12: el filtro legacy ahora inspecciona texto, botones, `quick_replies`, secciones interactivas y payloads anidados (`data`, `payload`, `metadata`) antes de renderizar.
- Hotfix frontend 2026-05-12: cuando el contrato habilita schedule, frontend usa solo same-origin:
  - `GET /api/{tenant_slug}/live-chat/schedule?tenant_slug={tenant_slug}&tenant={tenant_slug}`
  - ya no intenta `/demo/live-chat/schedule`, `/live-chat/schedule` ni fallback directo a Render para esta consulta.
- Hotfix frontend 2026-05-12: el widget embebido pide `GET /api/public/widget-commerce-session` con `tenant_slug`, `widget_token`, `X-Chat-Session-Id`, `X-Demo-Session-Id` y `X-Anon-Id` cuando tiene contexto de tenant.
- Hotfix frontend 2026-05-12: si backend responde `public.widget_commerce_session.v1`, el widget muestra catalogo/carrito/portal como acciones compactas junto al composer y mantiene el header simple.
- Hotfix frontend 2026-05-12: `ui_hints.accessibility` se respeta para opciones inclusivas sin llenar el header.
- Hotfix frontend 2026-05-12: slugs publicos de marketing (`demo`, `casos`, `pymes`, `empresas`, `municipios`, `gobiernos`, `colegios`, `sectores`, `precios`, `opinar`) se mantienen como rutas publicas o redirects a `/demo`; no se tratan como `tenant_slug`.
- Hotfix frontend 2026-05-12: el catalogo publico acepta `public.catalog_resolution.v1` y `public.reserved_slug.v1` como estados vacios limpios, sin error tecnico ni reintentos directos a Render.
- Hotfix frontend 2026-05-12: el perfil publico de tenant consume `tenant.public_navigation.v1` para ocultar o deshabilitar botoneras no disponibles.
- Hotfix frontend 2026-05-12: `/demo` consume `demo.admin_preview.v1` para mostrar modulos, cards y timeline del panel demo cuando el contrato esta disponible.

## Errores vistos en produccion

En `https://www.chatboc.ar` se vieron llamadas de bundles/cache viejos a:

- `POST /api/v2/demo/session`
- `POST /v2/demo/session`
- `POST /api/v1/demo/session`
- `POST /v1/demo/session`

Consola:

- 404 en `/api/v2/demo/session` y `/api/v1/demo/session`.
- 405 en `/v2/demo/session` y `/v1/demo/session`.
- Preflight CORS no OK contra `https://chatbot-backend-2e14.onrender.com`.
- Payload legacy de chat con texto:
  - `Bienvenido al showroom interactivo de Chatboc.`
  - `Elegi el rubro que queres explorar y descubri catalogos, pedidos y herramientas inteligentes en segundos.`
  - Botones `Soluciones Para Empresas` y `Soluciones Para Sector Publico`.
- Consultas a horarios live-chat sin contrato habilitado:
  - `GET /api/colegio-demo/live-chat/schedule`
  - `GET /colegio-demo/live-chat/schedule`
  - `GET /api/demo/live-chat/schedule`
  - `GET /demo/live-chat/schedule`

Con el nuevo frontend estas llamadas ya no son necesarias para la landing publica, pero pueden seguir apareciendo si el usuario tiene service worker, cache o chunks viejos.

## Pedido backend/deploy

Prioridad alta para compatibilidad:

1. Confirmar que `POST /api/v2/demo/session` esta deployado en produccion y responde JSON.
2. Mantener aliases degradables para builds viejos:
   - `POST /v2/demo/session`
   - `POST /api/v1/demo/session`
   - `POST /v1/demo/session`
3. Para esos aliases, responder `200` o error JSON accionable, no HTML ni 405 sin CORS.
4. Responder `OPTIONS` con HTTP OK para esos paths cuando origin sea `https://www.chatboc.ar`.
5. Exponer `X-Request-Id` en errores publicos.

Prioridad alta para widget/onboarding:

1. No emitir mas el selector legacy de showroom con dos rubros. El selector plataforma vigente debe ser solo:
   - `Colegios`
   - `Gobiernos`
   - `Empresas`
2. Si algun endpoint de chat/demo devuelve `source: demo_selector`, evitar labels legacy como `Soluciones Para Empresas` o `Soluciones Para Sector Publico`.
3. Para tenants demo o landing global con live chat deshabilitado, publicar siempre:
   ```json
   {
     "support_channels": {
       "live_chat": {
         "enabled": false,
         "available": false,
         "socket_enabled": false
       }
     },
     "realtime": {
       "socket_enabled": false
     }
   }
   ```
4. Si un build viejo pide `/api/{tenant_slug}/live-chat/schedule` o `/api/demo/live-chat/schedule`, responder JSON degradable con `enabled:false`, `available:false` y CORS OK, no 404/HTML.

## Pedido contenido publico

Si backend entrega `GET /api/public/landing-experience`, cuidar que el copy visible sea comercial y entendible para clientes:

- No usar `backend`, `contrato`, `backend-first`, `endpoint`, `fallback`, `404`, `deploy`.
- Preferir frases como:
  - `experiencia guiada`
  - `acciones listas`
  - `seguimiento`
  - `atencion automatizada`
  - `derivacion humana`
  - `catalogos y consultas`

## Cache / service worker

Si despues del deploy frontend siguen apareciendo llamadas a `/api/v1/demo/session` o `/v1/demo/session`, probablemente hay cache o service worker sirviendo un bundle anterior.

Frontend aplicado 2026-05-12:

- `setupPWA` registra el service worker inmediatamente.
- En rutas publicas (`/`, `/demo`, `/pymes`, `/municipios`, `/colegios`, `/sectores`, `/precios`, `/casos`, `/opinar`, `/login`, `/register`, `/widget`) aplica la nueva version automaticamente para reducir bundles viejos.
- En rutas de panel/admin/tenant mantiene aviso de actualizacion para no cortar una edicion activa.

Recomendado:

- Invalidar cache/CDN del frontend.
- Verificar que el service worker precachee los chunks nuevos.
- Confirmar que `index.html` referencia el nuevo hash de `main` y `ChatWidget`.

## Verificacion frontend local

Smoke ejecutado:

- Home con seccion demos fallback: click `Iniciar demo colegio`.
- Resultado: navega a `/demo?session=...`.
- Requests relevantes a demo/session, ask, socket.io, Render: `0`.
- Broken requests relevantes: `0`.
- Build Vite: OK.

Smoke adicional widget 2026-05-12:

- Home abre widget sin cache/extensiones con Playwright local.
- No aparece `showroom interactivo`.
- No aparecen `Soluciones Para Empresas` ni `Soluciones Para Sector Publico`.
- No aparece `Ver Opciones` del selector legacy.
- Requests a `/live-chat/schedule`: `0`.
- Errores relevantes de consola para demo/session, schedule o socket: `0`.

Verificacion build adicional 2026-05-12:

- `npm run build`: OK.

## Public demo route QA 2026-05-12

Frontend aplicado:

- `/t/pymes`, `/t/empresas`, `/t/municipios`, `/t/gobiernos`, `/t/colegios`, `/t/casos` y slugs equivalentes redirigen a experiencias publicas, no a tenant real.
- `GET /api/public/tenants/{slug}/catalog` puede devolver `public.catalog_resolution.v1`; frontend muestra un estado vacio con acceso a demo y no muestra stack/error tecnico.
- `GET /api/public/tenants/{tenant_slug}/public-navigation` alimenta la navegacion publica. Si un item viene `enabled:false` o `visible:false`, se deshabilita u oculta.
- `GET /api/v2/demo/admin-preview` alimenta la demo integrada de colegio/municipio/empresa. El contenido local queda solo como respaldo visual.

Pedido backend/deploy:

- Mantener `public.catalog_resolution.v1`, `public.reserved_slug.v1`, `tenant.public_navigation.v1` y `demo.admin_preview.v1` con JSON + CORS + `request_id`.
- Evitar texto tecnico visible en esos contratos porque se renderizan en experiencias publicas.

## Backend status recibido 2026-05-12

Frontend ya queda alineado para consumir cuando se despliegue:

- `GET /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-setup`
- `GET /api/v2/whatsapp/sandbox-setup`
- `POST /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-test`
- `POST /api/v2/whatsapp/sandbox-test`
- `PUT /api/admin/tenants/{tenant_slug}/catalog/draft`
- `GET /api/admin/tenants/{tenant_slug}/catalog` con `links.draft_endpoint`
- `GET /api/public/widget-commerce-session`
- `GET /api/public/widget-user/tenant-history`
- `POST /api/public/widget-user/register`
- `POST /api/public/widget-user/link-session`

Reglas frontend aplicadas:

- El widget embebido usa `widget-commerce-session` como bootstrap premium cuando hay `widget_token` o `tenant_slug`.
- Se envia `widget_session_token`, `anon_id` y `chat_session_id` a historial/carrito cuando existen.
- Para carrito se prioriza `cart.summary_endpoint` y `cart.items_endpoint` antes de legacy.
- Integraciones WhatsApp muestra instrucciones/frase/menu desde `sandbox-setup` y deeplink/copy/preview desde `sandbox-test`.
- Si algo aun no esta en produccion, la UI degrada sin mostrar errores tecnicos al usuario.

Compatibilidad backend para builds intermedios:

- `POST /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-session`
- `POST /api/v2/whatsapp/sandbox-session`

## Confirmacion backend widget embebido premium 2026-05-12

Backend confirma soporte local para el bloque de widget embebido premium. No hace falta pedir mas backend para esta tanda; queda pendiente el deploy manual en Render.

`GET /api/public/widget-commerce-session`:

- `contract_version: public.widget_commerce_session.v1`
- `frontend_contract.render_as: embedded_tenant_operating_widget`
- `primary_actions: chat, catalog, cart, portal`
- `session.can_checkout_as_guest: true`
- `session.can_link_account: true`
- `session.widget_session_token` disponible
- `cart.allow_guest_cart: true`
- `cart.summary_endpoint: /api/pwa/public/cart/summary`
- `cart.items_endpoint: /api/pwa/public/cart/items`
- `cart.legacy_endpoint: /api/pwa/public/cart`
- `portal.history_endpoint: /api/public/widget-user/tenant-history`
- `history.endpoint: /api/public/widget-user/tenant-history`
- `accessibility` disponible para merge con `ui_hints.accessibility`

`GET /api/public/widget-user/tenant-history`:

- `contract_version: public.widget_user_tenant_history.v1`
- Resuelve por `tenant_slug`/`widget_token` + `X-Chat-Session-Id`/`X-Demo-Session-Id`/`X-Anon-Id`.
- Devuelve `profile`, `items[]`, `cart.items_count`, `cart.summary_endpoint` y `cart.items_endpoint`.

Endpoints de identidad degradable:

- `POST /api/public/widget-user/register`
- `POST /api/public/widget-user/link-session`

Verificacion local backend confirmada:

- `test_widget_commerce_session_returns_embedded_operating_contract`: OK
- `test_widget_user_tenant_history_returns_cart_claims_and_orders`: OK
- `test_pwa_public_cart_summary_and_items_aliases`: OK
- `local_platform_smoke.py`: 11/11 OK

## Confirmacion backend WhatsApp sandbox setup/test 2026-05-12

Backend confirma este delta en main:

- Ademas de `sandbox-session`, queda listo el flujo guiado:
- `GET /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-setup`
- `GET /api/v2/whatsapp/sandbox-setup`
- `POST /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-test`
- `POST /api/v2/whatsapp/sandbox-test`

Contratos:

- `whatsapp.sandbox_session.v1`
- `whatsapp.sandbox_setup.v1`
- `whatsapp.sandbox_test.v1`

`sandbox-setup` devuelve `whatsapp.sandbox_setup.v1` con `sandbox.instructions`, `demo_context.quick_menu`, `test.endpoint` y `frontend_contract.render_as=whatsapp_sandbox_onboarding`.

`sandbox-test` devuelve `whatsapp.sandbox_test.v1`; no envia mensajes reales y entrega `twilio.wa_deeplink`, `message_preview.copy_text` y `message_preview.message`.

Verificacion local backend confirmada:

- `test_whatsapp_sandbox_setup_and_test_contracts_are_backend_first`: OK
- `tests/test_v2_saas_contracts.py`: 16 passed
- `local_platform_smoke.py`: 11/11 OK

Pendiente solo deploy manual en Render.
