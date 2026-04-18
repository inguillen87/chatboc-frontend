# Frontend Stage 4 Handoff Packet (abril 2026)

> Documento corto para pasar a frontend con foco en integración inmediata.

## 1) Qué cambió en backend y FE debe consumir ya

1. Identidad omnicanal en headers (`X-Contact-Key`, `X-Conversation-Id`) con persistencia por tenant y reinyección.
2. Coverage endpoint `GET /analytics/identity/coverage` (`contract_version`, `coverage_pct`, `slo_status`, `alerts`, `alert_count`).
3. Ingest ack `POST /analytics/event` con `contract_version`, `contact_key`, `conversation_id`, `identity_source`.
4. Event schema `GET /analytics/event/schema?tenant_id=<id>` (`canonical_events`, `required_dimensions`, `recommended_dimensions`).
5. Funnel `GET /admin/analytics/whatsapp-funnel` con `contract_version` y `unique_contacts`.
6. Widget auth contracts: bootstrap/token/refresh.
7. Tracking público y workflow de tickets.
8. Encuestas públicas v1 + ack v1.
9. Demo mode OFF por defecto (`/auth/demo/catalog` y `/auth/demo` retornan 404 `auth.demo.v1`).
10. `tenant-profile` y `widget-config` con contratos v1 públicos.

## 2) Criterios de aceptación FE

- Requests críticas incluyen `X-Contact-Key` cuando exista identidad.
- Requests con continuidad incluyen `X-Conversation-Id` cuando aplique.
- Coverage muestra banner con `alert_count > 0`.
- Funnel/ingest validan `contract_version` antes de render/procesar.
- Pantallas con permisos alineadas a `requiredCapabilities` RBAC v1.

## 3) QA manual mínimo

1. Tenant municipio: coverage OK y funnel tolera `conversion_from_prev_pct = null`.
2. Tenant pyme: continuidad headers en market/pedido + fallback 403 usable.
3. Usuario nuevo: degradación elegante + persistencia de identidad al primer response.

## 4) Tipos TS sugeridos (resumen)

- `IdentityCoverageResponseV1`
- `WhatsappFunnelResponseV1`
- `AnalyticsEventIngestAckV1`
- `AnalyticsEventSchemaV1`
- `PublicTicketStatusV1`
- `TicketWorkflowMetadataV1`
- `PublicSurveyV1`
- `PublicSurveyResponseAckV1`
- `TenantProfilePublicV1`
- `PublicWidgetConfigV1`

## 5) Tickets sugeridos FE

1. `identity-headers-propagation`
2. `analytics-coverage-ui`
3. `analytics-event-ingest-ack-v1`
4. `analytics-event-schema-v1`
5. `whatsapp-funnel-contract-v1`
6. `rbac-required-capabilities-alignment`

