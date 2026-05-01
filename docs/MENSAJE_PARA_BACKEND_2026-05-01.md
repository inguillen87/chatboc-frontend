# Mensaje para Backend - Sync Frontend 2026-05-01

Equipo backend, desde frontend ya dejamos implementada una tanda de UX/UI y normalizadores que consume contratos nuevos y legacy. Necesitamos que estabilicen estos endpoints/campos para no seguir adivinando shapes ni meter textos locales en React.

El documento completo esta en:

`docs/FRONTEND_TO_BACKEND_SYNC_2026-05-01.md`

## Lo mas urgente

1. Demo session debe devolver `workspace` estable:

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

Endpoint:

`POST /api/v2/demo/session`

2. Widget config debe devolver `quick_menu` desde backend, no desde frontend:

`GET /api/public/tenants/{slug}/widget-config`

Shape esperado:

```json
{
  "contract_version": "public.widget_config.v1",
  "tenant": { "slug": "...", "tipo": "municipio|pyme" },
  "widget": {},
  "builder_config": {},
  "suppress_global_widget": false,
  "integration_preview": false,
  "quick_menu": [
    { "id": "estado_caso", "label": "Estado de caso", "intent": "ticket_status" }
  ]
}
```

3. Tickets v2 debe estabilizar `{ items: [...] }`.

Endpoint:

`GET /api/v2/tickets`

Frontend tolera `items[]`, `tickets[]` o array legacy, pero queremos esto:

```json
{
  "items": [
    {
      "id": 1,
      "title": "...",
      "status": "nuevo",
      "priority": "alta",
      "sla_status": "ok|warning|breached",
      "channel": "web|whatsapp|widget",
      "category": "...",
      "assignee": {
        "id": 1,
        "name": "..."
      }
    }
  ],
  "request_id": "..."
}
```

4. Analytics v2 debe estabilizar `summary`.

Endpoint:

`GET /api/v2/analytics/overview`

```json
{
  "summary": {
    "conversations": 0,
    "open_tickets": 0,
    "overdue_tickets": 0,
    "response_time": 0,
    "survey_responses": 0,
    "nps": null,
    "csat": null,
    "handoff_rate": 0
  },
  "request_id": "..."
}
```

5. Surveys draft/offline debe aceptar drafts incompletos.

Endpoint:

`POST /api/v2/surveys/draft`

Payload que frontend puede mandar:

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
  "request_id": "...",
  "draft_id": "draft_123",
  "status": "draft"
}
```

6. PWA tenant resolution debe responder JSON accionable.

Endpoint canonico:

`GET /api/pwa/public/tenant-info`

Si no resuelve tenant:

```json
{
  "contract_version": "pwa.public_tenant_resolution.v1",
  "status_code": 404,
  "reason_code": "tenant_resolution_failed",
  "retryable": false,
  "action_hint": "send tenant, tenant_slug, endpoint or X-Tenant-Slug",
  "request_id": "...",
  "hints": {
    "query_params": ["tenant", "tenant_slug", "endpoint", "widget_token"],
    "headers": ["X-Tenant-Slug", "X-Tenant", "X-Entity-Token"]
  }
}
```

7. Error envelope para todos los errores publicos:

```json
{
  "error": {
    "code": 400,
    "message": "Mensaje claro"
  },
  "request_id": "..."
}
```

Para encuestas publicas:

```json
{
  "status_code": 403,
  "reason_code": "survey_not_published",
  "retryable": false,
  "action_hint": "view_other_surveys",
  "request_id": "..."
}
```

## Blockers que frontend ya dejo preparados pero necesita backend

- Employee coverage.
- Tenant health.
- Executive summary superadmin.
- Inbox omnicanal premium.
- Pagos reales.
- Puntos/recompensas reales.
- Quick menu educativo completo desde backend.
- Hooks de notifications.

## Orden recomendado para backend

1. Rompe UX actual:
   - Demo `workspace`.
   - Widget `quick_menu`.
   - Error envelope con `request_id`.
   - PWA tenant resolution JSON.

2. Desbloquea pantallas ya implementadas:
   - Tickets v2 `{ items }`.
   - Analytics v2 `{ summary }`.
   - Survey draft ack.
   - Quick menu educativo.

3. Mejora datos/analytics:
   - Employee coverage.
   - Tenant health.
   - Executive summary.
   - Notifications hooks.

4. Nice-to-have:
   - Pagos reales.
   - Puntos/recompensas.
   - Idempotency key para offline sync.

## Tests/mocks FE esperando esto

- `src/api/client.stage4Contracts.test.ts`
- `src/api/tenant.test.ts`
- `src/api/market.test.ts`
- `src/api/education.test.ts`
- `tests/e2e/chatboc-smoke.spec.ts`
- `src/features/demo/demoApi.ts`
- `src/features/tickets/ticketsApi.ts`
- `src/features/analytics/analyticsApi.ts`
- `src/features/surveys/surveysApi.ts`
