# Frontend to Backend Sync 2026-05-01

Fecha: 2026-05-01

Objetivo: bajar lo que el frontend ya implemento a pedidos concretos para backend, sin adivinar contratos. El frontend es white label: textos, botones, quick replies, acciones, estados comerciales y labels de handoff deben venir del backend.

## 1. Contratos que frontend ya consume

### 1.1 Demo catalog

Metodo + path:
- `GET /api/v2/demo/catalog`

Fallback actual:
- Si falla, frontend intenta recuperar rubros por el cliente legacy de rubros y usa sectores locales minimos.

Query params / headers usados:
- Sin query params.
- `skipAuth=true`, `omitCredentials=true`.
- No requiere tenant.

Shape esperado:
```json
{
  "sectors": ["gobierno", "empresas"],
  "rubros": []
}
```

Campos obligatorios:
- Ninguno estricto, pero `sectors` y `rubros` evitan fallback.

Campos opcionales tolerados:
- `sectors`: array de `"gobierno" | "empresas"`.
- `rubros`: array con el shape actual del selector de rubros.

Ejemplo JSON real:
```json
{
  "sectors": ["gobierno", "empresas"],
  "rubros": [
    {
      "slug": "educacion",
      "label": "Educacion",
      "children": [
        { "slug": "colegio", "label": "Colegio" }
      ]
    }
  ]
}
```

### 1.2 Demo session / workspace

Metodo + path:
- `POST /api/v2/demo/session`

Fallback actual:
- `POST /api/v1/demo/session` solo ante endpoint no disponible.

Query params / headers usados:
- Sin query params.
- `skipAuth=true`, `omitCredentials=true`.
- No requiere tenant.

Payload enviado:
```json
{
  "sector": "gobierno",
  "rubro": "educacion"
}
```

Shape esperado:
```json
{
  "demo_session_id": "demo_123",
  "tenant_slug": "demo-educacion",
  "workspace": {
    "title": "Demo educacion",
    "welcome_message": "Hola, soy el asistente.",
    "quick_replies": [],
    "value_cards": [],
    "handoff_labels": {}
  }
}
```

Campos obligatorios:
- `demo_session_id` o `session_id`.

Campos opcionales tolerados:
- `tenant_slug`.
- `workspace`.
- Compat legacy top-level: `welcome_message`, `quick_replies`, `value_cards`, `handoff_labels`.

Detalle de `workspace.quick_replies[]`:
```json
{
  "id": "tramites",
  "label": "Ver tramites",
  "payload": "tramites"
}
```

Detalle de `workspace.value_cards[]`:
```json
{
  "key": "tickets",
  "title": "Tickets",
  "description": "Seguimiento de casos",
  "status": "ready",
  "cta_label": "Abrir"
}
```

Detalle de `workspace.handoff_labels`:
```json
{
  "message": "Te conecta un operador.",
  "createTicket": "Crear ticket",
  "openWhatsApp": "Abrir WhatsApp",
  "waitOperator": "Esperar operador"
}
```

Ejemplo JSON real:
```json
{
  "contract_version": "demo.session.v2",
  "demo_session_id": "demo_edu_001",
  "tenant_slug": "demo-educacion",
  "workspace": {
    "title": "Mesa de ayuda escolar",
    "welcome_message": "Hola, puedo ayudarte con consultas escolares.",
    "quick_replies": [
      { "id": "inasistencias", "label": "Inasistencias", "payload": "inasistencias" },
      { "id": "becas", "label": "Becas", "payload": "becas" }
    ],
    "value_cards": [
      {
        "key": "familias",
        "title": "Familias",
        "description": "Consultas y seguimiento de casos.",
        "status": "ready",
        "cta_label": "Ver demo"
      }
    ],
    "handoff_labels": {
      "message": "Si hace falta, derivamos la conversacion.",
      "createTicket": "Crear caso",
      "openWhatsApp": "Continuar por WhatsApp",
      "waitOperator": "Esperar respuesta"
    }
  }
}
```

### 1.3 Widget config / quick_menu

