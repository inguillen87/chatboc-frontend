# Frontend handoff — ejecución CRM omnicanal (alineado a backend)

Documento operativo para frontend (admin + portal + widget), alineado con backend y orientado a evitar drift.

## Prioridad de ejecución inmediata

1. **FE-01**: consolidar rutas canónicas por tenant (`/t/:tenantSlug/*`) y mantener legacy solo como redirect.
2. **FE-03**: garantizar propagación/reinyección de `X-Contact-Key` y `X-Conversation-Id` en flujos críticos.
3. **FE-07**: asegurar UX de denegación usable (`/403` + CTA + analytics de intento denegado).

## Endpoints nuevos que FE debe consumir

- `GET /analytics/identity/coverage` (`analytics.identity_coverage.v1`)
- `GET /admin/analytics/whatsapp-funnel` (con `contract_version`)
- `POST /analytics/event` (`analytics.event_ingest.v1`)
- `GET /analytics/event/schema` (`analytics.event_schema.v1`)
- `GET /auth/widget/bootstrap` (`auth.widget_bootstrap.v1`)
- `POST /auth/widget-token` + `POST /auth/widget-refresh` (`auth.widget_token.v1`)
- `GET /tickets/public/status` (`tickets.public_status.v1`)
- `GET /tickets/workflow/metadata` (`tickets.workflow.v1`)

## Criterios de aceptación del sprint

- Requests críticas envían `X-Contact-Key` cuando haya identidad.
- Requests de handoff/continuidad envían `X-Conversation-Id` cuando exista.
- Coverage muestra banner ante `alert_count > 0`.
- Funnel/coverage rechazan payload sin `contract_version` válido.
- Denegaciones RBAC no rompen navegación y quedan trazadas por tenant + pantalla + capability.

## Paquete de referencia

- Handoff resumido: `docs/frontend.stage4.handoff.md`
- Ejemplos de payload: `docs/frontend.stage4.payload_examples.md`
- Matriz RBAC: `docs/rbac.capability_matrix.v1.md`
- Contratos base: 
  - `docs/analytics.identity_coverage.v1.contract.md`
  - `docs/shared.error.v1.contract.md`
