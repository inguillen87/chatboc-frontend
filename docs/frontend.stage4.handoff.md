# Frontend Stage 4 Handoff Packet (abril 2026)

## 1) Qué cambió en backend y FE debe consumir ya

1. **Identidad omnicanal en headers** (`X-Contact-Key`, `X-Conversation-Id`) con persistencia por tenant y reinyección en requests críticas.
2. **Analytics coverage endpoint** `GET /analytics/identity/coverage` con `contract_version`, `coverage_pct`, `slo_status`, `alerts`, `alert_count`.
3. **Analytics ingest ack** `POST /analytics/event` con `contract_version: analytics.event_ingest.v1`, `contact_key`, `conversation_id`, `identity_source`.
4. **Analytics event schema** `GET /analytics/event/schema?tenant_id=<id>` para `canonical_events`, `required_dimensions`, `recommended_dimensions`.
5. **WhatsApp funnel admin** `GET /admin/analytics/whatsapp-funnel` con `contract_version` obligatorio y etapas con `event_name`, `label`, `sessions`, `unique_contacts`, `conversion_from_prev_pct`.
6. **RBAC v1 compartido**: matriz de capacidades y mapeo `requiredCapabilities` por pantalla.
7. **Widget auth contracts**: `GET /auth/widget/bootstrap` (`auth.widget_bootstrap.v1`), `POST /auth/widget-token` y `POST /auth/widget-refresh` (`auth.widget_token.v1`).
8. **Tracking público de reclamos**: `GET /tickets/public/status?code=<M-...>&pin=<...>` (`tickets.public_status.v1`).

## 2) Criterios de aceptación FE (sprint actual)

- Requests críticas incluyen `X-Contact-Key` cuando exista identidad local.
- Si existe `X-Conversation-Id`, se reinyecta en market/tickets/encuestas/analytics.
- Coverage muestra banner cuando `alert_count > 0`.
- Ingest de analytics valida `contract_version === 'analytics.event_ingest.v1'`.
- Configuración de eventos valida catálogo desde `/analytics/event/schema`.
- Vista funnel valida `contract_version` antes de renderizar.
- Pantallas con permisos usan `requiredCapabilities` alineado a RBAC v1.

## 3) QA manual mínimo

1. **Tenant municipio**: coverage refleja `slo_status`; funnel soporta `conversion_from_prev_pct = null`.
2. **Tenant pyme**: continuidad de headers en market + pedido; denegaciones RBAC redirigen a 403 usable.
3. **Usuario nuevo**: app degrada sin crash y persiste identidad al primer response con headers.

## 4) Referencias

- Contratos congelados: `docs/contracts/platform-contract-freeze-v1.md`.
- Ejemplos de payload: `docs/frontend.stage4.payload_examples.md`.
- Matriz RBAC: `docs/rbac.capability_matrix.v1.md`.