Metodo + path:
- `GET /api/public/tenants/{slug}/widget-config`

Query params / headers usados:
- Sin query params.
- Path param: `slug`.
- Puede llegar con `X-Tenant` y `X-Tenant-Slug` inferidos por `apiFetch`.
- Debe funcionar sin auth de panel.

Shape esperado:
```json
{
  "contract_version": "public.widget_config.v1",
  "tenant": { "slug": "quilmes", "tipo": "municipio" },
  "widget": {},
  "builder_config": {},
  "suppress_global_widget": false,
  "integration_preview": false,
  "quick_menu": []
}
```

Campos obligatorios:
- `contract_version` recomendado: `public.widget_config.v1`.
- `tenant.slug`.
- `widget`.
- `builder_config`.
- `suppress_global_widget`.
- `integration_preview`.

Campos opcionales tolerados:
- `quick_menu`.
- `cta_messages`.
- `theme`, `theme_config`.
- `features`.
- `tipo_chat`, `type`, `tipo`, `es_publico`.
- `tenant_name`, `name`, `nombre`.
- `logo_url`, `avatar_url`.
- `default_open`.
- `widget_token`, `entity_token`.

Detalle de `quick_menu[]`:
```json
{
  "id": "reclamos",
  "label": "Reclamos",
  "intent": "reclamos",
  "institution_type": "public"
}
```

Ejemplo JSON real:
```json
{
  "contract_version": "public.widget_config.v1",
  "tenant": {
    "slug": "quilmes",
    "tipo": "municipio"
  },
  "widget": {
    "default_open": false
  },
  "builder_config": {
    "quick_menu": [
      { "id": "estado_reclamo", "label": "Estado de reclamo", "intent": "ticket_status" }
    ]
  },
  "suppress_global_widget": false,
  "integration_preview": false,
  "quick_menu": [
    { "id": "reclamos", "label": "Reclamos", "intent": "create_ticket" },
    { "id": "tramites", "label": "Tramites", "intent": "services" }
  ],
  "cta_messages": [{ "text": "Hola, quiero consultar" }],
  "theme_config": {
    "primaryColor": "#2563eb"
  }
}
```

### 1.4 Tickets v2

Metodo + path:
- `GET /api/v2/tickets`

Fallback actual:
- `GET /tickets` solo ante `404/405/501`.

Query params / headers usados:
- Sin query params por ahora.
- Si existe tenant en contexto: `X-Tenant-Slug: {tenantSlug}`.
- `apiFetch` tambien puede enviar `X-Tenant`, `Authorization`, `X-Chat-Session-Id`, `X-Contact-Key`, `X-Conversation-Id`.

Shape esperado:
```json
{
  "items": []
}
```

Shapes legacy tolerados:
```json
[]
```

```json
{
  "tickets": []
}
```

Campos obligatorios por item:
- `id` o `ticket_id` o `nro_ticket`.

Campos opcionales tolerados por item:
- `title`, `asunto`, `subject`, `descripcion`.
- `status`, `estado`.
- `priority`, `prioridad`.
- `sla_state`, `sla_status`.
- `channel`, `canal`, `canal_ingreso`.
- `category`, `categoria`.
- `assignee_name` o `assignee.name`.
- `updated_at`, `ultima_actualizacion`.

Ejemplo JSON real:
```json
{
  "contract_version": "tickets.v2.list",
  "request_id": "req_tickets_001",
  "items": [
    {
      "id": "TCK-1001",
      "title": "Consulta por beca",
      "status": "open",
      "priority": "high",
      "sla_state": "at_risk",
      "channel": "whatsapp",
      "category": "educacion",
      "assignee_name": "Mesa de entrada",
      "updated_at": "2026-05-01T12:30:00Z"
    }
  ]
}
```

### 1.5 Analytics v2 overview

Metodo + path:
- `GET /api/v2/analytics/overview`

Fallback actual:
- `GET /analytics/overview` solo ante `404/405/501`.

Query params / headers usados:
- Sin query params por ahora.
- Si existe tenant en contexto: `X-Tenant-Slug: {tenantSlug}`.
- Puede llegar con auth de panel.

