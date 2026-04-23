# Frontend Stage 4 — Payload Examples (v1)

> Ejemplos de referencia para tipado y pruebas de integración FE.

## Orden sugerido de implementación FE

1. Analytics ingest ack + event schema (`/analytics/event`, `/analytics/event/schema`).
2. Analytics coverage (`/analytics/identity/coverage`) con `request_id`.
3. Tickets públicos (`/tickets/public/status`, `/tickets/workflow/metadata`) con `request_id`.
4. Demo auth (`/auth/demo/*` y `/api/auth/demo/*`) en modo disabled contract.

## 1) GET `/analytics/identity/coverage`

### Response 200 (con alertas)

```json
{
  "contract_version": "analytics.identity_coverage.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "tenant_id": 42,
  "scope": "tenant",
  "target_pct": 90.0,
  "coverage_pct": 84.5,
  "slo_status": "below_target",
  "alert_count": 2,
  "alerts": [
    {
      "channel": "whatsapp",
      "coverage_pct": 81.0,
      "target_pct": 95.0,
      "gap_pct": 14.0,
      "severity": "high"
    },
    {
      "channel": "web",
      "coverage_pct": 88.0,
      "target_pct": 90.0,
      "gap_pct": 2.0,
      "severity": "low"
    }
  ],
  "channels": [
    {
      "channel": "whatsapp",
      "events": 810,
      "with_contact_key": 656,
      "coverage_pct": 81.0
    },
    {
      "channel": "web",
      "events": 500,
      "with_contact_key": 440,
      "coverage_pct": 88.0
    }
  ]
}
```

### Response 200 (sin alertas)

```json
{
  "contract_version": "analytics.identity_coverage.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "tenant_id": 42,
  "scope": "tenant",
  "target_pct": 85.0,
  "coverage_pct": 92.4,
  "slo_status": "ok",
  "alert_count": 0,
  "alerts": [],
  "channels": []
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`

---

## 2) GET `/admin/analytics/whatsapp-funnel`

### Response 200

```json
{
  "tenant_id": 42,
  "scope": "tenant",
  "window_minutes": 60,
  "cutoff": "2026-04-14T12:00:00+00:00",
  "contract_version": "admin.analytics.whatsapp_funnel.v1",
  "stages": [
    {
      "event_name": "message_received",
      "label": "Mensaje recibido",
      "sessions": 300,
      "unique_contacts": 275,
      "conversion_from_prev_pct": null
    },
    {
      "event_name": "bot_replied",
      "label": "Bot respondió",
      "sessions": 255,
      "unique_contacts": 240,
      "conversion_from_prev_pct": 85.0
    },
    {
      "event_name": "human_handoff_requested",
      "label": "Pidió derivación",
      "sessions": 90,
      "unique_contacts": 86,
      "conversion_from_prev_pct": 35.3
    }
  ],
  "totals": {
    "events": 645,
    "unique_sessions": 300,
    "unique_contacts": 275
  }
}
```

---

## 3) Error estándar 403 (RBAC)

```json
{
  "error": {
    "code": 403,
    "message": "forbidden",
    "capability": "analytics.admin"
  }
}
```

---

## 4) POST `/analytics/event`

### Response 202

```json
{
  "ok": true,
  "contract_version": "analytics.event_ingest.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "tenant_id": 42,
  "event_name": "portal_opened",
  "contact_key": "wa:contact:abc123",
  "conversation_id": "conv-abc123",
  "identity_source": "conversation_id"
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`

> Nota: si FE envía `contact_key` o `conversation_id` en `null` o `""`, backend intenta reemplazarlos con identidad resuelta del request.

---

## 5) Notas para FE QA

- Validar que `contract_version` exista antes de renderizar vistas críticas.
- Soportar `conversion_from_prev_pct: null` en primera etapa del funnel.
- Tratar `alerts` vacío como estado sano (sin banner).
- `/analytics/identity/coverage` debe funcionar con `analytics.read`; solo `emit_alert_events=1` exige `analytics.admin`.

---

## 6) GET `/auth/widget/bootstrap`

### Response 200 (extracto)

```json
{
  "contract_version": "auth.widget_bootstrap.v1",
  "tenant": {
    "id": 42,
    "slug": "demo-tenant"
  },
  "widget": {
    "token_cookie_name": "widget_token",
    "access_minutes": 45,
    "renew_days": 7
  },
  "jwks": {
    "url": "https://api.chatboc.ar/auth/widget/jwks.json",
    "alg": "HS256",
    "kid": "widget-hs256"
  }
}
```

---

## 7) POST `/auth/widget-token` y `/auth/widget-refresh`

### Response 200

```json
{
  "contract_version": "auth.widget_token.v1",
  "token": "<jwt>",
  "expires_in": 2700
}
```

---

## 8) GET `/analytics/event/schema?tenant_id=42`

### Response 200

```json
{
  "contract_version": "analytics.event_schema.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "tenant_id": 42,
  "required_dimensions": ["event_name", "channel", "tenant_id"],
  "recommended_dimensions": [
    "contact_key",
    "conversation_id",
    "screen_name",
    "category",
    "lat",
    "lng"
  ],
  "canonical_events": [
    "message_received",
    "ticket_created",
    "ticket_assigned",
    "ticket_resolved",
    "survey_answer_submitted",
    "vote_submitted",
    "product_viewed",
    "cart_started",
    "order_created",
    "location_shared",
    "widget_session_opened",
    "portal_session_opened"
  ]
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`

