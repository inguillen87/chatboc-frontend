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
- Fallback compatible: `GET /api/public/widget-config?tenant={slug}`

Query params / headers usados:
- `tenant` cuando se usa `/api/public/widget-config`.
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

### 1.3b Widget experience contracts

Frontend ya consume estos campos top-level, dentro de `builder_config` o dentro de `experience_blueprint`:

- `lead_capture`
- `media_capabilities`
- `conversion_ctas`
- `animation_tokens`
- `empty_states`
- `first_visit`
- `sample_conversations`
- `trust_signals`

Endpoint usado para lead capture:
- `POST /api/public/lead-capture`

Headers usados:
- `X-Chat-Session-Id` via `apiFetch`.
- `X-Tenant-Slug` y `X-Tenant` cuando hay tenant.
- `X-Anon-Id` cuando existe visitante anonimo.

Shape esperado `media_capabilities`:
```json
{
  "version": "media.capabilities.v1",
  "composer": {
    "placeholder": "Escribi, habla o adjunta algo para que el agente te ayude.",
    "actions": [
      { "id": "attach_image", "type": "image", "icon": "image", "label": "Imagen" },
      { "id": "record_audio", "type": "audio", "icon": "mic", "label": "Audio" },
      { "id": "share_location", "type": "location", "icon": "map-pin", "label": "Ubicacion" },
      { "id": "attach_file", "type": "file", "icon": "paperclip", "label": "Archivo" }
    ]
  },
  "input_modes": {
    "text": { "enabled": true, "chat_endpoint": "/ask", "payload_key": "pregunta" },
    "image": {
      "enabled": true,
      "upload_endpoint": "/archivos/upload/chat_attachment",
      "upload_response_key": "attachmentInfo",
      "chat_payload_key": "attachmentInfo"
    },
    "audio": {
      "enabled": true,
      "chat_endpoint": "/ask",
      "multipart_field": "audio_file",
      "max_seconds": 120
    },
    "location": {
      "enabled": true,
      "chat_endpoint": "/ask",
      "payload_key": "location"
    },
    "file": {
      "enabled": true,
      "upload_endpoint": "/archivos/upload/chat_attachment",
      "upload_response_key": "attachmentInfo",
      "chat_payload_key": "attachmentInfo"
    }
  }
}
```

Shape esperado `lead_capture`:
```json
{
  "enabled": true,
  "title": "Recibir propuesta o continuar compra",
  "fields": [],
  "trigger_intents": ["crear_pedido", "derivar_humano", "checkout_intent"],
  "endpoint": "/api/public/lead-capture",
  "success_message": "Listo, dejamos tu consulta preparada para seguimiento."
}
```

Shape esperado `conversion_ctas`:
```json
{
  "version": "conversion.ctas.v1",
  "actions": [
    {
      "id": "create_order",
      "label": "Crear pedido",
      "intent": "crear_pedido",
      "endpoint": "/ask",
      "style": "primary"
    }
  ],
  "rules": {
    "max_visible": 3,
    "prefer_backend_labels": true,
    "fallback_behavior": "hide_missing_actions",
    "preserve_context_on_click": true
  }
}
```

Reglas frontend:
- No muestra botones multimedia si `input_modes[type].enabled === false`.
- Imagen/archivo: sube a `upload_endpoint`, lee `upload_response_key`, luego manda `/ask` con `attachmentInfo`.
- Audio: manda multipart a `/ask` con `multipart_field` o `audio_file`.
- Ubicacion: manda `/ask` con `location`.
- CTAs: renderiza maximo `rules.max_visible`; labels e intents vienen de backend.
- Empty state: usa `experience_blueprint.first_visit` o `empty_states.*` cuando existan.
- Trust signals: renderiza `trust_signals[]` como fila compacta usando `label` y `detail`.
- Agent copilot: si inbox envia `experience_blueprint.agent_copilot.suggestions[]`, frontend los muestra como botones para completar el draft del operador.

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

### 1.10 Payments P2

Metodos + paths:
- `GET /api/v2/payments/checkout-status`
- `GET /api/v2/payments/capabilities`
- `POST /api/v2/payments/checkout-preview`
- `POST /api/v2/payments/checkout-session`
- `POST /api/v2/payments/preference`
- `GET|POST /api/v2/payments/status`