Shape esperado:
```json
{
  "summary": {
    "conversations": 0,
    "open_tickets": 0,
    "overdue_tickets": 0,
    "response_time": 0,
    "survey_responses": 0,
    "nps": 0,
    "csat": 0,
    "handoff_rate": 0
  }
}
```

Shape top-level tolerado:
```json
{
  "conversations": 0,
  "open_tickets": 0
}
```

Campos obligatorios:
- Ninguno estricto. Si falta un campo, frontend muestra estado vacio/parcial.

Campos opcionales tolerados:
- Alias: `conversaciones`, `tickets_abiertos`, `tickets_vencidos`, `first_response_time`, `frt`, `respuestas_encuestas`.
- Numeros como string son tolerados, pero backend deberia estabilizar numeros JSON.

Ejemplo JSON real:
```json
{
  "contract_version": "analytics.overview.v2",
  "request_id": "req_analytics_001",
  "summary": {
    "conversations": 1280,
    "open_tickets": 42,
    "overdue_tickets": 3,
    "response_time": 4.2,
    "survey_responses": 320,
    "nps": 61,
    "csat": 87,
    "handoff_rate": 0.18
  }
}
```

### 1.6 Surveys v2 draft

Metodo + path:
- `POST /api/v2/surveys/draft`

Fallback actual:
- `POST /municipal/surveys` solo ante `404/405/501`.

Query params / headers usados:
- Sin query params.
- Puede llegar con tenant de panel: `X-Tenant-Slug`.
- Puede llegar con auth de panel.

Payload enviado:
```json
{
  "title": "Encuesta de satisfaccion",
  "description": "Borrador",
  "questions": [
    {
      "id": "question-1",
      "title": "Como calificas la atencion?",
      "type": "rating"
    }
  ]
}
```

Campos obligatorios:
- `title`: string. Como es draft, frontend puede mandar string vacio mientras el usuario edita.
- `questions`: array.
- `questions[].id`: string.
- `questions[].title`: string. Puede llegar vacio en draft.
- `questions[].type`: `"single" | "multi" | "rating" | "text" | "nps"`.

Campos opcionales tolerados:
- `description`.

Shape de respuesta esperado:
- El frontend solo necesita respuesta 2xx.
- Recomendado:
```json
{
  "ok": true,
  "contract_version": "surveys.draft.v2",
  "request_id": "req_survey_draft_001",
  "draft_id": "draft_123"
}
```

Ejemplo JSON real:
```json
{
  "ok": true,
  "contract_version": "surveys.draft.v2",
  "request_id": "req_survey_draft_001",
  "draft_id": "draft_123",
  "status": "draft"
}
```

### 1.7 PWA / tenant resolution

Metodo + path:
- `GET /api/pwa/public/tenant-info`

Fallback actual:
- `GET /api/pwa/tenant-info`
- `GET /pwa/tenant-info`
- Solo ante `404/405/501`.

Query params usados:
- `tenant`: slug explicito.
- `widget_token`: token normalizado cuando no hay slug o como contexto alternativo.

Headers usados:
- `skipAuth=true`, `omitCredentials=true`, `isWidgetRequest=true`.
- `X-Tenant` y `X-Tenant-Slug` si hay slug.
- `X-Anon-Id` puede enviarse.
- No debe requerir credenciales de panel.

Shape exitoso esperado:
```json
{
  "contract_version": "public.tenant_profile.v1",
  "tenant": {
    "slug": "quilmes",
    "nombre": "Municipio de Quilmes",
    "tipo": "municipio",
    "logo_url": null,
    "public_cart_url": null,
    "public_catalog_url": null
  }
}
```

Campos obligatorios:
- `tenant.slug` o `slug`.
- `tenant.nombre` o `nombre` recomendado.

