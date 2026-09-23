# Seguimiento comercial: validación del lote

## Primera ejecución CI

Commit 32d1786dda46342aef0818b414225c5cec83b46e, run 35896318289, job 107301004155.
TypeScript aprobado. Suite completa: 2925 pruebas aprobadas y 5 fallidas en 390 archivos. Las 5 fallidas pertenecían a commercialFollowUpApi.test.ts, casos de rechazo HTTP 401/403/404/409/500. Las pruebas de componentes y directorio pasaron. El build no se ejecutó porque la suite detuvo el job.

La preparación beforeEach devolvía por error el mock de apiFetch. Vitest interpreta una función devuelta por beforeEach como limpieza posterior. Al finalizar estos casos llamaba otra vez al mock, que aún estaba configurado para rechazar. Se cambió a un bloque sin devolución: la expectativa de una sola llamada, el rechazo y todos los casos se mantienen intactos. No se eliminaron pruebas ni se cambiaron timeouts o reintentos para obtener verde.
Referencia de contrato de hooks: https://v3.vitest.dev/api/#beforeeach

## Endurecimiento incorporado al mismo cierre

El editor evita volver a aplicar durante el montaje la etapa ya usada como valor inicial. Una nueva regresión elige una etapa antes de los efectos pasivos y comprueba que no se borre. Otra verifica que un 409 conserve motivo y etapa anterior sin comunicar éxito; otra verifica una sola lectura manual pendiente. Un bloqueo sincrónico conserva la prohibición de escritura después de un resultado incierto, además del estado visual.

La revisión de utils/api.ts en el SHA base confirmó que apiFetch persiste por defecto el tenant resuelto en localStorage. Todas las peticiones del nuevo CRM incluyen persistTenantSlug:false: seleccionan la organización del caso sin sustituir el contexto guardado del navegador. Se comprueba esa opción en las cuatro operaciones: lista, historial, nota y cambio de etapa. El núcleo de autenticación y el transporte compartido no se modifican. Las mutaciones no utilizan el fallback de lecturas del transporte revisado.

La ejecución final debe verificarse sobre el nuevo SHA; no hereda el resultado del commit anterior. Los resultados finales se registran en el PR #1768. Este documento no afirma despliegue ni prueba con cuentas productivas. Vercel devolvió 403 para el equipo del proyecto y Desktop Commander informó el equipo desconectado durante este trabajo; no se modificó producción.
