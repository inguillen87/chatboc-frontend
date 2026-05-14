# Frontend Landing Hero Handoff - 2026-05-14

## Objetivo

La primera pantalla de Chatboc debe vender una experiencia premium tipo WhatsApp operativo, sin mezclar responsabilidades con backend ni mostrar datos inventados.

El frontend define la experiencia comercial: copy de landing, jerarquia visual, layout, animaciones, estados responsive y comportamiento de render. El backend define capacidades, endpoints, sesiones, acciones y datos operativos trazables. El frontend no inventa resultados operativos: tickets, pedidos, leads, casos, metricas, productos, encuestas ni mapas.

## Frontera de responsabilidad

### Frontend owns

- Headline, subheadline, CTAs y microcopy comercial de landing.
- Layout del hero, mockup mobile, tabs, burbujas, animaciones y dark/light mode.
- Jerarquia visual, ritmo de lectura y performance del primer viewport.
- Estados de carga discretos mientras llega el contrato.
- Ocultar secciones si no hay datos operativos reales.
- Validar que imagenes remotas carguen antes de mostrarlas.
- Renderizar sugerencias, botones y labels operativos solo cuando backend los envie para el flujo/tenant.

### Backend owns

- `GET /api/public/landing-experience`.
- `hero.conversation_demo.flows[]` con datos operativos reales o trazables.
- `POST /api/v2/demo/session`.
- Chat bootstrap real con `demo_session_id` y `session_id`.
- `POST /api/public/lead-capture`.
- `GET /api/v2/demo/admin-preview`.
- Acciones trazables: lead, ticket, pedido, caso escolar, respuesta de encuesta o evento analitico.
- Errores JSON con `request_id`, no HTML ni datos inventados.

## Contrato que frontend debe consumir

Fuente principal:

```txt
GET /api/public/landing-experience
```

Campos operativos relevantes:

```json
{
  "contract_version": "public.landing_experience.v1",
  "experience_kind": "platform|municipio|pyme|educacion",
  "tenant": {
    "slug": "municipio",
    "tipo": "municipio",
    "vertical": null,
    "white_label": false
  },
  "hero": {
    "contract_scope": "operational_demo_data",
    "conversation_demo": {
      "contract_version": "landing.hero_conversation_demo.v1",
      "contract_scope": "operational_demo_data",
      "flows": []
    },
    "workflow_steps": []
  },
  "conversion": {
    "lead_capture_endpoint": "/api/public/lead-capture",
    "demo_catalog_endpoint": "/api/v2/demo/catalog",
    "demo_session_endpoint": "/api/v2/demo/session",
    "admin_preview_endpoint": "/api/v2/demo/admin-preview"
  },
  "runtime_rules": {
    "frontend_owns_commercial_copy_and_visual_design": true,
    "backend_owns_sessions_actions_and_traceability": true,
    "do_not_publish_frontend_mock_data": true
  }
}
```

## Flow operativo esperado

Cada `flow` puede tener:

```json
{
  "id": "gobierno-reclamo-ubicacion",
  "label": "Gobiernos",
  "sector": "gobierno",
  "user_message": "Te mando foto, audio y ubicacion de un semaforo caido.",
  "agent_message": "Recibi la evidencia, clasifique el reclamo y lo deje listo para seguimiento.",
  "inputs": [
    { "kind": "image", "label": "Foto", "preview_url": "https://..." },
    { "kind": "audio", "label": "Nota de voz", "detail": "Transcripcion resumida por IA" },
    { "kind": "location", "label": "Ubicacion", "address": "Av. San Martin y Rivadavia", "lat": -34.6083, "lng": -58.3712 }
  ],
  "action": {
    "label": "Reclamo creado",
    "status": "ready",
    "status_label": "Listo para operar",
    "detail": "Ticket con categoria, prioridad, zona, evidencia y equipo sugerido.",
    "creates": "ticket",
    "fields": [
      { "label": "Categoria", "value": "Semaforo" },
      { "label": "Prioridad", "value": "Alta" }
    ],
    "metadata": {
      "traceable_target": "ticket"
    }
  },
  "result": {
    "kind": "ticket",
    "traceable": true,
    "panel": "inbox"
  },
  "lead_capture": {
    "enabled": true,
    "endpoint": "/api/public/lead-capture",
    "required_fields": ["nombre", "telefono"]
  },
  "admin_preview_endpoint": "/api/v2/demo/admin-preview?sector=gobierno&tenant_slug=municipio",
  "workflow_steps": ["Entiende texto y adjuntos", "Crea ticket real", "Sugiere equipo", "Deja seguimiento"],
  "cta": { "label": "Probar reclamo real", "href": "/demo?sector=gobierno" }
}
```