Campos opcionales tolerados:
- `logo_url`, `logoUrl`, `logo`.
- `tema`.
- `tipo`.
- `descripcion`.
- `public_base_url`, `publicBaseUrl`, `public_url`, `publicUrl`.
- `public_cart_url`, `publicCartUrl`, `cart_url`, `cartUrl`.
- `public_catalog_url`, `publicCatalogUrl`, `catalog_url`, `catalogUrl`.
- `whatsapp_share_url`, `whatsappShareUrl`.
- `cta_messages`.
- `theme_config`.
- `default_open`.

Shape de error accionable esperado cuando no resuelve:
```json
{
  "contract_version": "pwa.public_tenant_resolution.v1",
  "status_code": 404,
  "reason_code": "tenant_resolution_failed",
  "retryable": false,
  "action_hint": "send tenant, tenant_slug, endpoint or X-Tenant-Slug",
  "request_id": "req_tenant_001",
  "hints": {
    "query_params": ["tenant", "tenant_slug", "endpoint", "widget_token"],
    "headers": ["X-Tenant-Slug", "X-Tenant", "X-Entity-Token"]
  }
}
```

Blocker importante:
- Si backend devuelve `pwa.public_tenant_resolution.v1`, frontend ya no deberia taparlo con fallback legacy. Ese error debe ser estable y accionable.

### 1.8 PWA / offline draft queue

El frontend encola acciones offline en `localStorage` y las sincroniza al recuperar conexion. Backend debe aceptar reintentos idempotentes.

#### Survey draft sync

Metodo + path:
- `POST /api/v2/surveys/draft`

Payload:
```json
{
  "title": "Borrador offline",
  "description": "",
  "questions": [
    { "id": "question-1", "title": "", "type": "single" }
  ]
}
```

Respuesta recomendada:
```json
{
  "ok": true,
  "contract_version": "surveys.draft.v2",
  "request_id": "req_offline_survey_001",
  "draft_id": "draft_123"
}
```

#### Survey response sync

Metodo + path:
- `POST /api/surveys/sync`

Payload:
- El payload depende de la respuesta publica encolada. Backend debe aceptar el mismo shape de respuesta publica o devolver error envelope validable.

Respuesta recomendada:
```json
{
  "ok": true,
  "contract_version": "surveys.sync.v1",
  "request_id": "req_survey_sync_001",
  "synced": 1
}
```

#### Ticket draft sync

Metodo + path:
- `POST /api/tickets/draft/sync`

Payload:
- Borrador de ticket encolado por frontend.

Respuesta recomendada:
```json
{
  "ok": true,
  "contract_version": "tickets.draft_sync.v1",
  "request_id": "req_ticket_sync_001",
  "ticket_id": "TCK-1001"
}
```

### 1.9 Error envelope

Aplicable a todos los endpoints anteriores.

Headers esperados:
- `X-Request-Id` en errores publicos y privados.
- `X-Correlation-Id` tolerado como alternativa.

Shape esperado:
```json
{
  "contract_version": "shared.error.v1",
  "status_code": 400,
  "reason_code": "validation_error",
  "retryable": false,
  "action_hint": "fix_payload",
  "request_id": "req_001",
  "error": {
    "message": "El payload es invalido."
  }
}
```

Campos obligatorios:
- `status_code`.
- `reason_code`.
- `request_id` o header `X-Request-Id`.

Campos opcionales tolerados:
- `error.message`.
- `message`.
- `detail`.
- `retryable`.
- `action_hint`.
- `contact_key`.
- `conversation_id`.

Regla de render frontend:
- Prioridad de mensaje: `error.message` -> `error` string -> `message` -> `detail` -> `action_hint` -> `reason_code`.
- `request_id` se muestra cuando existe.

Ejemplo JSON real:
```json
{
  "contract_version": "shared.error.v1",
  "status_code": 404,
  "reason_code": "survey_not_found",
  "retryable": false,
  "action_hint": "check_slug",
  "request_id": "req_public_survey_404",
  "error": {
    "message": "No encontramos la encuesta solicitada."
  }
}
```

## 2. Campos que backend deberia agregar o estabilizar

### 2.1 Demo session

Frontend espera poder leer:

```json
{
  "workspace": {
    "title": "...",
    "welcome_message": "...",
    "quick_replies": [],
    "value_cards": [],
    "handoff_labels": {}
  }
}
```