---

## 9) GET `/tickets/public/status?code=M-12345&pin=9999`

### Response 200

```json
{
  "contract_version": "tickets.public_status.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "ticket": {
    "nro_ticket": "M-12345",
    "estado": "en_proceso",
    "categoria": "alumbrado",
    "subcategoria": "luminaria",
    "canal_ingreso": "whatsapp",
    "fecha_creacion": "2026-01-01T12:00:00Z",
    "ultima_actualizacion": "2026-01-02T12:00:00Z"
  }
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`

### Response 404 (ticket inexistente)

```json
{
  "contract_version": "tickets.public_status.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "error": {
    "code": 404,
    "message": "Ticket no encontrado."
  }
}
```

### Response 400 (pin faltante)

```json
{
  "contract_version": "tickets.public_status.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "error": {
    "code": 400,
    "message": "pin requerido."
  }
}
```

---

## 10) GET `/tickets/workflow/metadata`

### Response 200

```json
{
  "contract_version": "tickets.workflow.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "states": ["nuevo", "en_proceso", "en_vivo", "esperando_agente_en_vivo", "cerrado"],
  "transitions": {
    "nuevo": ["en_proceso", "cerrado"],
    "en_proceso": ["en_vivo", "esperando_agente_en_vivo", "cerrado"],
    "en_vivo": ["en_proceso", "cerrado"],
    "esperando_agente_en_vivo": ["en_vivo", "en_proceso", "cerrado"],
    "cerrado": []
  },
  "final_states": ["cerrado"]
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`

---

## 11) GET `/public/encuestas/v1/<slug>`

### Response 200

```json
{
  "contract_version": "encuestas.public.v1",
  "encuesta": {
    "id": 10,
    "slug": "satisfaccion-servicio",
    "titulo": "Encuesta de satisfacción",
    "descripcion": "Queremos conocer tu experiencia.",
    "estado": "published",
    "preguntas": []
  }
}
```

## 12) POST `/public/encuestas/<slug>/respuestas`

### Response 201

```json
{
  "contract_version": "encuestas.public_response.v1",
  "success": true,
  "respuesta_id": 501,
  "anon_id": "anon_abc123",
  "contact_key": "tenant:demo:+5491112345678",
  "conversation_id": "wa_conv_123"
}
```

> Nota: metadata de encuesta con `contact_key`/`conversation_id` en `null` o `""` se completa con identidad resuelta cuando existe.

---

## 13) GET `/tenant-profile` (slug inválido con demo mode OFF)

### Response 404

```json
{
  "error": {
    "code": 404,
    "message": "Tenant slug 'foo' not found"
  }
}
```

### Nota FE

- Cuando `/tenant-profile` devuelve `404`, no asumir fallback demo ni rubros virtuales.
- Mostrar estado controlado (“tenant no disponible”) y CTA de reintento/soporte.

---

## 14) GET `/api/market/<slug>/cart` (demo mode OFF)

### Response 200 (fragmento relevante)

```json
{
  "recompensas_demo": {
    "mode": "disabled",
    "balance_resumen": {
      "saldo_disponible": 0.0,
      "puntos_en_carrito": 120.0,
      "saldo_estimado_post_compra": 0.0
    }
  },
  "wallet": {
    "saldo_disponible": 0.0,
    "puntos_en_carrito": 120.0,
    "saldo_estimado_post_compra": 0.0
  }
}
```

---

## 15) GET `/tenant-profile` (colegio privado/público)

### Response 200 (fragmento relevante)

```json
{
  "contract_version": "public.tenant_profile.v1",
  "tenant": {
    "slug": "colegio-san-martin",
    "rubro_profile": {
      "tenant_type": "pyme",
      "rubro_label": "Colegio Privado San Martín",
      "rubro_slug": "colegio-privado-san-martín",
      "education_profile": {
        "is_education": true,
        "institution_type": "private",
        "modules": [
          "asistencia",
          "comunicados",
          "agenda_academica",
          "tramites_secretaria"
        ]
      }
    }
  }
}
```

---

## 16) GET `/api/public/widget-config` (quick menu educación)

### Response 200 (fragmento relevante)

```json
{
  "contract_version": "public.widget_config.v1",
  "quick_menu": [
    { "id": "menu_asistencia", "label": "Asistencia", "intent": "asistencia_alumno" },
    { "id": "menu_comunicados", "label": "Comunicados", "intent": "comunicados_familias" },
    { "id": "menu_agenda", "label": "Agenda académica", "intent": "agenda_academica" },
    {
      "id": "menu_tramites",
      "label": "Trámites secretaría",
      "intent": "tramites_secretaria",
      "institution_type": "public"
    }
  ]
}
```

---

## 17) GET `/auth/demo/catalog` (demo mode OFF)

### Response 404

```json
{
  "contract_version": "auth.demo.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "error": {
    "code": 404,
    "message": "Demo mode disabled"
  }
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`

## 18) GET `/api/auth/demo/catalog` (alias legacy, demo mode OFF)

### Response 404

```json
{
  "contract_version": "auth.demo.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "error": {
    "code": 404,
    "message": "Demo mode disabled"
  }
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`

## 19) POST `/api/auth/demo` (alias legacy, demo mode OFF)

### Response 404

```json
{
  "contract_version": "auth.demo.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "error": {
    "code": 404,
    "message": "Demo mode disabled"
  }
}
```

### Headers esperados

- `X-Request-Id: <uuid|forwarded>`
