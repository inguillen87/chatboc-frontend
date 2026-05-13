# Frontend to Backend Sync - Real Rubro Demos 2026-05-12

Objetivo: las demos de Chatboc no deben usar mocks, placeholders ni respuestas locales. Cada rubro debe iniciar una experiencia real, con sesion backend, respuesta IA server-side, captura de lead/ticket cuando corresponda y panel demo operativo.

## Estado frontend

Frontend queda en modo estricto:

- No crea `demo.session.local`.
- No inventa catalogos, carritos, productos, pedidos ni respuestas de chat.
- No usa selector legacy de dos rubros.
- No usa carrito local si falla backend.
- Si un contrato real no esta disponible, muestra estado honesto y reintento, no maqueta.
- La landing/demo/widget consumen contratos reales y dejan de simular datos.

## Contratos necesarios para demos increibles

### 1. Catalogo de demos

`GET /api/v2/demo/catalog`

Debe devolver solo pilares/rubros reales publicados:

- `contract_version: demo.catalog.v2`
- `pillars[]`
- `sector_groups[]`
- `rubros[]`
- `resources[]`
- `request_id`

Regla: si un rubro no esta listo, no publicarlo como demo clickeable.

### 2. Crear sesion real

`POST /api/v2/demo/session`

Payload frontend:

```json
{
  "sector": "educacion|gobierno|empresas",
  "tenant_slug": "colegio-demo",
  "rubro": "colegios"
}
```

Respuesta obligatoria:

```json
{
  "contract_version": "demo.session.v2",
  "request_id": "req_...",
  "demo_session_id": "demo_...",
  "session_id": "demo_...",
  "tenant_slug": "colegio-demo",
  "workspace": {
    "title": "Colegio privado integral",
    "welcome_message": "Texto comercial y simple",
    "quick_replies": [],
    "value_cards": [],
    "media_capabilities": {},
    "conversion_ctas": {},
    "chat_bootstrap": {
      "endpoint": "/api/ask/pyme",
      "headers": {
        "X-Demo-Session-Id": "demo_...",
        "X-Chat-Session-Id": "demo_...",
        "X-Tenant-Slug": "colegio-demo"
      },
      "payload": {
        "rubro": "colegios",
        "vertical": "educacion"
      }
    }
  }
}
```

Regla: si no hay `demo_session_id/session_id`, frontend no inicia demo.

### 3. Chat IA real

El endpoint de `workspace.chat_bootstrap.endpoint` debe responder usando backend + OpenAI API server-side. No exponer API keys en frontend.

Respuesta esperada por mensaje:

```json
{
  "contract_version": "chat.response.v1",
  "request_id": "req_...",
  "conversation_id": "conv_...",
  "message": "Respuesta final para el usuario",
  "messages": [],
  "quick_replies": [],
  "actions": [],
  "lead": {
    "created": true,
    "lead_id": 123,
    "ticket_id": 456,
    "detail_endpoint": "/api/v2/inbox/omnichannel/456"
  }
}
```

Reglas:

- La IA debe usar el rubro, tenant, quick menu y capacidades del contrato.
- Si detecta intencion accionable, crear lead/ticket real.
- Si requiere humano, devolver `lead/ticket_id` y acciones permitidas.
- Si OpenAI o el runtime fallan, devolver JSON accionable con `request_id`; no respuesta inventada.

### 4. Demos por vertical

Backend deberia preparar perfiles reales para:

- Colegios: inasistencias, certificados, admisiones, pagos, documentacion, convivencia, derivacion sensible.
- Municipios/gobiernos: reclamos con ubicacion, fotos/audio, tramites, seguimiento por codigo/PIN, mapa.
- Pymes: catalogo real, carrito invitado, checkout, pagos, pedidos, comprobantes, seguimiento.

Cada rubro debe incluir:

- `quick_replies[]`
- `sample_conversations[]`
- `value_cards[]`
- `allowed_actions[]`
- `lead_capture.schema`
- `tracking`
- `admin_preview_endpoint`

### 5. Panel demo real

`GET /api/v2/demo/admin-preview?sector=educacion&tenant_slug=colegio-demo`

Debe devolver `demo.admin_preview.v1` con:

- `modules[]`
- `cards[]`
- `timeline[]`
- `catalog`
- `inbox`
- `operations`
- `education` cuando aplica
- `request_id`

Regla: si no hay datos reales todavia, devolver arrays vacios con mensaje de setup, no metricas falsas.

### 6. Widget embebido premium

Frontend ya consume:

- `GET /api/public/widget-commerce-session`
- `GET /api/public/widget-user/tenant-history`
- `POST /api/public/widget-user/register`
- `POST /api/public/widget-user/link-session`

Regla backend:

- Mantener `widget_session_token`, `anon_id` y `chat_session_id`.
- Carrito invitado y portal deben usar endpoints reales.
- Historial debe traer tickets, pedidos, mensajes y carrito reales por tenant.

## Criterio de aceptacion

Una demo queda lista solo si:

- Crea sesion real.
- El chat responde con IA server-side.
- Puede crear lead/ticket real.
- El panel admin preview muestra el resultado.
- El catalogo/carrito/portal funcionan con endpoints reales.
- No aparecen mocks, placeholders ni fallback local.