Pedidos concretos:
- Estabilizar `demo_session_id` como campo canonico. Mantener `session_id` solo como compat.
- Incluir `tenant_slug` cuando la demo pueda abrir rutas tenant-aware.
- Mover `welcome_message`, `quick_replies`, `value_cards` y `handoff_labels` dentro de `workspace`.
- No mandar quick replies genericos si no aplican; frontend no inventa botones.
- Todo texto visible debe venir en `label`, `title`, `description`, `welcome_message` o `handoff_labels`.

### 2.2 Widget config / quick_menu

Pedidos concretos:
- Mantener `contract_version: public.widget_config.v1`.
- Mandar `quick_menu` top-level como fuente principal.
- Si se usa `builder_config.quick_menu`, replicarlo o normalizarlo a `quick_menu`.
- Cada item debe tener `id`, `label`, `intent`.
- Evitar labels hardcodeados por frontend: si un tenant no tiene acciones, mandar `quick_menu: []`.
- Estabilizar `tipo_chat` como `"municipio" | "pyme"` para evitar inferencias por `tipo`, `type`, `es_publico` o rubro.

### 2.3 Tickets v2

Pedidos concretos:
- Preferir siempre `{ "items": [...] }`.
- Estabilizar `id`, `title`, `status`.
- Enviar `priority`, `sla_state`, `channel`, `category`, `assignee_name`, `updated_at` cuando existan.
- Evitar mezclar alias nuevos y legacy en la misma respuesta.
- Agregar `request_id` y `contract_version` para trazabilidad.

### 2.4 Analytics v2

Pedidos concretos:
- Preferir siempre `{ "summary": { ... } }`.
- Enviar numeros JSON, no strings.
- Estabilizar nombres canonicos:
  - `conversations`
  - `open_tickets`
  - `overdue_tickets`
  - `response_time`
  - `survey_responses`
  - `nps`
  - `csat`
  - `handoff_rate`
- Agregar `request_id` y `contract_version`.

### 2.5 Surveys v2

Pedidos concretos:
- `POST /api/v2/surveys/draft` debe aceptar drafts incompletos sin romper con 500.
- Si backend decide validar titulo/preguntas, devolver `shared.error.v1` con `reason_code`, `action_hint`, `request_id` y detalles de campo.
- Responder ack estable con `draft_id`.
- Mantener idempotencia para reintentos offline. Recomendado aceptar `idempotency_key` si se agrega en proxima ola.

### 2.6 PWA / offline

Pedidos concretos:
- `GET /api/pwa/public/tenant-info` debe ser la ruta publica canonica.
- Si tenant no resuelve, devolver `pwa.public_tenant_resolution.v1` sin HTML ni redirects.
- Incluir `hints.query_params` y `hints.headers` para que soporte pueda corregir embeds.
- Endpoints de sync offline deben aceptar reintentos.

### 2.7 Error envelope

Pedidos concretos:
- Todos los errores publicos deben exponer `X-Request-Id`.
- Todos los errores JSON deberian usar `shared.error.v1`.
- `error.message` debe ser humano y mostrable.
- `reason_code` debe ser estable para automatizacion.
- `retryable` debe indicar si frontend puede reintentar.
- `action_hint` debe ser corto y accionable.

## 3. Blockers backend reales

Lo siguiente ya quedo preparado en frontend, pero no puede completarse sin endpoints, contratos o datos estables del backend:

- Employee coverage: falta endpoint estable para cobertura por empleado/equipo/canal, con porcentajes, targets y alertas.
- Tenant health: falta resumen de salud por tenant con estado operativo, integraciones, colas, errores recientes y alertas.
- Executive summary superadmin: falta endpoint agregado para KPIs multi-tenant y resumen ejecutivo.
- Inbox omnicanal premium: falta contrato completo para lista + detalle + timeline + presencia + acciones de handoff.
- Pagos reales: falta estabilizar checkout con `payment_ready`, gateway, payment URL/preference y estados post-pago.
- Puntos/recompensas reales: falta contrato de puntos, canjes, saldo y reglas de recompensa.
- Quick menu educativo completo desde backend: falta `quick_menu` especifico por modulo educativo, institution type y permisos.
- Hooks de notifications: faltan endpoints/eventos para preferencias, plantillas, triggers y delivery status.
- Demo workspace estable: sin `workspace` en demo session, frontend cae en espacios vacios o placeholders.
- Error envelope publico: sin `X-Request-Id` y `reason_code`, soporte no puede depurar errores de encuestas, PWA o widget.

