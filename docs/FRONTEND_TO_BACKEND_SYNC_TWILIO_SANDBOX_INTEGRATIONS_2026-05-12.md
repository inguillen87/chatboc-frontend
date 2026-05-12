# Frontend to Backend Sync - Twilio Sandbox + Integraciones 2026-05-12

Fecha: 2026-05-12

Objetivo: que el panel tenant permita probar WhatsApp Sandbox y el widget con el rubro/menu real del tenant, sin pantallas rotas ni consola roja.

## Aplicado frontend

- En Integraciones > WhatsApp se agrega una cabina de prueba para:
  - WhatsApp de prueba o sandbox.
  - Frase clave de Twilio.
  - Rubro/recorrido.
  - Brief de la prueba.
  - Mensaje inicial.
  - Preview de quick menu leido desde `GET /api/public/tenants/{slug}/widget-config`.
- Si backend no tiene endpoint de sandbox, frontend degrada a modo local:
  - arma texto copiable;
  - genera deeplink `wa.me`;
  - no bloquea la pantalla.
- Se apaga Socket.IO global por defecto. Solo se intenta si:
  - `VITE_ENABLE_SOCKET_IO=true` o `VITE_ENABLE_GLOBAL_SOCKET=true`, o
  - el contrato publico marca socket explicitamente habilitado.
- MapLibre deja de intentar `maps.chatboc.ar` si ese host viene por env y usa el bundle local/fallback.
- El editor de catalogo guarda borrador local si backend todavia no publica un endpoint de draft.
- Se agregaron titulos/description ocultos en dialogos para accesibilidad.

## Endpoint pedido para backend

Endpoint tenant-aware recomendado:

`POST /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-session`

Alias opcional:

`POST /api/v2/whatsapp/sandbox-session`

Body que manda frontend:

```json
{
  "tenant_slug": "junin-1",
  "whatsapp": "+549...",
  "join_phrase": "join palabra-clave",
  "rubro": "colegio|municipio|pyme|...",
  "brief": "Probar menu del tenant y crear un caso/pedido/reclamo",
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

Errores publicos deben ser JSON con `request_id` y CORS OK para `www.chatboc.ar`.

## Otros contratos que bloquearon prod

- Publicar o documentar endpoint de draft:
  - `PUT /api/admin/tenants/{tenant_slug}/catalog/draft`, o
  - exponer `links.draft_endpoint` en `GET /api/admin/tenants/{tenant_slug}/catalog`.
- Si no hay draft remoto, frontend guardara local, pero el admin no podra persistir entre dispositivos.
- Evitar 404/CORS en:
  - `/api/live-chat/schedule`
  - `/api/{tenant_slug}/live-chat/schedule`
  - `/{tenant_slug}/live-chat/schedule`
- Si Socket.IO no esta publicado, mantener:
  - `realtime.socket_enabled=false`
  - `visibility_rules.allow_websocket=false`
  - `support_channels.live_chat.socket_enabled=false`
- Si se publica Socket.IO, devolver `socket_url`, `socket_transports` y `socket_transport_hint`.
- Revisar env de mapas: no usar `maps.chatboc.ar` hasta que resuelva DNS y sirva `maplibre-gl.js`, `maplibre-gl.css` y `style.json`.

## Pendiente para experiencia embebida completa

Frontend necesita un bundle backend-first para el widget embebido con:

- `widget_session_token` para asociar visitante anonimo o registrado al tenant.
- carrito público por tenant;
- checkout invitado y registrado;
- portal de usuario con historial de chat, WhatsApp, tickets, pedidos, pagos y encuestas;
- deep links para volver al tenant correcto desde WhatsApp/email.

Ya existe el handoff ampliado en:

`docs/FRONTEND_TO_BACKEND_SYNC_EMBED_WIDGET_COMMERCE_PORTAL_2026-05-12.md`
