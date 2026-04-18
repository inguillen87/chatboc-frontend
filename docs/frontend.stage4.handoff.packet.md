# Frontend Stage 4 Handoff Packet (abril 2026)

## 1) Cambios backend a consumir de inmediato

1. Identidad omnicanal en headers (`X-Contact-Key`, `X-Conversation-Id`) con persistencia por tenant y reinyección.
2. Coverage endpoint: `GET /analytics/identity/coverage` (`contract_version`, `coverage_pct`, `slo_status`, `alerts`, `alert_count`).
3. Ingest ack: `POST /analytics/event` (`analytics.event_ingest.v1` + identidad).
4. Event schema: `GET /analytics/event/schema?tenant_id=<id>` (`canonical_events`, `required_dimensions`, `recommended_dimensions`).
5. WhatsApp funnel: `GET /admin/analytics/whatsapp-funnel` con `contract_version` y `unique_contacts`.
6. Widget auth: `GET /auth/widget/bootstrap`, `POST /auth/widget-token`, `POST /auth/widget-refresh`.
7. Tickets públicos/workflow: `/tickets/public/status`, `/tickets/workflow/metadata`.
8. Encuestas públicas v1: `/public/encuestas/v1/<slug>` y ack v1 en respuestas.

## 2) Criterios de aceptación del sprint

- Requests críticas incluyen `X-Contact-Key` cuando haya identidad local.
- Requests con continuidad incluyen `X-Conversation-Id` cuando exista.
- Banner de coverage visible con `alert_count > 0`.
- Ingest/funnel rechazan payload sin `contract_version` válido.
- Pantallas con permisos alineadas a `requiredCapabilities` de matriz RBAC.

## 3) QA manual mínimo

1. Tenant municipio: coverage OK + funnel tolera `conversion_from_prev_pct = null`.
2. Tenant pyme: continuidad headers en market/pedido + fallback 403 usable.
3. Usuario nuevo: degradación elegante + persistencia de identidad al primer response.

## 4) Tickets sugeridos FE

1. `identity-headers-propagation`
2. `analytics-coverage-ui`
3. `analytics-event-ingest-ack-v1`
4. `analytics-event-schema-v1`
5. `whatsapp-funnel-contract-v1`
6. `rbac-required-capabilities-alignment`