## 4. Payloads ejemplo

### 4.1 Demo session

Request:
```json
{
  "sector": "gobierno",
  "rubro": "educacion"
}
```

Response:
```json
{
  "contract_version": "demo.session.v2",
  "demo_session_id": "demo_edu_001",
  "tenant_slug": "demo-educacion",
  "workspace": {
    "title": "Mesa de ayuda escolar",
    "welcome_message": "Hola, puedo ayudarte con consultas escolares.",
    "quick_replies": [
      { "id": "inasistencias", "label": "Inasistencias", "payload": "inasistencias" },
      { "id": "becas", "label": "Becas", "payload": "becas" }
    ],
    "value_cards": [
      {
        "key": "familias",
        "title": "Familias",
        "description": "Consultas y seguimiento de casos.",
        "status": "ready",
        "cta_label": "Ver demo"
      }
    ],
    "handoff_labels": {
      "message": "Si hace falta, derivamos la conversacion.",
      "createTicket": "Crear caso",
      "openWhatsApp": "Continuar por WhatsApp",
      "waitOperator": "Esperar respuesta"
    }
  }
}
```

### 4.2 Ticket list

Response canonica:
```json
{
  "contract_version": "tickets.v2.list",
  "request_id": "req_tickets_001",
  "items": [
    {
      "id": 1,
      "title": "Consulta por beca",
      "status": "nuevo",
      "priority": "alta",
      "sla_status": "ok",
      "channel": "whatsapp",
      "category": "educacion",
      "assignee": {
        "id": 1,
        "name": "Mesa de entrada"
      },
      "updated_at": "2026-05-01T12:30:00Z"
    }
  ]
}
```

Frontend tolera tambien:
```json
{
  "tickets": []
}
```

```json
[]
```

### 4.3 Analytics overview

Response:
```json
{
  "contract_version": "analytics.overview.v2",
  "request_id": "req_analytics_001",
  "summary": {
    "conversations": 0,
    "open_tickets": 0,
    "overdue_tickets": 0,
    "response_time": 0,
    "survey_responses": 0,
    "nps": null,
    "csat": null,
    "handoff_rate": 0
  }
}
```

### 4.4 Public widget config

Response:
```json
{
  "contract_version": "public.widget_config.v1",
  "tenant": {
    "slug": "colegio-san-martin",
    "tipo": "pyme"
  },
  "tipo_chat": "pyme",
  "widget": {
    "default_open": false
  },
  "builder_config": {
    "quick_menu": [
      { "id": "familia", "label": "Familia", "intent": "education_family" }
    ]
  },
  "suppress_global_widget": false,
  "integration_preview": false,
  "quick_menu": [
    {
      "id": "educacion_familia",
      "label": "Portal familia",
      "intent": "education_family",
      "institution_type": "private"
    },
    {
      "id": "estado_caso",
      "label": "Estado de caso",
      "intent": "ticket_status",
      "institution_type": "private"
    }
  ],
  "cta_messages": [
    { "text": "Hola, quiero consultar" }
  ],
  "theme_config": {
    "primaryColor": "#2563eb"
  }
}
```

### 4.5 Survey error

Error publico normalizado:
```json
{
  "status_code": 403,
  "reason_code": "survey_not_published",
  "retryable": false,
  "action_hint": "view_other_surveys",
  "request_id": "req_survey_403"
}
```

Error envelope general:
```json
{
  "error": {
    "code": 400,
    "message": "Mensaje claro"
  },
  "request_id": "req_400"
}
```