Fallback actual:
- `POST /api/v2/payments/checkout-session` -> `POST /api/v2/payments/preference` -> `POST /api/market/{tenant}/checkout/start` solo ante `404/405/501`.

Query params / headers usados:
- `X-Tenant-Slug`, `X-Tenant`, `X-Anon-Id`.
- `Authorization` si hay sesion.
- `tenant` y `tenant_slug` pueden viajar como query por compat de `apiFetch`.

Payload checkout-preview / checkout-session:
```json
{
  "items": [
    { "id": "prod_1", "quantity": 2 }
  ],
  "customer": {
    "name": "Cliente",
    "phone": "+5491112345678"
  }
}
```

Shape esperado checkout-preview:
```json
{
  "contract_version": "payments.checkout_preview.v1",
  "total_monetary": 12000,
  "total_points": 0,
  "payment_required": true,
  "payment_ready": true,
  "contact_ready": true,
  "checkout_options": {
    "gateway": "mercadopago",
    "gateway_hint": "Mercado Pago"
  },
  "next_steps": []
}
```

Shape esperado checkout-session:
```json
{
  "contract_version": "payments.checkout_session.v1",
  "preference_id": "123",
  "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=123",
  "external_reference": "order_123",
  "checkout_options": {
    "payment_required": true,
    "gateway": "mercadopago"
  },
  "request_id": "req_pay_001"
}
```

Campos obligatorios:
- Checkout session: `preference_id` o `init_point`.
- Preview: `payment_required`, `payment_ready`, `contact_ready`.

Campos opcionales tolerados:
- `gateway`, `gateway_hint`, `missing`, `capabilities`, `checkout_urls`, `order`, `timeline`, `payment.status`, `payment.paid`.

### 1.10b API v2 foundation

Frontend ya tiene clientes listos para estos endpoints sin abrir aliases legacy nuevos:

- `GET /api/v2/health`
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/refresh`
- `POST /api/v2/auth/logout`
- `GET /api/v2/auth/me`
- `GET /api/v2/tenants/current`
- `GET|POST /api/v2/sla/policies`
- `GET /api/v2/sla/breaches`
- `POST /api/v2/tickets`
- `PATCH /api/v2/tickets/{ticket_id}`
- `POST /api/v2/tickets/{ticket_id}/comments`
- `GET /api/v2/tickets/{ticket_id}/events`
- `GET|POST /api/v2/surveys`
- `GET|PATCH /api/v2/surveys/{survey_id}`
- `POST /api/v2/surveys/{survey_id}/publish`
- `POST /api/v2/surveys/{survey_id}/close`
- `GET /api/v2/surveys/{survey_id}/analytics`
- `GET /api/v2/public/surveys/{public_token}`
- `POST /api/v2/public/surveys/{public_token}/respond`

Notas frontend:
- `GET /api/v2/tenants/current` no tiene fallback al primer tenant.
- Demo preserva `chat_bootstrap.endpoint`, `fallback_endpoint`, `headers`, `query`, `payload` y `supports`; puede leerlo top-level, en `workspace` o en `chat_seed`.
- La pagina demo usa `chat_bootstrap` para el saludo inicial y mensajes si llega del backend; solo calcula `/ask/*` como fallback de compatibilidad.
- Tickets comments soportan `visibility` para `public`, `internal` o `private`.
- Surveys v2 acepta `single`, `multi`, `rating`, `text`, `nps`, `ranking` y `location`.

### 1.11 Rewards P2

Metodos + paths:
- `GET /api/v2/rewards/profile`
- `POST /api/v2/rewards/redeem`

Headers usados:
- `X-Tenant-Slug`, `X-Tenant`, `X-Anon-Id`.
- `Authorization` si hay sesion.
- `Idempotency-Key` en redeem.

Shape esperado profile:
```json
{
  "contract_version": "rewards.profile.v1",
  "wallet": {
    "balance": 1250,
    "pending_cart_points": 80
  },
  "rules": [],
  "available_redemptions": [
    {
      "reward_id": "reward_10",
      "label": "Beneficio backend",
      "description": "Texto visible desde backend",
      "cost_points": 500
    }
  ],
  "history": [],
  "summary": {},
  "request_id": "req_rewards_001"
}
```

Payload redeem:
```json
{
  "reward_id": "reward_10"
}
```

Shape esperado redeem:
```json
{
  "contract_version": "rewards.redeem.v1",
  "redemption_id": "red_123",
  "reward_id": "reward_10",
  "balance": 750,
  "duplicate": false,
  "request_id": "req_redeem_001"
}
```

Campos obligatorios:
- Profile: `wallet.balance`, `available_redemptions`.
- Redeem: `redemption_id`, `reward_id`, `balance`.

Campos opcionales tolerados:
- `wallet.pending_cart_points`, `rules`, `history`, `summary`, `duplicate`.

### 1.12 Inbox omnicanal actions P2

Metodo + path:
- `POST /api/v2/inbox/omnichannel/{ticket_id}/actions`

Headers usados:
- `Authorization`.
- `X-Tenant-Slug` o `X-Tenant`.

Payload:
```json
{
  "action": "reply",
  "payload": {
    "message": "Respuesta del agente"
  }
}
```

Acciones que frontend envia:
- `assign`
- `reply`
- `handoff`
- `close`
- `reopen`
- `set_priority`
- Cualquier `action.type` o `action.id` que venga en `inbox.omnichannel.v1`.

Shape esperado:
```json
{
  "contract_version": "inbox.omnichannel.action.v1",
  "ticket": {
    "id": "TCK-1001",
    "title": "Consulta",
    "status": "open",
    "timeline": []
  },
  "request_id": "req_inbox_action_001"
}
```

Campos obligatorios:
- `ticket.id` o `id`.
- `ticket.status` recomendado.
- `ticket.timeline` recomendado para refrescar la conversacion.

Campos opcionales tolerados:
- `ticket.actions`, `ticket.presence`, `ticket.summary`, `ticket.next_steps`, `ticket.suggested_reply`.

### 1.13 Operational analytics P4

Metodos + paths:
- `GET /api/v2/analytics/operations/dashboard`
- `GET /api/v2/analytics/operations/heatmap`
- `GET /api/v2/analytics/operations/action-center`
- `GET /api/v2/analytics/operations/freshness`

Headers usados:
- `Authorization` cuando hay sesion de panel.
- `X-Tenant-Slug` y `X-Tenant` cuando hay tenant en contexto.

Shape esperado dashboard:
```json
{
  "contract_version": "operations.dashboard.v1",
  "summary": {},
  "trends": { "items": [] },
  "tickets": {
    "summary": {},
    "by_status": [],
    "by_channel": [],
    "by_category": [],
    "by_priority": []
  },
  "surveys": {
    "summary": {
      "votaciones_live": 0,
      "responses": 0
    },
    "items": [],
    "live_items": []
  },
  "chats": {
    "summary": {
      "whatsapp_messages": 0
    },
    "by_channel": []
  },
  "live_chat": {
    "active_viewers": 0,
    "items": []
  },
  "employees": {
    "summary": {
      "coverage_rate": 0
    },
    "items": [],
    "coverage": {
      "uncovered_categories": [],
      "uncovered_channels": []
    }
  },
  "maps": {
    "heatmap": {
      "hotspots": []
    }
  },
  "alerts": [],
  "next_best_actions": [],
  "frontend_contract": {
    "primary_refresh_seconds": 30
  },
  "request_id": "req_operations_001"
}
```

Shape esperado heatmap:
```json
{
  "contract_version": "operations.heatmap.v1",
  "render_contract": {
    "state": "ready",
    "map_engine": "maplibre",
    "layers": ["tickets", "surveys", "analytics_events"],
    "point_format": { "lat": "number", "lng": "number", "weight": "number" }
  },
  "summary": {
    "points": 0,
    "cells": 0,
    "ticket_points": 0,
    "survey_points": 0,
    "event_points": 0
  },
  "bounds": {},
  "points": [],
  "cells": [],
  "hotspots": [],
  "request_id": "req_heatmap_001"
}
```

Shape esperado action center:
```json
{
  "contract_version": "operations.action_center.v1",
  "summary": {
    "total": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "alerts": 0
  },
  "items": [
    {
      "id": "review_overdue_tickets",
      "title": "Revisar tickets vencidos",
      "description": "Priorizar reclamos y tickets con SLA vencido antes de que escalen.",
      "priority": "high",
      "reason_code": "tickets_overdue",
      "endpoint": "/api/v2/tickets?status=overdue",
      "method": "GET",
      "payload_template": {},
      "ui_hint": "open_view"
    }
  ],
  "alerts": [],
  "trends": {},
  "frontend_contract": {
    "render_as": "action_center",
    "primary_refresh_seconds": 30,
    "empty_state_behavior": "show_monitoring_ok"
  },
  "request_id": "req_action_center_001"
}
```

Reglas frontend:
- Si `render_contract.state` es `empty`, se muestra estado vacio accionable y no se fuerza el mapa.
- Las capas visibles salen de `render_contract.layers`.
- `next_best_actions` y `action-center.items` se muestran, pero frontend no ejecuta cambios automaticos.
- No se hardcodean nombres de categorias, canales, estados ni prioridades de negocio; se renderizan labels/titles/ids recibidos.
- `operations.freshness.v1` se muestra como banner/chips de estado.
- Si `freshness.summary.can_render_heatmap === false`, frontend no intenta renderizar el mapa.

Shape esperado freshness:
```json
{
  "contract_version": "operations.freshness.v1",
  "tenant": {},
  "period": {},
  "status": "fresh",
  "reason_code": "all_sources_fresh",
  "summary": {
    "sources": 5,
    "fresh_sources": 5,
    "stale_sources": 0,
    "empty_sources": 0,
    "latest_at": "2026-05-01T21:00:00Z",
    "employee_count": 4,
    "has_operational_data": true,
    "can_render_dashboard": true,
    "can_render_heatmap": true
  },
  "sources": [
    {
      "key": "tickets",
      "label": "Tickets y reclamos",
      "status": "fresh",
      "reason_code": "source_fresh",
      "period_count": 12,
      "latest_at": "2026-05-01T21:00:00Z",
      "age_seconds": 300,
      "stale_after_seconds": 21600,
      "recommended_action": {
        "endpoint": "/api/v2/tickets",
        "ui_hint": "open_ticket_board"
      }
    }
  ],
  "frontend_contract": {
    "render_as": "analytics_freshness",
    "primary_refresh_seconds": 60,
    "empty_state_behavior": "show_reason_code",
    "degraded_state_behavior": "show_stale_sources"
  },
  "request_id": "req_freshness_001"
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

### 2.2b Widget experience

Pedidos concretos:
- Exponer `media_capabilities` como fuente canonica del composer.
- Si un modo esta deshabilitado, enviar `input_modes[type].enabled=false`; frontend oculta el boton.
- Para audio, estabilizar `chat_endpoint` y `multipart_field`.
- Para imagen/archivo, estabilizar `upload_endpoint`, `upload_response_key` y `chat_payload_key`.
- Exponer `lead_capture.endpoint`, `fields`, `trigger_intents` y `success_message`.
- Exponer `conversion_ctas.actions[]` con `id`, `label`, `intent`, `endpoint` y `style`.
- Exponer `experience_blueprint.first_visit`, `sample_conversations`, `trust_signals` y `empty_states` para evitar copy local.

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

### 2.8 Operational analytics

Pedidos concretos:
- Estabilizar `contract_version` para los endpoints operacionales.
- En `operations.dashboard.v1`, preferir arrays de objetos con `label` y `value/count/total` para breakdowns.
- Enviar `summary.open_tickets`, `summary.overdue_tickets`, `summary.survey_responses`, `surveys.summary.votaciones_live`, `chats.summary.whatsapp_messages`, `employees.summary.coverage_rate` y `maps.heatmap.hotspots` cuando existan.
- En `operations.heatmap.v1`, incluir `render_contract.state`, `render_contract.layers` y puntos con `lat`, `lng`, `weight` y, si aplica, `layer` o `source`.
- En `operations.action_center.v1`, cada item debe traer `title`, `description`, `priority`, `reason_code`, `endpoint`, `method`, `payload_template` y `ui_hint`.
- En `operations.freshness.v1`, estabilizar `status`, `reason_code`, `summary.can_render_dashboard`, `summary.can_render_heatmap` y `sources[]`.
- Si backend quiere que frontend navegue a una pantalla concreta, agregar `frontend_contract` o un campo declarativo de UI; hoy frontend muestra la accion y no ejecuta mutaciones automaticas.

## 3. Blockers backend reales

Lo siguiente ya quedo preparado en frontend, pero no puede completarse sin endpoints, contratos o datos estables del backend:

- Employee coverage: resuelto en P1 con `employee.coverage.v1`; frontend consume `/api/v2/tenants/{slug}/employee-coverage` y `/api/v2/employee-coverage`.
- Tenant health: resuelto en P1 con `tenant.health.v1`; frontend consume `/api/v2/tenants/{slug}/health` y `/api/v2/tenant-health`.
- Executive summary superadmin: resuelto en P1 con `superadmin.executive_summary.v1`; frontend consume `/api/v2/superadmin/executive-summary` con fallback `/api/v2/super-admin/executive-summary`.
- Inbox omnicanal base: resuelto en P1 con `inbox.omnichannel.v1`; frontend consume `/api/v2/inbox/omnichannel` desde el inbox tenant-aware existente (`/t/:tenant/inbox`).
- Inbox omnicanal actions: resuelto en P2 con `inbox.omnichannel.action.v1`; frontend postea actions y replies desde el panel de conversacion actual.
- Hooks de notifications: resuelto en P1 con `notifications.hooks.v1` y `notifications.delivery_status.v1`; frontend conserva las pantallas actuales y pasa por `apiClient.adminGetNotificationSettings`/`adminUpdateNotificationSettings` con fallback legacy.
- Pagos reales base: resuelto en P2 con checkout status/capabilities/preview/session/status; pendiente UX premium post-pago con polling y timeline completo.
- Puntos/recompensas reales base: resuelto en P2 con profile/redeem e idempotencia; pendiente catalogo visual completo de beneficios e historial avanzado.
- Quick menu educativo completo desde backend: falta `quick_menu` especifico por modulo educativo, institution type y permisos.
- Composer multimedia completo: frontend ya respeta `media_capabilities`, pero backend debe devolverlo por tenant/demo para no depender de capacidades legacy.
- Lead capture comercial: frontend ya puede postear `POST /api/public/lead-capture`, pero backend debe estabilizar campos dinamicos y respuesta con `request_id`.
- Conversion CTAs: frontend ya renderiza `conversion_ctas`, pero backend debe enviar acciones por contexto/intent sin labels locales.
- Operational analytics actions: frontend muestra `ActionCenter`, pero para ejecutar/navegar de forma segura falta que backend estabilice hints de UI o rutas frontend declarativas.
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

### 4.4b Widget experience config

Response parcial:
```json
{
  "contract_version": "public.widget_config.v1",
  "tenant": {
    "slug": "colegio-san-martin",
    "tipo": "pyme"
  },
  "experience_blueprint": {
    "first_visit": {
      "title": "Bienvenido",
      "description": "Texto visible desde backend."
    },
    "sample_conversations": [
      {
        "id": "estado",
        "label": "Consultar estado",
        "text": "Quiero consultar el estado",
        "intent": "consulta_estado"
      }
    ],
    "trust_signals": [
      {
        "id": "seguimiento",
        "title": "Seguimiento",
        "description": "Descripcion visible desde backend."
      }
    ],
    "empty_states": {
      "no_messages": {
        "title": "Primer contacto",
        "description": "Texto de estado vacio desde backend."
      }
    }
  },
  "lead_capture": {
    "enabled": true,
    "title": "Recibir propuesta o continuar compra",
    "fields": [],
    "trigger_intents": ["crear_pedido", "derivar_humano", "checkout_intent"],
    "endpoint": "/api/public/lead-capture",
    "success_message": "Listo, dejamos tu consulta preparada para seguimiento."
  },
  "media_capabilities": {
    "version": "media.capabilities.v1",
    "composer": {
      "placeholder": "Escribi, habla o adjunta algo para que el agente te ayude.",
      "actions": [
        { "id": "record_audio", "type": "audio", "icon": "mic", "label": "Audio" }
      ]
    },
    "input_modes": {
      "audio": {
        "enabled": true,
        "chat_endpoint": "/ask",
        "multipart_field": "audio_file",
        "max_seconds": 120
      }
    }
  },
  "conversion_ctas": {
    "version": "conversion.ctas.v1",
    "actions": [
      {
        "id": "capture_lead",
        "label": "Recibir propuesta",
        "intent": "lead_capture",
        "endpoint": "/api/public/lead-capture",
        "style": "accent"
      }
    ],
    "rules": {
      "max_visible": 3,
      "prefer_backend_labels": true,
      "fallback_behavior": "hide_missing_actions",
      "preserve_context_on_click": true
    }
  }
}
```

Lead capture request:
```json
{
  "tenant_slug": "colegio-san-martin",
  "tipo_chat": "pyme",
  "conversation_id": "conv_123",
  "fields": {
    "telefono": "+5491112345678"
  },
  "intent": "checkout_intent",
  "message": "Quiero continuar la compra"
}
```

Respuesta recomendada:
```json
{
  "ok": true,
  "request_id": "req_lead_001",
  "lead_id": "lead_123"
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

### 4.7 Operations dashboard

Response:
```json
{
  "contract_version": "operations.dashboard.v1",
  "summary": {
    "open_tickets": 42,
    "overdue_tickets": 3,
    "survey_responses": 320,
    "whatsapp_messages": 210,
    "employees": 12,
    "map_points": 85,
    "alerts": 2
  },
  "trends": {
    "items": [
      { "key": "open_tickets", "label": "Tickets abiertos", "current": 42, "previous": 38, "direction": "up", "percent_change": 10.5 }
    ]
  },
  "tickets": {
    "by_status": [
      { "key": "nuevo", "label": "Nuevo", "count": 18 }
    ],
    "by_channel": [
      { "key": "whatsapp", "label": "WhatsApp", "count": 24 }
    ]
  },
  "alerts": [
    { "id": "sla", "title": "SLA en riesgo", "severity": "high", "reason_code": "tickets_overdue" }
  ],
  "next_best_actions": [
    {
      "id": "assign_unassigned_tickets",
      "title": "Asignar tickets sin responsable",
      "description": "Hay tickets que necesitan operador.",
      "priority": "high",
      "endpoint": "/api/v2/tickets?assignee=none",
      "method": "GET",
      "payload_template": {},
      "ui_hint": "open_view"
    }
  ],
  "request_id": "req_operations_001"
}
```

### 4.8 Operations heatmap

Response:
```json
{
  "contract_version": "operations.heatmap.v1",
  "render_contract": {
    "state": "ready",
    "map_engine": "maplibre",
    "layers": ["tickets", "surveys", "analytics_events"]
  },
  "summary": {
    "points": 2,
    "cells": 1,
    "ticket_points": 1,
    "survey_points": 1,
    "event_points": 0
  },
  "points": [
    { "id": "ticket_1", "lat": -34.7, "lng": -58.3, "weight": 2, "layer": "tickets", "label": "Zona norte" },
    { "id": "survey_1", "lat": -34.71, "lng": -58.31, "weight": 1, "layer": "surveys", "label": "Votacion" }
  ],
  "cells": [],
  "hotspots": [
    { "id": "hotspot_1", "label": "Zona norte", "count": 2, "priority": "high" }
  ],
  "request_id": "req_heatmap_001"
}
```

### 4.9 Operations freshness

Response:
```json
{
  "contract_version": "operations.freshness.v1",
  "status": "degraded",
  "reason_code": "one_or_more_sources_stale",
  "summary": {
    "sources": 5,
    "fresh_sources": 3,
    "stale_sources": 1,
    "empty_sources": 1,
    "latest_at": "2026-05-01T21:00:00Z",
    "employee_count": 4,
    "has_operational_data": true,
    "can_render_dashboard": true,
    "can_render_heatmap": false
  },
  "sources": [
    {
      "key": "heatmap",
      "label": "Mapa operativo",
      "status": "empty",
      "reason_code": "no_points_in_period",
      "period_count": 0,
      "recommended_action": {
        "endpoint": "/api/v2/analytics/operations/action-center",
        "ui_hint": "open_action_center"
      }
    }
  ],
  "frontend_contract": {
    "render_as": "analytics_freshness",
    "primary_refresh_seconds": 60,
    "empty_state_behavior": "show_reason_code",
    "degraded_state_behavior": "show_stale_sources"
  },
  "request_id": "req_freshness_001"
}
```

## 5. Orden recomendado para backend

### 5.1 Rompe UX actual

1. `POST /api/v2/demo/session`: devolver `workspace` completo.
2. `GET /api/public/tenants/{slug}/widget-config`: estabilizar `quick_menu` top-level.
3. `media_capabilities`: devolver modos reales para no mostrar botones que backend no soporta.
4. Error envelope publico: `X-Request-Id`, `request_id`, `reason_code`, `action_hint`.
5. `GET /api/pwa/public/tenant-info`: devolver JSON accionable, nunca HTML/redirect.

### 5.2 Desbloquea pantallas ya implementadas

1. `GET /api/v2/tickets`: responder `{ items: [...] }` con campos estables.
2. `GET /api/v2/analytics/overview`: responder `{ summary: {...} }`.
3. `POST /api/v2/surveys/draft`: ack estable para builder y cola offline.
4. `POST /api/public/lead-capture`: estabilizar respuesta y campos dinamicos.
5. `conversion_ctas`: enviar acciones contextuales por intent.
6. Quick menu educativo por backend para portal familia/staff/public.

### 5.3 Mejora datos / analytics

1. Employee coverage.
2. Tenant health.
3. Executive summary superadmin.
4. Hooks de notifications y delivery status.
5. Eventos de handoff e inbox omnicanal premium.
6. Operational analytics: dashboard, heatmap y action center con refresh sugerido.

### 5.4 Nice-to-have

1. Post-pago premium con polling controlado de `payments.status.v1` y timeline visible.
2. Rewards premium con catalogo visual, historial paginado y reglas explicables desde backend.
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
  - Espera checkout P2 primario en `/api/v2/payments/checkout-session` y fallback a `/api/v2/payments/preference`.
  - Espera rewards profile/redeem con wallet, redenciones e `Idempotency-Key`.

- `src/api/education.test.ts`
  - Espera rutas canonicas plurales `guardians/lookup` y `guardians/verify`.
  - Espera `/api/v1/education/me/family-context`.

- `tests/e2e/chatboc-smoke.spec.ts`
  - Mockea rutas API para smoke de demo, handoff, login invalido, tickets/surveys base y widget.

- `src/features/demo/demoApi.ts`
  - Normaliza `workspace`, `experience_blueprint`, `lead_capture`, `media_capabilities`, `conversion_ctas`, `animation_tokens`, `empty_states` y compat top-level; backend deberia estabilizar `workspace`.

- `src/features/chat/ChatPanel.tsx`
  - Renderiza `first_visit`, `sample_conversations`, `trust_signals`, `conversion_ctas` y `lead_capture` cuando llegan del backend.
  - `lead_capture.fields` genera formulario dinamico y envia `POST /api/public/lead-capture`.

- `src/components/chat/ChatInput.tsx`
  - Usa `media_capabilities` para ocultar/mostrar imagen, audio, ubicacion y archivo.
  - Audio se envia multipart con `multipart_field` o `audio_file`.

- `src/features/chat/ChatComposer.tsx`
  - Muestra preview/cancel/retry de adjuntos en demo/standalone.
  - Usa `upload_endpoint` y `upload_response_key` antes de mandar `attachmentInfo`.

- `src/components/tickets/inbox/TicketConversationPane.tsx`
  - Usa `experience_blueprint.agent_copilot.suggestions` normalizadas por `src/api/v2/saas.ts` como botones sugeridos para el operador.

- `src/features/tickets/ticketsApi.ts`
  - Normaliza `items[]`, `tickets[]` o array legacy; backend deberia estabilizar `{ items: [...] }`.

- `src/features/analytics/analyticsApi.ts`
  - Normaliza top-level o `summary`; backend deberia estabilizar `{ summary: {...} }`.
  - Consume `operations.dashboard.v1`, `operations.heatmap.v1`, `operations.action_center.v1` y `operations.freshness.v1`.

- `src/features/analytics/OperationsDashboardPanel.tsx`
  - Espera `summary`, `trends.items`, `tickets.by_status/by_channel/by_category/by_priority`, `surveys.live_items`, `chats.by_channel`, `live_chat.items`, `employees.coverage`, `maps.heatmap.hotspots`, `alerts` y `next_best_actions`.
  - Respeta `frontend_contract.primary_refresh_seconds`.
  - Usa `freshness.summary.can_render_heatmap` para evitar renderizar mapas vacios.
  - No ejecuta mutaciones de action center automaticamente.

- `src/features/surveys/surveysApi.ts`
  - Envia drafts a `/api/v2/surveys/draft`; backend debe aceptar drafts incompletos y responder ack.

Nota de entorno: en esta maquina no se pudieron correr tests reales porque faltan `npm`, `tsc`, `git` y `node_modules`; los archivos quedaron preparados para ejecutarse cuando el entorno tenga dependencias instaladas.
