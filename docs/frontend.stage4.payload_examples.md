# Frontend Stage 4 — Payload Examples (v1)

## 1) `GET /analytics/identity/coverage`

```json
{
  "contract_version": "analytics.identity_coverage.v1",
  "tenant_id": 42,
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
    }
  ]
}
```

## 2) `GET /admin/analytics/whatsapp-funnel`

```json
{
  "contract_version": "admin.analytics.whatsapp_funnel.v1",
  "tenant_id": 42,
  "scope": "tenant",
  "window_minutes": 60,
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

## 3) `POST /analytics/event` (202)

```json
{
  "ok": true,
  "contract_version": "analytics.event_ingest.v1",
  "tenant_id": 42,
  "event_name": "portal_session_opened",
  "contact_key": "wa:contact:abc123",
  "conversation_id": "conv-abc123",
  "identity_source": "conversation_id"
}
```

## 4) `GET /auth/widget/bootstrap`

```json
{
  "contract_version": "auth.widget_bootstrap.v1",
  "tenant": { "id": 42, "slug": "demo-tenant" },
  "widget": { "token_cookie_name": "widget_token", "access_minutes": 45, "renew_days": 7 },
  "jwks": { "url": "https://api.chatboc.ar/auth/widget/jwks.json", "alg": "HS256", "kid": "widget-hs256" }
}
```

## 5) `POST /auth/widget-token` / `/auth/widget-refresh`

```json
{
  "contract_version": "auth.widget_token.v1",
  "token": "<jwt>",
  "expires_in": 2700
}
```

## 6) `GET /analytics/event/schema?tenant_id=42`

```json
{
  "contract_version": "analytics.event_schema.v1",
  "tenant_id": 42,
  "required_dimensions": ["event_name", "channel", "tenant_id"],
  "recommended_dimensions": ["contact_key", "conversation_id", "screen_name"],
  "canonical_events": ["message_received", "ticket_created", "ticket_assigned", "ticket_resolved"]
}
```

## 7) `GET /tickets/public/status?code=M-12345&pin=9999`

```json
{
  "contract_version": "tickets.public_status.v1",
  "ticket": {
    "nro_ticket": "M-12345",
    "estado": "en_proceso",
    "categoria": "alumbrado",
    "ultima_actualizacion": "2026-01-02T12:00:00Z"
  }
}
```
