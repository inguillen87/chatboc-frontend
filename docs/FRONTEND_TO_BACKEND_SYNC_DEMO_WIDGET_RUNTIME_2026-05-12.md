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