## Reglas de render del hero

- Renderizar el mockup tipo WhatsApp solo si existe al menos un `flow` con `action` o `result.traceable=true`.
- No renderizar ticket, pedido, lead, metricas ni codigo si backend no lo envia.
- Si `input.preview_url`, `thumbnail_url` o `image_url` existe y carga bien, mostrar imagen real.
- Si el input indica `image` o `file` pero no hay URL valida, mostrar solo el dato textual recibido. No mostrar placeholder visual ni imagen rota.
- Si hay `address`, `lat` o `lng`, mostrar resumen de ubicacion.
- Si hay `action.fields`, `metadata`, `summary_items`, `facts`, `details` o `attributes`, renderizarlos como resumen operativo.
- No mostrar `status` o `state` crudos si son valores de maquina. Para badges visibles usar `status_label`, `display_status`, `badge_label`, `state_label` o `badge`.
- Si no hay demo conversacional real, ocultar el mockup derecho y usar hero editorial simple.
- No mostrar PDF como accion principal del hero.

## Copy base del frontend

El copy comercial de landing vive en frontend para poder iterar UX/UI sin tocar backend. Si backend envia labels o CTAs operativos dentro de `conversation_demo`, se renderizan en el mockup o en la demo porque representan acciones reales del flujo. Backend no debe decidir estetica, jerarquia, animacion ni composicion visual.

Headline base:

```txt
Converti conversaciones en operaciones reales
```

Subheadline base:

```txt
Chatboc atiende por web o WhatsApp, pide los datos justos y deja casos, pedidos o leads listos para operar.
```

Titulo del mockup:

```txt
WhatsApp operativo
```

Subtitulo del mockup:

```txt
Un caso entra, el agente pide datos y deja una accion trazable.
```

CTAs:

```txt
Probar una conversacion real -> /demo
Hablar con ventas -> canal comercial directo definido por frontend
```

## UX objetivo

La primera pantalla debe sentirse como:

- Un telefono con una conversacion real.
- Un usuario que saluda, consulta, manda foto/audio/ubicacion o adjunto.
- Un agente que entiende, pide el dato justo y crea algo operativo.
- Un resultado visible: lead, ticket, pedido, caso, encuesta o evento.
- Un camino claro a probar demo y dejar datos comerciales.

## Anti-reglas

- No inventar metricas.
- No inventar tickets.
- No inventar productos.
- No inventar fotos de rubros.
- No usar logos grandes como reemplazo de demo.
- No mostrar botones que no correspondan al flujo conversacional.
- No mezclar portal usuario final dentro del admin.
- No depender de PDFs para vender la demo.
- No exponer terminos tecnicos visibles como contrato, backend, fallback, 404 o deploy.

## Checklist frontend

- Hero carga rapido con copy comercial local y luego usa datos operativos del backend.
- Hero consume `conversation_demo` cuando existe.
- Hero no muestra imagen rota ni placeholder.
- Hero no muestra resultado si no hay `action` o `result`.
- CTA principal abre `/demo`.
- Demo inicia con `POST /api/v2/demo/session`.
- Chat usa `workspace.chat_bootstrap`.
- Lead capture no postea vacio: pide nombre y WhatsApp/email antes.
- Mobile no tiene overflow horizontal.
- Dark mode mantiene contraste y jerarquia.

