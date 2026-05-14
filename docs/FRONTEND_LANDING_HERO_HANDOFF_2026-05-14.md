# Frontend Landing Hero Handoff - 2026-05-14

## Objetivo

La primera pantalla de Chatboc debe vender una experiencia premium tipo WhatsApp operativo, sin mezclar responsabilidades con backend.

El backend no define copy comercial, estetica, layout, animaciones, imagenes decorativas ni decision visual. El backend solo publica capacidades, endpoints y datos operativos trazables.

## Frontera de responsabilidad

### Frontend owns

- Headline, subheadline, CTAs y microcopy comercial.
- Layout del hero, mockup mobile, tabs, burbujas, animaciones y dark/light mode.
- Imagenes decorativas o placeholders visuales.
- Jerarquia visual, ritmo de lectura y performance del primer viewport.
- Fallback UX cuando el backend tarda o no publica una demo conversacional.
- Ocultar secciones si no hay datos operativos reales.

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
    "frontend_owns_copy_and_visual_design": true,
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
    "status": "Listo para operar",
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
- Si el input indica `image` o `file` pero no hay URL valida, mostrar placeholder visual de adjunto, no imagen rota.
- Si hay `address`, `lat` o `lng`, mostrar resumen de ubicacion.
- Si hay `action.fields`, `metadata`, `summary_items`, `facts`, `details` o `attributes`, renderizarlos como resumen operativo.
- Si no hay demo conversacional real, ocultar el mockup derecho y usar hero editorial simple.
- No mostrar PDF como accion principal del hero.

## Copy recomendado del frontend

El copy vive en frontend. Puede cambiar sin tocar backend.

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
Hablar con ventas -> /contacto
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

- Hero carga rapido con copy local aunque backend tarde.
- Hero consume `conversation_demo` cuando existe.
- Hero no muestra imagen rota.
- Hero no muestra resultado si no hay `action` o `result`.
- CTA principal abre `/demo`.
- Demo inicia con `POST /api/v2/demo/session`.
- Chat usa `workspace.chat_bootstrap`.
- Lead capture no postea vacio: pide nombre y WhatsApp/email antes.
- Mobile no tiene overflow horizontal.
- Dark mode mantiene contraste y jerarquia.

