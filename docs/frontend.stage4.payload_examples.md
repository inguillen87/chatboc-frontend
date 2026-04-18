# Frontend Stage 4 — Payload Examples (v1)

> Ejemplos de referencia para tipado y pruebas de integración FE.

## 1) GET `/analytics/identity/coverage` (con alertas)

```json
{
  "contract_version": "analytics.identity_coverage.v1",
  "tenant_id": 42,
  "coverage_pct": 84.5,
  "slo_status": "below_target",
  "alert_count": 2,
  "alerts": [
    { "channel": "whatsapp", "coverage_pct": 81, "target_pct": 95, "gap_pct": 14, "severity": "high" }
  ]
}
```

## 2) GET `/admin/analytics/whatsapp-funnel`

```json
{
  "contract_version": "admin.analytics.whatsapp_funnel.v1",
  "tenant_id": 42,
  "stages": [
    {
      "event_name": "message_received",
      "label": "Mensaje recibido",
      "sessions": 300,
      "unique_contacts": 275,
      "conversion_from_prev_pct": null
    }
  ]
}
```

## 3) POST `/analytics/event` (ack)

```json
{
  "ok": true,
  "contract_version": "analytics.event_ingest.v1",
  "tenant_id": 42,
  "event_name": "portal_opened",
  "contact_key": "wa:contact:abc123",
  "conversation_id": "conv-abc123",
  "identity_source": "conversation_id"
}
```

## 4) GET `/analytics/event/schema?tenant_id=42`

```json
{
  "contract_version": "analytics.event_schema.v1",
  "tenant_id": 42,
  "required_dimensions": ["event_name", "channel", "tenant_id"],
  "recommended_dimensions": ["contact_key", "conversation_id"],
  "canonical_events": ["message_received", "ticket_created", "portal_session_opened"]
}
```

## 5) GET `/tickets/public/status?code=M-12345&pin=9999`

```json
{
  "contract_version": "tickets.public_status.v1",
  "ticket": {
    "nro_ticket": "M-12345",
    "estado": "en_proceso",
    "categoria": "alumbrado"
  }
}
```

## 6) GET `/tickets/workflow/metadata`

```json
{
  "contract_version": "tickets.workflow.v1",
  "states": ["nuevo", "en_proceso", "cerrado"],
  "transitions": { "nuevo": ["en_proceso", "cerrado"], "en_proceso": ["cerrado"], "cerrado": [] },
  "final_states": ["cerrado"]
}
```

## 7) GET `/public/encuestas/v1/<slug>` + POST respuestas

```json
{
  "contract_version": "encuestas.public.v1",
  "encuesta": { "id": 10, "slug": "satisfaccion-servicio", "estado": "published", "preguntas": [] }
}
```

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

## 8) GET `/tenant-profile` (404 sin demo fallback)

```json
{
  "error": {
    "code": 404,
    "message": "Tenant slug 'foo' not found"
  }
}
```

## 9) GET `/tenant-profile` (educación)

```json
{
  "contract_version": "public.tenant_profile.v1",
  "tenant": {
    "slug": "colegio-san-martin",
    "rubro_profile": {
      "education_profile": {
        "is_education": true,
        "institution_type": "private",
        "modules": ["asistencia", "comunicados", "agenda_academica", "tramites_secretaria"]
      }
    }
  }
}
```

## 10) GET `/api/public/widget-config` (educación)

```json
{
  "contract_version": "public.widget_config.v1",
  "quick_menu": [
    { "id": "menu_asistencia", "label": "Asistencia", "intent": "asistencia_alumno" },
    { "id": "menu_comunicados", "label": "Comunicados", "intent": "comunicados_familias" }
  ]
}
```

## 11) GET `/auth/demo/catalog` (demo mode OFF)

```json
{
  "contract_version": "auth.demo.v1",
  "error": {
    "code": 404,
    "message": "Demo mode disabled"
  }
}
```

