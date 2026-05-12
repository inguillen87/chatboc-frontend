# Frontend to Backend Sync - Realtime Voice QA 2026-05-12

Fecha: 2026-05-12

Objetivo: alinear el frontend con el contrato actualizado de voz realtime sin inventar modelos, labels ni starters locales.

## Aplicado frontend

- `GET /api/public/realtime/voice-capabilities` se consume por same-origin y sin credenciales de panel.
- El CTA de llamada IA ahora se renderiza solo si se cumplen las dos condiciones del contrato:
  - `support_channels.voice_call.enabled === true`
  - `realtime_voice.features.tool_calling === true`
- Si backend responde `enabled=false`, `reason_code=voice_not_enabled`, `tenant_resolution_failed` o `features.tool_calling=false`, frontend no muestra el CTA.
- El payload de `/api/public/realtime/session` usa `recommended_model`, `fallback_model`, `voice`, `transports.browser` y `active_vertical` que llegan del backend/widget config.
- Frontend no hardcodea `gpt-realtime-2` ni `gpt-realtime-1.5`; acepta el modelo actual que mande backend, incluyendo `gpt-realtime`.
- Badges y starters son backend-first:
  - badges: `trust_badges`, `badges` o `badge_labels`.
  - starters: `starter_messages`, `voice_starters` o `starters`.
- Si backend no manda starters, frontend no inventa starters por vertical.
- Los eventos `chatboc:realtime-tool-call` y `chatboc:realtime-action` siguen convirtiendose en `POST /api/public/realtime/action-event`.

## Validacion frontend

Test agregado:

- `src/utils/realtimeVoice.test.ts`

Cubre:

- No mostrar CTA sin `voice_call.enabled`.
- No mostrar CTA si `enabled=false`.
- No mostrar CTA si `tool_calling=false`.
- Mantener badges y starters desde backend.

## Pedido backend/deploy

- Mantener `GET /api/public/realtime/voice-capabilities` con HTTP 200 degradable y `request_id`.
- Mantener `recommended_model: "gpt-realtime"` y `fallback_model: "gpt-realtime"` desde backend si ese es el default vigente.
- Incluir `support_channels.voice_call.enabled` junto con `realtime_voice.features.tool_calling` en `GET /api/public/widget-config` y demos.
- Cuando voice no este listo, responder `enabled:false` y `features.tool_calling:false` para que frontend oculte llamada.
- Confirmar que `POST /api/public/realtime/session` acepta `model`, `fallback_model`, `voice`, `transport` y `profile` desde el contrato publico.
