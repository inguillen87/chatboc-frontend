# Platform API + Events Contract Freeze v1

Estado: **Draft congelable**  
Última actualización: 2026-04-14

## Objetivo

Congelar una base única de contratos para evitar drift entre frontend y backend en:

- auth
- tickets/reclamos
- encuestas/votaciones
- marketplace (catalog/cart/orders)
- portal de usuario
- analytics/heatmaps
- socket events
- deep links provenientes de WhatsApp/widget

## Índice de contratos v1

| Dominio | Contrato fuente | Versión |
| --- | --- | --- |
| Omnicanal headers/identidad | `docs/contracts/omnicanal-v1.md` | v1 |
| RBAC + capabilities | `docs/contracts/rbac-capabilities-v1.md` | v1 |
| Analytics events | `docs/contracts/analytics-events-v1.md` | v1 |
| Shared error envelope | `docs/shared.error.v1.contract.md` | v1 |
| Identity coverage analytics | `docs/analytics.identity_coverage.v1.contract.md` | v1 |
| Tenant routing/canonical links | `docs/tenant-routing.md` | v1 |

## Superficies pendientes de cierre explícito

Estas superficies deben cerrarse con documento versionado antes de ampliar features:

1. **Auth + sesión**
   - refresh, vencimiento y scopes/capabilities
   - token/contexto para widget y portal
2. **Tickets**
   - estados, prioridad, SLA, timeline, asignación
3. **Encuestas y votaciones**
   - modelo separado de encuesta vs votación
   - publicación/cierre/export
4. **Marketplace**
   - contrato de catálogo/producto/orden
5. **Portal usuario**
   - rutas mínimas y compatibilidad de sesión contextual
6. **Heatmaps**
   - payload de capas/filtros agregado en backend
7. **Socket events**
   - eventos de presencia, asignación, lectura y actualización de estado
8. **Deep links WhatsApp/widget**
   - parámetros obligatorios y reglas de canonicalización tenant

## Regla operativa

No se incorpora un flujo nuevo en frontend hasta tener:

1. contrato versionado publicado,
2. parser/normalizador de respuesta en frontend,
3. tests de contrato en `src/**/*.test.ts*`.
