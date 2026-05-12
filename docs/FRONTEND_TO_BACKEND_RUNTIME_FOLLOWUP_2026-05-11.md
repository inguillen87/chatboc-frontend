# Frontend to Backend Runtime Follow-up 2026-05-11

Fecha: 2026-05-11

Objetivo: confirmar que frontend ya integró los contratos runtime enviados por backend para demo, widget, Socket.IO, realtime voice y upload multimedia, sin crear rutas paralelas ni romper legacy.

## Integrado frontend

### Chat demo `/ask`

- Frontend sigue llamando `chat_bootstrap.endpoint` tal como lo manda backend.
- Para endpoints root como `/ask/municipio` y `/ask/pyme`, frontend fuerza same-origin para evitar convertirlos en `/api/ask/*`.
- `/api/ask/*` queda solo como compatibilidad backend para builds cacheados o proxies viejos.

### Socket.IO / realtime UI

- Frontend ahora interpreta `visibility_rules.allow_websocket=false` como: no intentar Socket.IO.
- También respeta `visibility_rules.allow_realtime_live_chat=false`.
- Ya no degrada a polling cuando backend dice que websocket/live-chat no está habilitado; directamente sigue en modo HTTP normal.
- Si todavía aparecen requests a `/socket.io` en producción, el sospechoso principal es un bundle cacheado anterior al deploy.

### Realtime voice

- Frontend consume `GET /api/public/realtime/voice-capabilities`.
- Si backend responde `enabled=false` o `features.tool_calling=false`, frontend no muestra CTA operativo de llamada IA.
- El contrato `realtime.voice_capabilities.v1` puede responder 200 aunque la voz esté deshabilitada.

### Upload multimedia

- Frontend prefiere `POST /archivos/upload/chat_attachment`.
- Si recibe 404, 405 o 501 en esa ruta, reintenta `POST /api/archivos/upload/chat_attachment`.
- La UI sigue esperando `attachmentInfo` cuando venga, tolerando también respuesta directa.

### Error envelopes

- Frontend ya muestra mensajes de envelopes legacy `{ codigo, mensaje }`.
- También soporta `request_id`, `X-Request-Id`, `error.message` y formatos públicos v2.

## Verificación frontend ejecutada

- `npm test -- src/features/chat/chatApi.test.ts src/utils/api.errorMessage.test.ts --pool=threads`: 2 passed.
- `npm run build`: OK.
- `npm test -- --pool=threads`: 66 files, 243 tests passed.
- `npm run test:e2e -- tests/e2e/chatboc-smoke.spec.ts --project=chromium`: 4 passed.

## Checklist backend post-deploy

1. Confirmar que `GET /api/public/widget-config` y `GET /api/public/tenants/{slug}/widget-config` devuelven `visibility_rules.allow_websocket=false` cuando Socket.IO no esté expuesto.
2. Confirmar que `POST /ask/municipio?tenant_slug=municipio` y `POST /ask/pyme` devuelven JSON, nunca HTML.
3. Confirmar que los aliases `POST /api/ask/municipio`, `POST /api/ask/pyme` y `POST /api/ask` siguen vivos para bundles cacheados.
4. Confirmar CORS/preflight 200 para `GET /api/public/realtime/voice-capabilities` desde `https://www.chatboc.ar`.
5. Confirmar CORS/preflight 200 para `POST /archivos/upload/chat_attachment` y alias `POST /api/archivos/upload/chat_attachment`.
6. Confirmar que realtime voice deshabilitado devuelve 200 con:

```json
{
  "contract_version": "realtime.voice_capabilities.v1",
  "enabled": false,
  "reason_code": "voice_not_enabled",
  "features": {
    "tool_calling": false
  }
}
```

## Blockers nuevos

No hay blockers nuevos detectados desde frontend después de integrar el último sync backend. Queda pendiente validar en producción real luego del deploy y limpiar caché/CDN si todavía aparece algún request viejo a `/socket.io`.
