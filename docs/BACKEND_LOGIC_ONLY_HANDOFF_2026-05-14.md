# Backend Logic-Only Handoff - 2026-05-14

## Objetivo

Separar responsabilidades para que Chatboc se sienta premium y mantenible:

- Backend hace logica, contratos, sesiones, datos reales, acciones trazables y errores controlados.
- Frontend hace experiencia visual, layout, jerarquia, animaciones, responsive, dark/light mode y presentacion.
- No mezclar UI comercial en backend ni logica de negocio en frontend.
- No usar mocks, placeholders, datos inventados ni fallbacks que oculten errores reales.

## Regla madre

Backend no decide como se ve la landing, el hero, el telefono, las burbujas, cards, colores, animaciones ni composicion visual.

Frontend no inventa resultados operativos: tickets, leads, pedidos, casos escolares, metricas, encuestas, mapas, empleados, categorias, productos ni acciones.

Si no existe dato real o trazable, backend no lo publica y frontend no lo muestra.

## Responsabilidad Backend

Backend debe ocuparse de:

- Resolver tenant, demo, rubro, sector y contexto.
- Crear y validar sesiones.
- Crear leads, tickets, pedidos, casos, respuestas de encuesta y eventos analiticos.
- Devolver contratos JSON estables.
- Devolver endpoints accionables.
- Devolver datos trazables para que frontend los renderice.
- Controlar permisos y capacidades.
- Responder errores JSON con `request_id`.
- Garantizar CORS OK en endpoints publicos.
- Evitar HTML en endpoints consumidos por frontend.

Backend no debe ocuparse de:

- Layout.
- Copy visual editorial si no forma parte del contrato de contenido.
- Animaciones.
- Estetica.
- Orden visual fino del hero.
- Placeholders visuales.
- Logica de responsive.
- Decidir si algo va como card, modal, tab, timeline o telefono.

## Responsabilidad Frontend

Frontend debe ocuparse de:

- Hero premium.
- Mockup tipo WhatsApp/mobile.
- Tabs visuales de rubro.
- Burbujas, adjuntos, estados, microinteracciones.
- Responsive mobile/desktop.
- Dark/light mode.
- Ocultar secciones sin datos.
- No mostrar imagen rota.
- No mostrar resultado si backend no lo manda.
- Pedir datos al usuario antes de enviar lead capture.

Frontend no debe:

- Inventar tickets.
- Inventar metricas.
- Inventar productos.
- Inventar empleados.
- Inventar categorias.
- Inventar municipios/colegios/pymes.
- Tratar slugs reservados como tenants.
- Mostrar portal de usuario final dentro del admin tenant.

## Contratos backend que deben quedar solidos

### 1. Landing experience

```txt
GET /api/public/landing-experience
```

Debe devolver datos logicos para que frontend arme una primera pantalla premium.

Backend entrega:

```json
{
  "contract_version": "public.landing_experience.v1",
  "request_id": "req_...",
  "experience_kind": "platform",
  "hero": {
    "conversation_demo": {
      "contract_version": "landing.hero_conversation_demo.v1",
      "flows": []
    }
  },
  "conversion": {
    "demo_session_endpoint": "/api/v2/demo/session",
    "lead_capture_endpoint": "/api/public/lead-capture",
    "admin_preview_endpoint": "/api/v2/demo/admin-preview"
  }
}
```

Cada flow debe ser logico y trazable:

```json
{
  "id": "gobierno-reclamo-ubicacion",
  "sector": "gobierno",
  "label": "Gobiernos",
  "user_message": "Te mando foto, audio y ubicacion de un semaforo caido.",
  "agent_message": "Recibi la evidencia, clasifique el reclamo y lo deje listo para seguimiento.",
  "inputs": [
    {
      "kind": "image",
      "label": "Foto",
      "preview_url": "https://..."
    },
    {
      "kind": "audio",
      "label": "Nota de voz",
      "transcript": "Semaforo caido en una esquina con transito."
    },
    {
      "kind": "location",
      "label": "Ubicacion",
      "address": "Av. San Martin y Rivadavia",
      "lat": -34.6083,
      "lng": -58.3712
    }
  ],
  "action": {
    "creates": "ticket",
    "label": "Reclamo creado",
    "status": "ready",
    "fields": [
      { "label": "Categoria", "value": "Semaforo" },
      { "label": "Prioridad", "value": "Alta" },
      { "label": "Equipo sugerido", "value": "Transito" }
    ]
  },
  "result": {
    "kind": "ticket",
    "traceable": true,
    "target": "inbox"
  }
}
```

Reglas:

- No mandar `flows` si son inventados.
- No mandar `preview_url` si la imagen no existe o no es publica.
- No mandar metricas sin fuente.
- No mandar PDF como accion principal.
- No mandar datos de bodega dentro de municipio ni datos de municipio dentro de pyme.

### 2. Demo session

```txt
POST /api/v2/demo/session
```

Debe crear una sesion real de demo para sector/rubro.

Debe devolver:

