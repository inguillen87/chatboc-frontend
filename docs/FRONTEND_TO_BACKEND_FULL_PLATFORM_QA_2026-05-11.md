# Frontend to Backend Sync - Full Platform QA 2026-05-11

Fecha: 2026-05-11

Objetivo: bajar a backend los blockers reales vistos desde frontend/prod despues de la ola `Full Platform QA 2026-05-09`, manteniendo la regla de no crear app paralela: frontend consume contratos backend-first y solo agrega degradacion profesional.

## 1. Cambios ya aplicados en frontend

- `chat_bootstrap.endpoint` ahora se respeta como fuente canonica. Si backend manda `/ask/municipio` o `/ask/pyme`, frontend lo llama como endpoint raiz y evita transformarlo a `/api/ask/*`.
- Se agregaron rewrites/proxy frontend para `/ask/*`, `/archivos/*` y `/socket.io/*` en local/Vercel.
- `GET /api/public/realtime/voice-capabilities` se consulta por same-origin `/api/public/...` para evitar CORS directo contra Render.
- Si realtime voice no existe o responde 404/405/501, frontend degrada a modo chat normal sin bloquear UX.
- Importacion legacy de catalogo ya muestra envelopes `{ codigo, mensaje }` sin caer en HTML/generico.
- Casos escolares ya priorizan `taxonomy_label` sobre `case_type` para labels visibles.
- Catalogos demo PDF existen en `public/demo-catalogs/*.pdf` y ademas hay generador browser-side como fallback.

## 2. Blockers backend que siguen siendo importantes

### A. Chat demo `/ask/*`

Visto en produccion:

```text
POST https://www.chatboc.ar/api/ask/municipio?tenant_slug=municipio -> 500
```

Frontend nuevo intenta evitar `/api/ask/*`, pero conviene que backend agregue alias compatible para chunks viejos/cacheados:

```text
POST /api/ask/municipio -> proxy/alias de POST /ask/municipio
POST /api/ask/pyme -> proxy/alias de POST /ask/pyme
```

Respuesta esperada exitosa:

```json
{
  "respuesta_usuario": "Texto claro del asistente",
  "botones": [],
  "actions": [],
  "ticket": null,
  "request_id": "req_123"
}
```

Respuesta esperada error:

```json
{
  "error": {
    "code": 500,
    "message": "Mensaje claro y accionable"
  },
  "request_id": "req_123"
}
```

### B. Demo session con aliases

Visto en produccion:

```text
POST /api/v2/demo/session -> 400
mensaje: "rubro o tenant_slug es obligatorio"
```

Frontend envia seleccion desde el catalogo de tres pilares. Backend deberia aceptar cualquiera de estos alias sin romper:

```json
{
  "sector": "educacion",
  "pilar": "colegios",
  "categoria": "colegio-demo",
  "rubro": "colegio-demo",
  "tenant_slug": "colegio-demo"
}
```

Si falta `tenant_slug`, backend deberia resolverlo desde `sector/rubro/categoria` o devolver un error JSON con `request_id`, `reason_code` y `hints`.

### C. Realtime voice capabilities

Visto en produccion:

```text
GET /api/public/realtime/voice-capabilities -> 404
GET https://chatbot-backend-2e14.onrender.com/api/public/realtime/voice-capabilities -> CORS preflight failed
```

Frontend ahora llama same-origin, pero backend deberia exponer:

```text
GET /api/public/realtime/voice-capabilities
```

Si voice no esta habilitado para el tenant, mejor devolver 200 degradable:

```json
{
  "contract_version": "realtime.voice_capabilities.v1",
  "enabled": false,
  "provider": "openai_realtime",
  "features": {
    "tool_calling": false
  },
  "reason_code": "voice_not_enabled",
  "request_id": "req_123"
}
```

### D. Socket.IO

Visto en produccion:

```text
/socket.io/?EIO=4&transport=polling -> 404
wss://www.chatboc.ar/socket.io/?EIO=4&transport=websocket -> failed
```

Frontend degrada a modo normal si realtime no esta disponible. Backend debe confirmar una de estas dos opciones:

- Socket.IO disponible en `/socket.io`.
- Socket.IO no disponible y contrato/widget config debe mandar `visibility_rules.allow_websocket=false`.

### E. Upload multimedia

Frontend usa lo que backend mando en `media_capabilities`:

```text
POST /archivos/upload/chat_attachment
```

Para compatibilidad con builds viejos y proxies, backend podria mantener tambien:

```text
POST /api/archivos/upload/chat_attachment
```

Respuesta esperada:

```json
{
  "attachmentInfo": {
    "url": "https://...",
    "name": "archivo.pdf",
    "mimeType": "application/pdf",
    "size": 12345
  },
  "request_id": "req_123"
}
```

### F. Catalog import legacy

Frontend ya soporta:

```json
{
  "codigo": "formato_no_soportado",
  "mensaje": "No se pudo interpretar el formato del archivo. Proba con PDF, Excel o CSV."
}
```

Pedido: mantener JSON en todos los errores de `POST /api/admin/catalogo/importar`, incluyendo `method_not_allowed`, `archivo_requerido`, `tenant_no_resuelto` y `formato_no_soportado`.

### G. Educacion `taxonomy_label`

Frontend ya renderiza `taxonomy_label` cuando existe. Pedido backend: mantenerlo estable en tickets/casos escolares:

```json
{
  "school_case": {
    "case_type": "documentacion",
    "taxonomy_label": "Documentación",
    "ticket_type": "pyme"
  }
}
```

## 3. Orden recomendado

1. Alias `/api/ask/municipio` y `/api/ask/pyme`, porque evita errores con frontend cacheado.
2. `POST /api/v2/demo/session` tolerante a aliases de pilar/rubro/categoria.
3. `GET /api/public/realtime/voice-capabilities` con 200 degradable si no esta habilitado.
4. Confirmar `/socket.io` o mandar `allow_websocket=false`.
5. Alias `/api/archivos/upload/chat_attachment`.
6. Mantener `taxonomy_label` y envelopes legacy catalogo.

## 4. Tests frontend esperando esto

- `src/features/chat/chatApi.test.ts`: verifica que frontend respeta `/ask/municipio`.
- `src/utils/api.errorMessage.test.ts`: verifica `{ codigo, mensaje }`.
- `tests/e2e/chatboc-smoke.spec.ts`: demo tres pilares, chat degradable y catalogo PDF.

