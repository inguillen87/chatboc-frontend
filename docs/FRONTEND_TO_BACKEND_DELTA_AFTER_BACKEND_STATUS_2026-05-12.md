# Frontend to Backend Delta - After Backend Status 2026-05-12

Fecha: 2026-05-12

Objetivo: este delta parte del `Backend docs implementation status` recibido. No reabre contratos ya implementados; enumera solo lo que frontend necesita confirmar o agregar para que landing, widget, integraciones, carrito y portal queden consistentes en produccion.

## Frontend ya alineado

- Widget onboarding usa `GET /api/public/widget-config` y `workspace.chat_bootstrap` cuando existe.
- El selector legacy `Bienvenido al showroom interactivo...` se filtra aunque llegue anidado en `data`, `payload`, `metadata`, `quick_replies`, `buttons`, `options` o secciones interactivas.
- `live-chat/schedule` se consulta solo same-origin:
  - `GET /api/{tenant_slug}/live-chat/schedule?tenant_slug={tenant_slug}&tenant={tenant_slug}`
- Socket.IO queda apagado salvo contrato explicito:
  - `realtime.socket_enabled === true`
  - `visibility_rules.allow_websocket === true`
  - `support_channels.live_chat.socket_enabled === true`
- Integraciones ya tiene cabina visual para WhatsApp Sandbox, frase clave, WhatsApp de prueba, rubro, brief, mensaje inicial y quick menu del tenant.
- Catalog draft en frontend degrada a borrador local si backend no publica endpoint remoto.
- Service worker frontend se registra inmediatamente y auto-aplica nuevas versiones en rutas publicas para reducir bundles cacheados; en paneles mantiene aviso para no interrumpir ediciones.
- Widget embebido ya consume `GET /api/public/widget-commerce-session` y `GET /api/public/widget-user/tenant-history` cuando existen.
- Widget embebido renderiza acciones compactas de catalogo, carrito y portal solo si el contrato lo declara con `frontend_contract.render_as=embedded_tenant_operating_widget`.
- Accesibilidad inclusiva queda backend-driven: `ui_hints.accessibility` puede habilitar/ocultar dislexia, texto simple, alto contraste, controles grandes, subtitulos y menos movimiento.
- Rutas publicas de marketing ya no se tratan como tenants: `/t/pymes`, `/t/colegios`, `/t/casos`, etc. redirigen a demo o seccion publica.
- Catalogo publico degrada limpio con `public.catalog_resolution.v1` / `public.reserved_slug.v1`.
- Tenant public home usa `tenant.public_navigation.v1` para esconder o deshabilitar botoneras no disponibles.
- Demo integrada consume `demo.admin_preview.v1` para modulos, cards y timeline; el contenido local queda como respaldo.
- Build frontend `npm run build`: OK.

## Pedido backend prioritario

### 1. Confirmar deploy real de runtime publico

Validar en produccion, con `Origin: https://www.chatboc.ar`, que respondan JSON + CORS OK:

- `GET /api/public/widget-config`
- `POST /api/v2/demo/session`
- `GET /api/v2/demo/catalog`
- `GET /api/{tenant_slug}/live-chat/schedule?tenant_slug={tenant_slug}&tenant={tenant_slug}`
- `GET /api/public/realtime/voice-capabilities`
- `GET /api/public/tracking/experience?kind=claim&code=demo&pin=demo`

Aceptacion:

- Sin HTML.
- Sin 405 sin CORS.
- Con `request_id` o header `X-Request-Id`.
- Si algo esta deshabilitado, responder JSON degradable.

### 2. WhatsApp Sandbox desde integraciones

Frontend ya manda:

`POST /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-session`

Body:

```json
{
  "tenant_slug": "junin-1",
  "whatsapp": "+549...",
  "join_phrase": "join palabra-clave",
  "rubro": "colegio|municipio|pyme",
  "brief": "Probar menu del tenant",
  "test_message": "Hola, quiero probar el asistente",
  "menu_preview": [],
  "source": "tenant_integrations_panel"
}
```

Respuesta esperada:

```json
{
  "contract_version": "whatsapp.sandbox_session.v1",
  "ok": true,
  "tenant": { "slug": "junin-1" },
  "twilio": {
    "sandbox_number": "whatsapp:+14155238886",
    "join_phrase": "join palabra-clave",
    "wa_deeplink": "https://wa.me/14155238886?text=join%20..."
  },
  "demo_context": {
    "tenant_slug": "junin-1",
    "rubro": "colegio",
    "brief": "...",
    "quick_menu": []
  },
  "request_id": "req_..."
}
```

Alias util:

- `POST /api/v2/whatsapp/sandbox-session`

### 3. Widget embebido + carrito + portal usuario

Frontend ya consume el bundle publico para que el script del tenant no sea solo chat, sino experiencia completa: chat, catalogo, carrito anonimo, checkout invitado/registrado e historial.

Endpoint sugerido:

`GET /api/public/widget-commerce-session`

Query/headers:

- `widget_token`
- `tenant_slug`
- `X-Widget-Token`
- `X-Tenant-Slug`
- `X-Chat-Session-Id`
- `X-Demo-Session-Id`

Contrato esperado:

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
  "frontend_contract": {
    "render_as": "embedded_tenant_operating_widget",
    "primary_actions": ["chat", "catalog", "cart", "portal"]
  }
}
```

### 4. Historial unificado por tenant

Endpoint sugerido:

`GET /api/public/widget-user/tenant-history`

Debe resolver por usuario autenticado, `anon_id`, `chat_session_id`, WhatsApp/contacto y `tenant_slug`.

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

### 5. Catalog draft remoto para admin tenant

Frontend ya degrada a borrador local, pero para persistir entre dispositivos conviene publicar:

- `PUT /api/admin/tenants/{tenant_slug}/catalog/draft`
- o exponer `links.draft_endpoint` en el contrato de catalogo/admin.

Respuesta minima:

```json
{
  "contract_version": "catalog.draft.v1",
  "ok": true,
  "tenant_slug": "junin-1",
  "draft_id": "draft_...",
  "updated_at": "2026-05-12T12:00:00Z",
  "request_id": "req_..."
}
```

### 6. Public demo route contracts

Frontend ya consume:

- `GET /api/public/tenants/{tenant_slug}/public-navigation`
- `GET /api/v2/demo/admin-preview?sector=educacion|gobierno|empresas&tenant_slug=...`
- `GET /api/public/tenants/{slug}/catalog` con respuesta degradable `public.catalog_resolution.v1`

Backend a mantener:

- Slugs reservados de marketing no deben resolverse como tenants reales.
- `public-navigation` debe traer `items[]` con `id`, `label`, `route|href`, `enabled` y `visible` cuando aplique.
- `demo.admin_preview.v1` debe traer copy comercial, no tecnico, porque se muestra en la demo publica.
- Todo contrato publico debe responder JSON + CORS + `request_id`.

### 7. WhatsApp Sandbox guiado para integraciones

Estado actualizado: frontend ya consume `sandbox-session` desde la pantalla de integraciones y degrada a prueba manual si el deploy todavia no esta disponible.

Endpoints backend informados:

- `POST /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-session`
- `POST /api/v2/whatsapp/sandbox-session`

Respuesta esperada:

```json
{
  "contract_version": "whatsapp.sandbox_setup.v1",
  "tenant_slug": "colegio-demo",
  "provider": "twilio_whatsapp",
  "enabled": true,
  "sandbox": {
    "enabled": true,
    "join_number": "whatsapp:+14155238886",
    "join_phrase": "join brief-demo",
    "qr_url": "https://...",
    "instructions": [
      { "id": "save_number", "label": "Guarda el numero de prueba" },
      { "id": "send_phrase", "label": "Envia la frase de activacion" },
      { "id": "try_menu", "label": "Proba el menu del tenant" }
    ]
  },
  "demo_context": {
    "sector": "educacion",
    "tenant_slug": "colegio-demo",
    "rubro": "colegios",
    "quick_menu": []
  },
  "test": {
    "endpoint": "/api/v2/tenants/colegio-demo/whatsapp/sandbox-test",
    "method": "POST",
    "payload_template": {
      "to": "{whatsapp_number}",
      "message": "{message}"
    }
  },
  "frontend_contract": {
    "render_as": "whatsapp_sandbox_onboarding",
    "show_preview": true,
    "show_status_check": true
  },
  "request_id": "req_..."
}
```

Reglas esperadas:

- El menu usado en sandbox debe ser el mismo menu configurado del tenant/widget/WhatsApp.
- Si falta configuracion de Twilio, responder JSON degradable con checklist accionable y `request_id`.
- No devolver HTML ni errores CORS en integraciones.
- Frontend muestra deeplink, frase join, preview de quick menu y boton para copiar instrucciones cuando `sandbox-session` responde OK.

## Compatibilidad para builds viejos

Aunque frontend nuevo ya no deberia pedirlos, backend deberia mantener JSON/CORS para:

- `POST /v2/demo/session`
- `POST /api/v1/demo/session`
- `POST /v1/demo/session`
- `GET /api/demo/live-chat/schedule`
- `GET /demo/live-chat/schedule`
- `GET /{tenant_slug}/live-chat/schedule`

Respuesta degradable para schedule:

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

## Criterios de aceptacion compartida

- Abrir widget de landing muestra selector solo una vez.
- Elegir Colegios/Gobiernos/Empresas no vuelve a pedir rubro.
- No aparece el texto legacy `showroom interactivo`.
- No hay requests a Socket.IO si el contrato lo marca apagado.
- Integraciones permite probar WhatsApp Sandbox con el menu real del tenant.
- Un widget embebido con `widget_token` resuelve tenant, carrito, checkout y portal.
- Un visitante anonimo puede agregar al carrito y luego registrarse sin perder historial.
- Todo error publico trae JSON + `request_id`.
