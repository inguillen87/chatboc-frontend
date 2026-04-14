# Backlog ejecutable fullstack (ownership)

## CT (contratos compartidos)
- CT-01: omnicanal v1 congelado.
- CT-02: RBAC/capabilities v1 único.
- CT-03: analytics events v1 único.
- CT-04: `shared.error.v1` aplicado en APIs críticas.
- CT-05: `analytics.identity_coverage.v1` como fuente de verdad para operación.

## FE (frontend)
1. FE-01 canonical routing `/t/:tenantSlug/*`.
2. FE-02 hardening TS gradual (`src/api`, `src/context`, market, portal).
3. FE-03 propagación omnicanal (`X-Contact-Key`, `X-Conversation-Id`).
4. FE-06 encuestas públicas con contrato canónico y fallback explícito por flag.
5. FE-07 UX RBAC con 403 usable + telemetría.

## BE (backend)
1. BE-01 migraciones explícitas y contratos versionados.
2. BE-02 errores homogéneos (`shared.error.v1`).
3. BE-03 identidad omnicanal en respuestas críticas.
4. BE-04 observabilidad (`identity_coverage_alert`, funnel por contacto único).

## DoD transversal
- Contratos documentados y versionados.
- Tipado frontend alineado a contratos.
- Telemetría operativa activa en flujos críticos.
- Tests unitarios/regresión verdes.