### 4.6 Offline draft sync

Survey draft:
```json
{
  "title": "Borrador offline",
  "description": "",
  "questions": [
    {
      "id": "question-1",
      "title": "",
      "type": "single"
    }
  ]
}
```

Ack recomendado:
```json
{
  "ok": true,
  "contract_version": "surveys.draft.v2",
  "request_id": "req_offline_survey_001",
  "draft_id": "draft_123",
  "status": "draft"
}
```

Ticket draft sync ack:
```json
{
  "ok": true,
  "contract_version": "tickets.draft_sync.v1",
  "request_id": "req_ticket_sync_001",
  "ticket_id": "TCK-1001"
}
```

## 5. Orden recomendado para backend

### 5.1 Rompe UX actual

1. `POST /api/v2/demo/session`: devolver `workspace` completo.
2. `GET /api/public/tenants/{slug}/widget-config`: estabilizar `quick_menu` top-level.
3. Error envelope publico: `X-Request-Id`, `request_id`, `reason_code`, `action_hint`.
4. `GET /api/pwa/public/tenant-info`: devolver JSON accionable, nunca HTML/redirect.

### 5.2 Desbloquea pantallas ya implementadas

1. `GET /api/v2/tickets`: responder `{ items: [...] }` con campos estables.
2. `GET /api/v2/analytics/overview`: responder `{ summary: {...} }`.
3. `POST /api/v2/surveys/draft`: ack estable para builder y cola offline.
4. Quick menu educativo por backend para portal familia/staff/public.

### 5.3 Mejora datos / analytics

1. Employee coverage.
2. Tenant health.
3. Executive summary superadmin.
4. Hooks de notifications y delivery status.
5. Eventos de handoff e inbox omnicanal premium.

### 5.4 Nice-to-have

1. Pagos reales con gateway completo y estados post-pago.
2. Puntos/recompensas reales.
3. Idempotency key para sync offline.
4. Meta/paginacion estandar en tickets y analytics.

## 6. Tests frontend / mocks

Mocks/tests FE que ya quedaron esperando estos contratos:

- `src/api/client.stage4Contracts.test.ts`
  - Valida `auth.widget_bootstrap.v1`.
  - Valida `auth.widget_token.v1`.
  - Espera rutas canonicas `/auth/widget/token` y `/auth/widget/refresh`, con fallback legacy.

- `src/api/tenant.test.ts`
  - Espera `/api/pwa/public/tenant-info` como ruta primaria.
  - Espera que `pwa.public_tenant_resolution.v1` no sea tapado por fallback legacy.

- `src/api/market.test.ts`
  - Espera que carrito preserve `mercadopago_ready`.
  - Espera `checkout_options.payment_required`, `checkout_options.requires_contact_or_auth`, `checkout_options.gateway_hint`.
  - Espera `checkout_preview.payment_ready` y `checkout_preview.contact_ready`.

- `src/api/education.test.ts`
  - Espera rutas canonicas plurales `guardians/lookup` y `guardians/verify`.
  - Espera `/api/v1/education/me/family-context`.

- `tests/e2e/chatboc-smoke.spec.ts`
  - Mockea rutas API para smoke de demo, handoff, login invalido, tickets/surveys base y widget.

- `src/features/demo/demoApi.ts`
  - Normaliza `workspace` y compat top-level; backend deberia estabilizar `workspace`.

- `src/features/tickets/ticketsApi.ts`
  - Normaliza `items[]`, `tickets[]` o array legacy; backend deberia estabilizar `{ items: [...] }`.

- `src/features/analytics/analyticsApi.ts`
  - Normaliza top-level o `summary`; backend deberia estabilizar `{ summary: {...} }`.

- `src/features/surveys/surveysApi.ts`
  - Envia drafts a `/api/v2/surveys/draft`; backend debe aceptar drafts incompletos y responder ack.

Nota de entorno: en esta maquina no se pudieron correr tests reales porque faltan `npm`, `tsc`, `git` y `node_modules`; los archivos quedaron preparados para ejecutarse cuando el entorno tenga dependencias instaladas.
