# Platform API + Events Contract Freeze v1

Estado: **Activo (v1 congelado para FE/BE)**  
Última actualización: 2026-04-18

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

## Estado de superficies (cierre de pendientes)

| Superficie | Estado | Fuente |
| --- | --- | --- |
| Auth + sesión demo/widget | ✅ Cerrado v1 | `docs/auth.demo.v1.contract.md` + contratos widget en Stage4 |
| Tickets (status público + workflow metadata) | ✅ Cerrado v1 | `docs/frontend.stage4.payload_examples.md` |
| Encuestas públicas + respuestas | ✅ Cerrado v1 | `docs/frontend.stage4.payload_examples.md` |
| Marketplace + rutas tenant | ✅ Cerrado v1 (routing canónico) | `docs/tenant-routing.md` + `docs/commerce-multi-tenant.md` |
| Portal usuario | ✅ Cerrado v1 (entry/build aislado + rutas canónicas) | `docs/contracts/portal-architecture-decision.md` |
| Heatmaps/analytics base | 🟡 Operativo v1, mejoras evolutivas abiertas | `docs/contracts/analytics-events-v1.md` |
| Socket events operativos | 🟡 Operativo v1, extensión v2 pendiente | backlog realtime |
| Deep links WhatsApp/widget | ✅ Cerrado v1 | `docs/tenant-routing.md` + handoff Stage4 |

> Regla para nuevos cambios: cualquier ampliación de alcance sobre estas superficies se publica como **v2** sin romper `v1`.

## Regla operativa

No se incorpora un flujo nuevo en frontend hasta tener:

1. contrato versionado publicado,
2. parser/normalizador de respuesta en frontend,
3. tests de contrato en `src/**/*.test.ts*`.
