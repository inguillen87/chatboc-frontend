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
  - Preview de quick menu leido desde `GET /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-setup` y, como respaldo, desde `GET /api/public/tenants/{slug}/widget-config`.
- Frontend consume `sandbox-setup` para instrucciones/frase/menu y `sandbox-test` para generar deeplink/copy/preview sin enviar mensajes reales.
- Si el deploy todavia no tiene endpoint de sandbox, frontend degrada a modo local:
  - arma texto copiable;
  - genera deeplink `wa.me`;
  - no bloquea la pantalla.
- Se apaga Socket.IO global por defecto. Solo se intenta si:
  - `VITE_ENABLE_SOCKET_IO=true` o `VITE_ENABLE_GLOBAL_SOCKET=true`, o
  - el contrato publico marca socket explicitamente habilitado.
- MapLibre deja de intentar `maps.chatboc.ar` si ese host viene por env y usa el bundle local/fallback.
- El editor de catalogo guarda borrador local si backend todavia no publica un endpoint de draft.
- Se agregaron titulos/description ocultos en dialogos para accesibilidad.

## Contrato backend confirmado

Nota WhatsApp Sandbox:

Ademas de `sandbox-session`, backend tambien dejo listo el flujo guiado `sandbox-setup` + `sandbox-test`.

Setup tenant-aware:

`GET /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-setup`

Setup alias:

`GET /api/v2/whatsapp/sandbox-setup`

Test tenant-aware:

`POST /api/v2/tenants/{tenant_slug}/whatsapp/sandbox-test`

Test alias:

`POST /api/v2/whatsapp/sandbox-test`

Body que manda frontend al test:

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

Respuesta setup:

```json
{
  "contract_version": "whatsapp.sandbox_setup.v1",
  "sandbox": {
    "join_number": "whatsapp:+14155238886",
    "join_phrase": "join palabra-clave",
    "instructions": []
  },
  "demo_context": {
    "quick_menu": []
  },
  "test": {
    "endpoint": "/api/v2/tenants/junin-1/whatsapp/sandbox-test"
  },
  "frontend_contract": {
    "render_as": "whatsapp_sandbox_onboarding"
  },
  "request_id": "req_..."
}
```

Respuesta test:

```json
{
  "contract_version": "whatsapp.sandbox_test.v1",
  "ok": true,
  "mode": "copy_or_deeplink",
  "sends_real_message": false,
  "twilio": {
    "wa_deeplink": "https://wa.me/14155238886?text=join+palabra-clave"
  },
  "message_preview": {
    "copy_text": "join palabra-clave\n\nHola, quiero probar el asistente",
    "message": "Hola, quiero probar el asistente"
  },
  "request_id": "req_..."
}
```

Errores publicos deben ser JSON con `request_id` y CORS OK para `www.chatboc.ar`.

Contratos:

- `whatsapp.sandbox_setup.v1`
- `whatsapp.sandbox_session.v1`
- `whatsapp.sandbox_test.v1`

Verificacion local backend:

- `test_whatsapp_sandbox_setup_and_test_contracts_are_backend_first`: OK

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
