# Frontend to Backend Sync - Embedded Widget Commerce + User Portal 2026-05-12

Fecha: 2026-05-12

Objetivo: que el script embebido de cada tenant no sea solo un chat, sino una experiencia SaaS completa y white-label: chat, WhatsApp, catalogo, carrito, checkout, identidad de usuario, historial omnicanal y portal de autoservicio por municipio/colegio/empresa.

## QA frontend aplicado

- El widget ya no auto-inicializa el chat cuando todavia esta en selector de plataforma.
- Si ya existe `chat_bootstrap`, `tenant_slug`, `entityToken` o rubro efectivo, frontend no debe volver al selector de rubro.
- Frontend filtra el selector legacy con texto `Bienvenido al showroom interactivo de Chatboc` y botones `Soluciones Para Empresas` / `Soluciones Para Sector Publico`.
- QA 2026-05-12: el filtro ahora tambien inspecciona payloads anidados, secciones interactivas, `quick_replies`, `buttons`, `options` y `items` para evitar que el selector legacy reaparezca aunque venga dentro de `metadata`, `payload` o `data`.
- Si solo llegan mensajes legacy filtrados, el widget muestra el estado limpio del tenant/demo en vez de una conversacion vieja.
- `useBusinessHours` dejo de probar rutas legacy y dominios directos de backend para schedule. Ahora consulta solo same-origin:
  - `GET /api/{tenant_slug}/live-chat/schedule?tenant_slug={tenant_slug}&tenant={tenant_slug}`
- El carrito vuelve a aparecer en el header compacto cuando `cartCount > 0`.
- El modulo de accesibilidad queda disponible en el widget compacto: dislexia, texto simple, alto contraste, controles grandes y regla de lectura.
- QA 2026-05-12: frontend ya consulta `GET /api/public/widget-commerce-session` apenas tiene `tenant_slug` o `widget_token`.
- QA 2026-05-12: si `frontend_contract.render_as=embedded_tenant_operating_widget`, el widget mantiene chat como experiencia principal y muestra acciones compactas para catalogo, carrito y portal junto al composer, no en el header.
- QA 2026-05-12: frontend ya consulta `portal.history_endpoint` / `history.endpoint` para sincronizar `cart.items_count` y mostrar el carrito aunque el usuario siga anonimo.
- QA 2026-05-12: el carrito embebido no fuerza login si `cart.allow_guest_cart` o `session.can_checkout_as_guest` vienen habilitados.
- QA 2026-05-12: `ui_hints.accessibility` y `widget-commerce-session.accessibility` se mergean para controlar opt-ins de dislexia, texto simple, alto contraste, controles grandes, subtitulos y menos movimiento.

## Pedido backend para eliminar el origen del problema

### 1. No emitir selector legacy despues de elegir rubro/pilar

Cuando frontend envia cualquiera de estos marcadores:

- `X-Demo-Session-Id`
- `X-Chat-Session-Id`
- `X-Tenant-Slug`
- `tenant_slug`
- `demo_session_id`
- `chat_bootstrap.payload.rubro`
- `chat_bootstrap.payload.rubro_clave`

Backend no debe responder con:

- `fuente: "demo_selector"` legacy.
- `Bienvenido al showroom interactivo de Chatboc`.
- `Soluciones Para Empresas`.
- `Soluciones Para Sector Publico`.

Respuesta esperada: bienvenida/quick replies del tenant o del demo session ya elegido.

### 2. Schedule/live chat degradable

Los builds cacheados siguen probando rutas como:

- `GET /api/{tenant_slug}/live-chat/schedule`
- `GET /{tenant_slug}/live-chat/schedule`
- `GET /api/demo/live-chat/schedule`
- `GET /demo/live-chat/schedule`

Pedido backend: responder siempre JSON con CORS OK, aunque este deshabilitado:

```json
{
  "contract_version": "live_chat.schedule.v1",
  "enabled": false,
  "available": false,
  "socket_enabled": false,
  "socket_transport_hint": "disabled",
  "fallback_mode": "http_chat",
  "request_id": "req_..."
}
```

Frontend actual ya no consulta schedule salvo que backend lo habilite con `schedule_enabled`, `socket_enabled` o `schedule_endpoint`, pero esto evita consola roja en builds viejos.

## Bundle publico recomendado para script embebido

Endpoint sugerido:

`GET /api/public/widget-commerce-session`

Estado frontend 2026-05-12: consumido.

Query/headers:

- `widget_token`
- `tenant_slug`
- `X-Widget-Token`
- `X-Tenant-Slug`
- `X-Chat-Session-Id`
- `X-Demo-Session-Id`

Shape:

