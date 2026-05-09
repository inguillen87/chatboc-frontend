# Frontend to Backend Runtime Fixes - 2026-05-08

Objetivo: cerrar errores reales vistos en produccion (`https://www.chatboc.ar`) sin crear una app paralela. Frontend ya degrada mejor, pero backend/proxy debe estabilizar estos contratos para que landing, demo y widget funcionen sin consola roja.

## 1. Errores observados en produccion

### Realtime voice capabilities

Actual:

- `GET /api/public/realtime/voice-capabilities` devuelve `404`.
- Fallback directo a `https://chatbot-backend-2e14.onrender.com/api/public/realtime/voice-capabilities` falla por CORS en preflight.
- Tambien se probo `/public/realtime/voice-capabilities` y devuelve error/CORS.

Esperado:

```http
GET /api/public/realtime/voice-capabilities?tenant_slug=<slug>
Origin: https://www.chatboc.ar
```

Debe responder 200 o 204/JSON accionable, nunca CORS/preflight fallido.

```json
{
  "contract_version": "realtime.voice_capabilities.v1",
  "provider": "openai_realtime",
  "recommended_model": "gpt-realtime-2",
  "fallback_model": "gpt-realtime-1.5",
  "voice": "marin",
  "active_vertical": "municipio",
  "native_speech_to_speech": true,
  "avoid_external_stt_tts_loop": true,
  "transports": {
    "browser": "webrtc",
    "server": "websocket",
    "phone_bridge": "twilio_media_streams",
    "sip_ready": true
  },
  "features": {
    "barge_in": true,
    "server_vad": true,
    "tool_calling": true,
    "whatsapp_followup": true,
    "post_call_receipt": true,
    "human_handoff": true
  },
  "request_id": "req_123"
}
```

Frontend ahora evita discovery global en landing para no generar ruido, pero widget/demo deben poder usar este contrato cuando backend este disponible.

## 2. Demo session v2

Actual:

- `POST https://www.chatboc.ar/api/v2/demo/session` devuelve `400 Bad Request`.
- Mensaje visto en UI: `rubro o tenant_slug es obligatorio`.
- El fallo rompe el viaje al elegir sector/categoria, especialmente educacion.

Esperado:

`POST /api/v2/demo/session` debe aceptar cualquiera de estos payloads:

```json
{
  "sector": "educacion",
  "tenant_slug": "colegio-demo",
  "rubro": "colegio-demo"
}
```

```json
{
  "sector": "gobierno",
  "tenant_slug": "municipio",
  "rubro": "municipio"
}
```

```json
{
  "sector": "empresas",
  "tenant_slug": "bodega",
  "rubro": "bodega"
}
```

Respuesta esperada:

```json
{
  "contract_version": "demo.session.v2",
  "demo_session_id": "demo_123",
  "tenant_slug": "colegio-demo",
  "tenant": {
    "slug": "colegio-demo",
    "tipo": "pyme",
    "vertical": "educacion"
  },
  "workspace": {
    "title": "Colegio Demo",
    "welcome_message": "Mensaje backend",
    "chat_bootstrap": {
      "contract_version": "demo.chat_bootstrap.v1",
      "endpoint": "/ask/pyme",
      "headers": {
        "X-Chat-Session-Id": "demo_123",
        "X-Demo-Session-Id": "demo_123",
        "X-Tenant-Slug": "colegio-demo"
      },
      "payload": {
        "pregunta": "",
        "tipo_chat": "pyme",
        "tenant_slug": "colegio-demo",
        "vertical": "educacion",
        "rubro": "colegio-demo",
        "demo_mode": true
      },
      "supports": {
        "text": true,
        "image": true,
        "audio": true,
        "location": true,
        "file": true
      }
    }
  },
  "request_id": "req_123"
}
```

## 3. Demo catalog

Frontend necesita que `GET /api/v2/demo/catalog` devuelva tres pilares estables:

```json
{
  "contract_version": "demo.catalog.v2",
  "sectors": ["gobierno", "empresas", "educacion"],
  "sector_groups": [
    {
      "key": "gobierno",
      "label": "Gobiernos",
      "tenant_slug": "municipio"
    },
    {
      "key": "empresas",
      "label": "Empresas",
      "tenant_slug": "bodega"
    },
    {
      "key": "educacion",
      "label": "Colegios",
      "tenant_slug": "colegio-demo"
    }
  ],
  "rubros": []
}
```

`rubros` puede venir como arbol. Frontend ya filtra por raiz:

- `municipios_root` / id `1` para gobierno.
- `comerciales_root` / id `2` para empresas.
- `educacion_root` / id `3` para colegios.

## 4. Socket.IO

Actual:

- `/socket.io/?EIO=4&transport=polling...` devuelve `404`.
- `wss://www.chatboc.ar/socket.io/?EIO=4&transport=websocket` falla.

Esperado:

Una de estas dos opciones:

1. Proxy same-origin:

```txt
https://www.chatboc.ar/socket.io -> backend socket.io
wss://www.chatboc.ar/socket.io -> backend socket.io
```

2. Contrato widget config para desactivar realtime live chat si no hay proxy:

```json
{
  "support_channels": {
    "live_chat": {
      "realtime": false,
      "available": false
    }
  }
}
```

Si backend no tiene socket disponible, no mandar flags que hagan conectar al frontend.

## 5. CORS requerido

Para endpoints publicos usados por widget/demo:

- `Origin: https://www.chatboc.ar`
- Metodos: `GET`, `POST`, `OPTIONS`
- Headers permitidos:
  - `Content-Type`
  - `X-Tenant-Slug`
  - `X-Widget-Token`
  - `X-Chat-Session-Id`
  - `X-Demo-Session-Id`
  - `X-Anon-Id`
  - `Anon-Id`
  - `Idempotency-Key`
- Headers expuestos:
  - `X-Request-Id`

## 6. Frontend ya ajustado

- Landing dejo de llamar discovery global de Realtime para evitar 404/CORS si backend no esta listo.
- Demo tiene fallback local de tres pilares y categorias: gobiernos, empresas y colegios.
- Demo envia `tenant_slug` demo cuando puede resolverlo desde catalogo/configuracion.
- Demo filtra categorias por sector y no mezcla colegios con empresas/gobiernos.
- Si `demo/session` falla, frontend intenta continuar en modo conversacional basico en vez de dejar pantalla muerta.
- Realtime tool/action events se convierten a `/api/public/realtime/action-event` cuando la capa WebRTC los emite.

## 7. Orden recomendado backend

1. Arreglar proxy/CORS de `/api/public/realtime/voice-capabilities`.
2. Hacer que `/api/v2/demo/session` acepte `sector + tenant_slug + rubro` para `gobierno`, `empresas`, `educacion`.
3. Garantizar `GET /api/v2/demo/catalog` con `sector_groups[].tenant_slug`.
4. Resolver `/socket.io` via proxy o apagar flags live_chat realtime en widget config.
5. Agregar catalogos demo por rubro desde backend/storage cuando esten listos.
