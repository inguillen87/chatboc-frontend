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

## Delta comercial pedido 2026-05-12

Objetivo: cada demo por rubro debe vender la diferencia de Chatboc como consultora + herramienta operativa, no como chatbot generico.

Backend deberia enriquecer `demo.session.v2`, `demo.catalog.v2` y `demo.admin_preview.v1` con contenido real por rubro:

- `sales_story`: problema, promesa, recorrido de valor y CTA comercial del rubro.
- `consulting_playbook`: diagnostico, procesos detectados, derivaciones, datos que se deben pedir y reglas de seguimiento.
- `wow_flows[]`: escenarios accionables que el usuario puede probar, por ejemplo reclamo con ubicacion, pedido con carrito, encuesta en vivo, inasistencia escolar, certificado, admision, comprobante o llamada.
- `live_modules[]`: encuestas, sondeos, votaciones, comentarios, reclamos, pedidos, mapa, analiticas, inbox y handoff humano.
- `openai_runtime`: prompt/perfil por vertical, tools disponibles, restricciones de seguridad y acciones que pueden crear lead/ticket/pedido.
- `lead_capture`: schema y endpoints para crear leads reales desde la demo.
- `survey_voting`: endpoints para crear/responder/ver resultados reales cuando el rubro lo tenga habilitado.
- `admin_preview_endpoint`: panel operativo del demo con datos reales generados por la sesion.

Reglas:

- El frontend no va a inventar metricas, resultados, comentarios, pedidos ni historias de exito.
- Si una capacidad no esta conectada, backend no debe publicarla como accion principal clickeable.
- Para demos publicadas, el recorrido debe crear algo trazable: lead, ticket, pedido, encuesta respondida o evento de analitica.
- La respuesta IA debe mostrar dominio del rubro y proponer el siguiente paso concreto, no una respuesta generica.
- El panel demo debe reflejar la actividad de la sesion: mensajes, acciones, lead/ticket/pedido, encuesta o comentario cuando corresponda.

Verticales minimas para la proxima tanda:

- Municipios/gobiernos: reclamo con foto/audio/ubicacion, estado por codigo, mapa operativo, encuestas/votaciones ciudadanas y comentarios.
- Empresas/pymes: catalogo, carrito invitado, pedido, checkout, comprobante, seguimiento, lead comercial y recuperacion de historial.
- Colegios: familias/staff, inasistencias, certificados, admisiones, pagos, comunicados, encuestas por comunidad y casos sensibles con derivacion humana.

## Delta SaaS operativo 2026-05-13

Objetivo: vender Chatboc como sistema SaaS completo, no como chatbot. El frontend ya evita mocks y no inventa resultados; para que la experiencia sea realmente increible, backend debe publicar capacidades reales solo cuando esten conectadas.

### 1. Catalogo IA a marketplace

Usar los endpoints existentes de importacion y calidad, pero enriquecer la respuesta de preview:

- `contract_version: catalog.import_preview.v1` o equivalente estable.
- `source_file`: nombre, tipo, paginas/filas, tamano y estado de lectura.
- `columns[]`: key, label, tipo, confidence, sample_values.
- `rows_sample[]`: celdas editables y warnings por fila.
- `image_summary`: imagenes detectadas, faltantes, columnas usadas y errores de descarga.
- `quality_summary`: productos listos, sin precio, sin stock, sin imagen, sin descripcion corta.
- `suggested_actions[]`: completar imagenes, revisar precios, publicar listos, corregir filas.
- `commit_endpoint`: endpoint real para confirmar importacion.

Reglas:

- Aceptar PDF, XLSX, XLS, CSV, TSV y TXT cuando el parser este disponible.
- No publicar productos hasta que el admin confirme.
- Si el archivo no puede leerse, responder JSON con `request_id`, motivo claro y accion recuperable.
- No devolver datos inventados para completar precio, stock o imagen.

### 2. Marketplace editable

Mantener `catalog.quality.v1` y `PATCH /api/admin/tenants/{slug}/catalog/items/{item_id}` con:

- imagen principal y galeria.
- descripcion corta.
- precio, stock y categoria.
- promocion.
- external_url y checkout_type.
- estado de publicacion/listo para vender.

El frontend muestra colas reales. Si una cola no existe o no tiene items, queda vacia sin maqueta.

### 3. Portal de usuario por tenant

Para widget y WhatsApp, sostener una identidad portable:

- `widget_session_token`.
- `anon_id`.
- `chat_session_id`.
- cuenta registrada cuando el usuario decide asociarse.

El portal debe poder listar, por tenant:

- pedidos y estados.
- reclamos/casos y seguimiento.
- mensajes relevantes.
- carrito activo.
- beneficios/recompensas si el tenant los tiene habilitados.
- encuestas/votaciones respondidas.

Contrato recomendado:

- `GET /api/public/widget-user/tenant-history`
- `GET /api/v2/tenants/{tenant_slug}/rewards/profile` cuando exista cuenta.
- `GET /api/v2/tenants/{tenant_slug}/payments/status` para pagos/pedidos.

### 4. Gamificacion y fidelizacion

Publicar reglas reales, no puntos inventados:

- reglas de puntos por compra, encuesta, comentario o participacion.
- beneficios disponibles.
- historial de movimientos.
- restricciones por tenant/segmento.
- endpoints de canje cuando aplique.

Si el tenant no tiene fidelizacion activa, no publicar el modulo como accion principal.

### 5. Analiticas, mapas y resumen IA

Las demos y el admin tenant deben mostrar solo datos reales generados por actividad:

- `operations.dashboard.v1`
- `operations.heatmap.v1`
- `operations.freshness.v1`
- `operations.action_center.v1`
- resumen IA con `request_id`, periodo, fuentes usadas y acciones recomendadas.

Reglas:

- No renderizar heatmap si `can_render_heatmap=false`.
- No publicar numeros de participacion, ventas o SLA si no hay fuente real.
- Cada demo publicada debe generar un evento trazable para que el panel pueda reflejar la accion.

### 6. Encuestas, sondeos y votaciones

Para diferenciar de un chatbot generico, cada demo deberia poder crear o responder una experiencia participativa real:

- encuesta simple.
- votacion en vivo.
- comentario abierto.
- resultados en tiempo real.
- export o resumen para el admin.

Frontend necesita que backend publique:

- `survey_voting.enabled`.
- `create_endpoint` o `respond_endpoint`.
- `results_endpoint`.
- `comments_endpoint` cuando aplique.
- `frontend_contract.render_as`.

Si el rubro no tiene esta capacidad lista, no mostrarla como promesa interactiva.