```json
{
  "contract_version": "public.widget_commerce_session.v1",
  "tenant": {
    "slug": "bodega-demo",
    "tipo": "pyme",
    "vertical": "empresas",
    "display_name": "Bodega Demo"
  },
  "session": {
    "chat_session_id": "chat_...",
    "anon_id": "anon_...",
    "widget_session_token": "wst_...",
    "is_authenticated": false,
    "can_checkout_as_guest": true,
    "can_link_account": true
  },
  "catalog": {
    "enabled": true,
    "endpoint": "/api/public/tenants/bodega-demo/catalog",
    "quality_endpoint": "/api/v2/tenants/bodega-demo/catalog/quality"
  },
  "cart": {
    "enabled": true,
    "summary_endpoint": "/api/pwa/public/cart/summary",
    "items_endpoint": "/api/pwa/public/cart/items",
    "legacy_endpoint": "/api/pwa/public/cart",
    "checkout_preview_endpoint": "/api/v2/tenants/bodega-demo/payments/checkout-preview",
    "checkout_session_endpoint": "/api/v2/tenants/bodega-demo/payments/checkout-session",
    "allow_guest_cart": true,
    "requires_contact_before_checkout": true
  },
  "portal": {
    "enabled": true,
    "login_endpoint": "/auth/widget/bootstrap",
    "register_endpoint": "/api/public/widget-user/register",
    "link_session_endpoint": "/api/public/widget-user/link-session",
    "history_endpoint": "/api/public/widget-user/tenant-history"
  },
  "history": {
    "channels": ["widget", "whatsapp", "voice", "orders", "claims", "surveys"],
    "endpoint": "/api/public/widget-user/tenant-history"
  },
  "frontend_contract": {
    "render_as": "embedded_tenant_operating_widget",
    "primary_actions": ["chat", "catalog", "cart", "portal"],
    "empty_state_behavior": "chat_first_catalog_when_enabled"
  }
}
```

## Portal de usuario por tenant

Endpoint sugerido:

`GET /api/public/widget-user/tenant-history`

Estado frontend 2026-05-12: consumido cuando llega desde `portal.history_endpoint` o `history.endpoint`.

Debe resolver por usuario autenticado, `anon_id` o `chat_session_id`, y devolver historial filtrado por tenant.

```json
{
  "contract_version": "public.widget_user_tenant_history.v1",
  "tenant_slug": "colegio-demo",
  "profile": {
    "is_authenticated": false,
    "contact": null,
    "can_register": true,
    "can_link_whatsapp": true
  },
  "items": [
    {
      "id": "ticket_123",
      "kind": "claim|order|school_case|survey|message",
      "channel": "widget|whatsapp|voice",
      "title": "Certificado de alumno regular",
      "status": "recibido",
      "created_at": "2026-05-12T12:00:00Z",
      "detail_endpoint": "/api/public/tracking/experience?kind=claim&code=M-123&pin=..."
    }
  ],
  "cart": {
    "items_count": 2,
    "summary_endpoint": "/api/pwa/public/cart/summary"
  },
  "request_id": "req_..."
}
```

## Reglas de integracion

- El carrito debe poder operar como anonimo y luego vincularse a una cuenta sin perder items.
- Si el usuario se registra o inicia sesion, backend debe asociar `anon_id`, `chat_session_id`, WhatsApp/contacto y tenant.
- El widget embebido debe usar `widget_token` como contexto principal y no depender de rutas globales.
- Frontend prioriza `cart.summary_endpoint` y `cart.items_endpoint` antes de `cart.legacy_endpoint`.
- Frontend envia `widget_session_token`, `anon_id` y `chat_session_id` cuando esten disponibles para conservar carrito e historial.
- Para colegios y municipios, el portal muestra casos, reclamos, turnos, encuestas e historial de mensajes.
- Para PyMEs, el portal muestra catalogo, carrito, pedidos, pagos, facturas/comprobantes e historial.
- Todas las respuestas publicas deben incluir `request_id` y CORS OK para `https://www.chatboc.ar` y dominios embebidos autorizados por tenant.

## Aceptacion compartida

- Elegir `Colegios`, `Gobiernos` o `Empresas` una vez no vuelve a pedir rubro.
- Un script embebido con `widget_token` abre en contexto del tenant correcto.
- Un visitante anonimo puede agregar productos al carrito.
- El visitante puede comprar como invitado si el tenant lo permite.
- Si se registra, conserva carrito e historial.
- El portal del usuario muestra interacciones de widget y WhatsApp del mismo tenant.
- Si live chat/socket esta apagado, no hay 404 ni errores CORS: solo degradacion limpia.