```json
{
  "contract_version": "demo.session.v1",
  "request_id": "req_...",
  "demo_session_id": "jwt-or-token",
  "chat_session_id": "uuid-v4-or-short-id",
  "tenant": {
    "slug": "municipio",
    "sector": "gobierno"
  },
  "workspace": {
    "chat_bootstrap": {}
  }
}
```

Regla critica:

- `demo_session_id` puede ser largo.
- `chat_session_id` debe ser corto, estable y apto para DB.
- No usar JWT como `chat_session_id`.

### 3. Ask/chat runtime

```txt
POST /ask/{tenant_slug}
```

Debe soportar:

- `tenant_slug`
- `demo_session_id`
- `chat_session_id`
- `anon_id`
- texto
- imagen
- audio
- ubicacion
- archivo

Debe crear o actualizar contexto sin romper:

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
  },
  "actions": []
}
```

Fix urgente Render:

Actualmente falla porque backend intenta insertar el JWT completo de `demo_session_id` en:

```txt
chat_session_context.chat_session_id VARCHAR(36)
```

Accion:

- Usar `X-Chat-Session-Id` o `chat_session_id` si viene.
- Si no viene, crear UUID v4.
- Guardar el JWT original en `context_data.demo_session_id`.
- Si el JWT es invalido o vencido, responder JSON, no 500.

### 4. Lead capture

```txt
POST /api/public/lead-capture
```

Debe crear un lead real para seguimiento comercial/superadmin.

Payload esperado:

```json
{
  "tenant_slug": "municipio",
  "sector": "gobierno",
  "source": "landing_demo",
  "name": "Marcelo",
  "email": "marcelo@example.com",
  "phone": "261...",
  "message": "Quiero probar reclamos con ubicacion.",
  "demo_session_id": "...",
  "chat_session_id": "...",
  "anon_id": "..."
}
```

Respuesta OK:

```json
{
  "contract_version": "public.lead_capture.v1",
  "ok": true,
  "request_id": "req_...",
  "lead": {
    "id": "lead_...",
    "status": "created"
  }
}
```

Respuesta de validacion:

```json
{
  "contract_version": "public.lead_capture.v1",
  "ok": false,
  "request_id": "req_...",
  "reason_code": "validation_failed",
  "required_fields": ["name", "phone"],
  "field_errors": {
    "phone": "required"
  }
}
```

Reglas:

- No devolver 400 generico.
- No devolver HTML.
- No perder el lead si viene desde demo publica.

### 5. Slugs reservados

Slugs reservados que no deben resolverse como tenant:

```txt
media
demo
demo-catalogs
public
assets
static
precios
sectores
casos
colegios
municipios
gobiernos
empresas
pymes
```

Si llega:

```txt
tenant_slug=media
```

Backend debe responder:

```json
{
  "contract_version": "public.reserved_slug.v1",
  "ok": false,
  "request_id": "req_...",
  "reason_code": "reserved_public_slug",
  "slug": "media"
}
```

No debe:

- Crear carrito para `media`.
- Pedir widget-commerce-session para `media`.
- Pedir tenant-history para `media`.
- Cargar widget-config pesado para `media`.

### 6. Admin preview

```txt
GET /api/v2/demo/admin-preview?sector=gobierno&tenant_slug=municipio
```

Debe devolver preview real para mostrar que la conversacion afecta el panel:

```json
{
  "contract_version": "demo.admin_preview.v1",
  "request_id": "req_...",
  "sector": "gobierno",
  "modules": [],
  "cards": [],
  "timeline": [],
  "metrics": [],
  "map": {
    "enabled": true,
    "points": []
  }
}
```

Reglas:

- No metricas inventadas.
- No mapa si no hay puntos.
- No modulo admin si backend no lo soporta.
- No HTML en error.

## Errores publicos

Todos los endpoints publicos deben responder JSON:

```json
{
  "contract_version": "shared.error.v1",
  "ok": false,
  "request_id": "req_...",
  "reason_code": "validation_failed|tenant_not_found|reserved_public_slug|demo_session_expired|internal_error",
  "message": "Mensaje apto para frontend."
}
```

Reglas:

- CORS OK.
- `OPTIONS` OK.
- No HTML.
- No stack trace visible.
- No 500 por input esperable.

## Tests backend requeridos

- `test_demo_session_returns_short_chat_session_id`
- `test_demo_session_jwt_not_used_as_chat_session_id`
- `test_ask_municipio_demo_session_creates_short_chat_context`
- `test_ask_invalid_demo_session_returns_json_error`
- `test_public_lead_capture_creates_lead_from_landing_demo`
- `test_public_lead_capture_validation_returns_field_errors`
- `test_media_reserved_slug_does_not_bootstrap_tenant_widget`
- `test_landing_experience_returns_traceable_conversation_demo`
- `test_demo_admin_preview_has_no_fake_metrics`

## Cierre operativo

Frontend puede avanzar en UX premium si backend entrega datos logicos y trazables.

Backend no tiene que decidir como vender visualmente. Tiene que garantizar que cuando frontend muestra:

- reclamo creado,
- pedido armado,
- lead capturado,
- caso escolar ordenado,
- encuesta respondida,
- ubicacion recibida,
- analitica generada,

eso tenga una accion real atras, un `request_id`, una sesion valida y un destino operativo.

