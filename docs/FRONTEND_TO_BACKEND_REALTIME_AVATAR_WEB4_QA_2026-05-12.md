# Frontend to Backend Sync - Realtime Avatar Web 4.0 QA 2026-05-12

Fecha: 2026-05-12

Objetivo: integrar en el widget web una experiencia multimodal realtime con chat, llamada y video/avatar sin crear una app paralela. El frontend consume `support_channels`, `widget.attributes`, `/api/public/realtime/session` y `/api/public/realtime/action-event` como fuente de verdad.

## Frontend aplicado

### Widget realtime

- El widget muestra modo `Chat`, `Llamada` y `Video` dentro del panel realtime.
- `Llamada` solo queda habilitada si `support_channels.voice_call.enabled === true` y las capacidades realtime permiten tool calling.
- `Video` solo queda habilitado si `support_channels.video_call.enabled === true` y `data-realtime-video-enabled` no lo deshabilita.
- Se agrego un stage visual `RealtimeAvatarStage` con:
  - avatar tipo/persona desde `data-avatar-type` y `data-avatar-persona`,
  - logo tenant cuando existe,
  - estado `connecting/live/reconnecting/ended`,
  - latencia visual,
  - mute/unmute,
  - captions de alto contraste,
  - barras de actividad para escucha/respuesta.

### Session bootstrap

El frontend llama:

```http
POST /api/public/realtime/session
```

Con body:

```json
{
  "tenant_slug": "tenant",
  "channel": "voice|video",
  "model": "gpt-realtime",
  "fallback_model": "gpt-realtime",
  "voice": "marin",
  "transport": "webrtc",
  "profile": "municipio|pyme|colegio|general"
}
```

Lee y conserva:

- `session.id` o `session_id`,
- `model`,
- `avatar.type`,
- `avatar.persona`,
- headers `X-RateLimit-Limit` y `X-RateLimit-Window`.

### Fallback video a voz

Si `channel=video` falla por navegador/camara o backend responde:

- `400 video_realtime_disabled`,
- `400 video_disabled`,
- `400 webcam_unavailable`,

el frontend cambia a `voice`, marca estado `reconnecting`, emite `realtime_mode_switched` y reintenta `/api/public/realtime/session` con `channel=voice`.

### Action events

El frontend ya emite:

```http
POST /api/public/realtime/action-event
```

Para herramientas realtime y acciones de negocio:

- `business_action_executed`,
- `realtime_session_started`,
- `realtime_session_failed`,
- `realtime_mode_switched`,
- `avatar_rendered`,
- `accessibility_caption_enabled`,
- resumen por WhatsApp/email.

Payload base:

```json
{
  "tenant_slug": "tenant",
  "widget_token": "...",
  "channel": "voice|video",
  "action": "crear_reclamo|crear_pedido|request_agent|send_summary_whatsapp",
  "session_id": "rt_sess_123",
  "status": "ok",
  "details": {}
}
```

## Backend a confirmar en produccion

1. `GET /api/public/widget-config` debe traer `support_channels.voice_call` y `support_channels.video_call` con `enabled`, `provider`, `model`, `features` y `capabilities`.
2. `widget.attributes` debe incluir:
   - `data-realtime-model`,
   - `data-realtime-voice-enabled`,
   - `data-realtime-video-enabled`,
   - `data-avatar-enabled`,
   - `data-avatar-type`,
   - `data-avatar-persona`.
3. `POST /api/public/realtime/session` debe devolver JSON para todos los errores publicos:
   - `503 openai_api_key_missing`,
   - `400 video_realtime_disabled`,
   - `403 widget_token_invalid`,
   - `429 rate_limit_exceeded`.
4. CORS debe permitir `X-Tenant-Slug`, `X-Widget-Token`, `X-Demo-Session-Id`, `X-Chat-Session-Id` y exponer `X-Request-Id`, `X-RateLimit-Limit`, `X-RateLimit-Window`.
5. `POST /api/public/realtime/action-event` debe aceptar eventos idempotentes aunque el canal realtime este en fallback.

## Analytics, mapas y encuestas

El frontend ya tiene soporte MapLibre-first para contratos `geo_layers`:

- `style_url`,
- `source` GeoJSON,
- `source_options.cluster`,
- capas `heatmap`, `clusters`, `points`,
- hover,
- cluster click,
- time slider,
- telemetry endpoint.

Tambien existe consumo de:

- `GET /admin/analytics/realtime-hub`,
- `GET /admin/analytics/heatmap`,
- `GET /admin/encuestas/{id}/analytics/dashboard`,
- `GET /admin/encuestas/{id}/analytics/heatmap`.

Pedido backend: mantener `segments`, `segments_filters_applied`, `geo_layers.categories[]`, `legend`, `telemetry.event_endpoint` y `metadata.category_layers` siempre que haya datos de mapas/encuestas.

## Verificacion frontend

- `vite build`: OK.

## Observaciones

- El frontend no conecta Socket.IO si backend no lo habilita por contrato.
- Video/avatar se degrada a voz; si voz tampoco esta disponible, vuelve a chat normal.
- Las labels visibles de acciones comerciales, quick replies y rubros siguen viniendo del backend.