## Render QA 2026-05-14

### QA local frontend de esta tanda

- Landing publica carga sin imagenes rotas.
- Desktop y mobile no tienen overflow horizontal.
- No aparecen terminos tecnicos visibles en la landing publica.
- `Sectores -> Probar gobierno` navega a `/demo?sector=gobierno` y aterriza arriba de la pantalla nueva.
- `/demo?sector=gobierno` local carga sin 4xx/5xx en el bootstrap inicial.
- El hero ya prioriza una demo tipo telefono/conversacion y no un logo como pieza principal.

### Error critico en chat demo gobierno

Render muestra que `POST /ask/municipio` falla porque backend esta persistiendo el JWT completo de `demo_session_id` como `chat_session_id`.

La columna `chat_session_context.chat_session_id` es `VARCHAR(36)` y el JWT de demo supera ampliamente ese limite.

Log observado:

```txt
sqlalchemy.exc.DataError: value too long for type character varying(36)
INSERT INTO chat_session_context (chat_session_id, ...)
chat_session_id='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
POST /ask/municipio?tenant_slug=municipio&demo_session_id=<jwt> -> 500
```

Accion backend requerida:

- No usar `demo_session_id` JWT como `chat_session_context.chat_session_id`.
- Decodificar/validar `demo_session_id` y derivar un `chat_session_id` corto, estable y trazable.
- O usar `X-Chat-Session-Id` cuando frontend lo envie.
- Si no existe `X-Chat-Session-Id`, crear un UUID v4 o un hash corto <= 36 chars a partir del JWT.
- Guardar el JWT original solo en `context_data.demo_session_id` o en una columna preparada para tokens largos.
- Nunca devolver 500 por este caso; si el JWT es invalido/expirado, devolver JSON accionable con `request_id`.

Respuesta esperada:

```json
{
  "contract_version": "chat.runtime.v1",
  "request_id": "req_...",
  "session": {
    "chat_session_id": "uuid-or-short-id",
    "demo_session_id": "jwt..."
  },
  "message": {
    "role": "assistant",
    "content": "..."
  }
}
```

### Tenant `media` detectado desde PDFs

Render tambien muestra requests generados desde rutas `/media/demo_catalogs/...pdf` donde frontend/backend terminan resolviendo `tenant_slug=media`.

Ejemplos:

```txt
GET /api/public/widget-commerce-session?tenant_slug=media&tenant=media -> 404
GET /api/public/widget-user/tenant-history?tenant_slug=media&tenant=media -> 404
GET /api/public/tenants/media/widget-config -> 200 pesado
```

Accion backend requerida:

- Tratar `media` como slug reservado/publico, no como tenant real.
- Si el `Referer` o path viene de `/media/demo_catalogs/...`, no iniciar bootstrap de comercio/widget por tenant `media`.
- Para endpoints publicos tenant-aware, devolver JSON degradable con `reason_code=reserved_public_slug` o `tenant_resolution_failed`, `request_id` y CORS OK.
- No cargar widget-config completo para `tenant_slug=media`.

### Lead capture landing/demo

Render muestra:

```txt
GET/POST /api/public/lead-capture?tenant_slug=municipio&tenant=municipio -> 400
```

Accion backend requerida:

- Aceptar payload de landing/demo con `tenant_slug`, `sector`, `source`, `name`, `email`, `phone`, `message`, `demo_session_id`, `chat_session_id`, `anon_id`.
- Crear un lead real para seguimiento comercial/superadmin.
- Si faltan campos, responder 400 JSON con `contract_version`, `reason_code`, `required_fields`, `field_errors` y `request_id`.
- No responder HTML ni errores genericos.
