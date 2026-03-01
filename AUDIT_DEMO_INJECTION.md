# AUDIT_DEMO_INJECTION

## Alcance
Flujo frontend del botón “100 demo” en analytics admin.

## Hallazgos
1. El flujo anterior dependía del endpoint público de respuestas, sensible a deduplicación/antifraude.
2. Los `409 Conflict` se mezclaban con fallos reales y degradaban UX operativa.

## Cambios aplicados
- Se prioriza endpoint admin de seed masivo (`adminSeedSurvey`) cuando hay `survey.id`.
- Fallback al endpoint público solo para estados de no-soporte (`400/404/405/501`).
- En fallback público, `409` se trata como duplicado (`duplicates`) y no como `failures`.
- Toast de resultado con resumen explícito de duplicadas omitidas.

## Resultado esperado
- Menos conflictos visibles en operación demo.
- Resumen final más útil: `success / duplicates / failures`.

## Recomendación backend
- Confirmar contrato de respuesta bulk incluyendo `creadas`, `duplicadas`, `fallidas` para trazabilidad completa.
