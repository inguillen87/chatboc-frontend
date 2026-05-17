# Frontend to Backend - Realtime y Demo Trial Limits

Fecha: 2026-05-16

## Objetivo

El frontend ya puede degradar la experiencia cuando backend corta una demo anonima por limite de uso. El corte debe sentirse comercial y controlado, no como error tecnico.

## Contratos que frontend consume

- `builder_config.demo_trial`
- `builder_config.enterprise_iteration.realtime.trial_policy`
- `support_channels.voice_call.trial_policy`
- `support_channels.video_call.trial_policy`
- `support_channels.whatsapp.trial_policy`
- `realtime_voice.trial_policy`

## Realtime session

Endpoint:

```txt
POST /api/public/realtime/session
```

El frontend envia siempre:

```json
{
  "tenant_slug": "tenant",
  "widget_token": "token",
  "anon_id": "anon_id_estable",
  "channel": "voice",
  "transport": "webrtc",
  "active_vertical": "municipio"
}
```

Respuesta esperada cuando el limite se alcanzo:

```json
{
  "ok": false,
  "error": "realtime_trial_limit_reached",
  "reason_code": "realtime_trial_limit_reached",
  "message": "La demo de llamada ya fue utilizada.",
  "request_id": "req_...",
  "trial_usage": {
    "channel": "video",
    "limit": 1,
    "used": 1,
    "remaining": 0
  },
  "upgrade": {
    "title": "Ya viste la demo real. Sigamos con una prueba guiada.",
    "cta_label": "Dejar datos",
    "lead_capture_endpoint": "/api/public/lead-capture"
  }
}
```

Reglas frontend implementadas:

- No reintenta automaticamente si `reason_code === realtime_trial_limit_reached`.
- Deshabilita ese canal (`voice` o `video`) durante la sesion actual.
- No muestra error rojo.
- Muestra card comercial con CTA de lead si `upgrade.lead_capture_endpoint` existe.
- Mantiene trazabilidad con `request_id`.

## Chat widget

Cuando `/api/ask/*` o `workspace.chat_bootstrap.endpoint` devuelva:

- `demo_message_limit_reached`
- `anonymous_trial_limit_reached`

Frontend:

- Bloquea composer y acciones multimodales.
- Mantiene historial visible.
- Muestra card comercial con CTA de lead.
- No fabrica respuestas locales para extender la demo.

Respuesta recomendada:

```json
{
  "ok": false,
  "reason_code": "demo_message_limit_reached",
  "message": "Llegaste al limite de mensajes gratis de esta demo.",
  "request_id": "req_...",
  "trial_usage": {
    "channel": "chat",
    "limit": 10,
    "used": 10,
    "remaining": 0
  },
  "upgrade": {
    "title": "Ya viste la demo real. Sigamos con una prueba guiada.",
    "cta_label": "Dejar datos",
    "lead_capture_endpoint": "/api/public/lead-capture"
  }
}
```

## WhatsApp sandbox

Para el launcher de WhatsApp, backend debe publicar antes de iniciar:

```json
{
  "whatsapp_sandbox": {
    "trial_policy": {
      "max_messages": 10,
      "free_inputs": ["text", "image", "audio"]
    }
  }
}
```

Frontend ya muestra el limite cuando `trial_policy.max_messages` viene publicado.

## QA

1. Pedir realtime voice hasta agotar limite.
2. Confirmar que no hay retry automatico.
3. Confirmar que el boton de ese canal queda deshabilitado.
4. Confirmar card comercial con endpoint de lead capture.
5. Agotar chat anonimo y confirmar composer bloqueado con historial visible.
6. Confirmar que `request_id` aparece solo como trazabilidad compacta, no como stack trace.
7. Confirmar que `anon_id` viaja en cada request realtime.
