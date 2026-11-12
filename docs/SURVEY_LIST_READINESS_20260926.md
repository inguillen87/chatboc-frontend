# Encuestas: actualización y paginación verificables

## Base y cierre
Base productiva confirmada al comenzar: `8aff3d88c4f0f8f66d5eff2662cb493f7483ad30` (PR #1782). Se preservan la cabecera privada, footer operativo y navegación móvil publicados por ese lote. La API sigue en `912446bf96f8330664a9dec009ae57dbf935c73c`.
Este incremento cierra la consulta del listado de Encuestas: actualización explícita, retirada de resultados durante una nueva lectura, recuperación de la página siguiente y continuidad por organización. No modifica autenticación, datos de encuestas ni operaciones del backend.

## Comportamiento visible
El encabezado incluye **Actualizar listado**, bloqueado mientras carga otra página o hay una operación pendiente. Durante una actualización aparecen el indicador y texto visible de consulta; las tarjetas y resúmenes anteriores no se muestran como si la nueva consulta ya hubiese terminado.
Un fallo de actualización deja una pantalla de error recuperable, no un listado anterior con apariencia de éxito. Si sólo falla temporalmente la página siguiente, se conservan las páginas recibidas y aparece **Reintentar página**. Una denegación de acceso o contradicción de identidad/paginación retira toda la colección anterior.
Los filtros siguen siendo locales a los instrumentos recibidos. Se conservan al actualizar la misma organización y se reinician cuando cambia la organización. Un total no informado permanece desconocido: no se sustituye por el número de registros cargados.

## Integridad de la consulta
El hook utiliza el contexto de organización activo; no rescata por su cuenta un tenant desde localStorage cuando el contexto está vacío. Cada vista/sesión de lectura tiene una clave de consulta propia. Las respuestas de una selección anterior no reaparecen al pasar A→B→A. Las consultas inactivas no se conservan como caché reutilizable y la invalidación existente por prefijo sigue actualizando las vistas activas después de operaciones.
Actualizar y cargar más no se lanzan simultáneamente ni cancelan una lectura en curso con un segundo clic. No se programa polling y no se añade reintento automático. El refoco de ventana no dispara una nueva lectura del listado; siguen disponibles actualización explícita, reconexión e invalidación normal de consultas.
Se verifican los identificadores y aliases explícitos, la organización de cada registro cuando está informada, los conteos devueltos y los cursores. Duplicados entre páginas, ciclos de cursor, cifras incompatibles o una mezcla de organizaciones producen error de verificación, en lugar de conservar silenciosamente un registro anterior.
Las páginas legacy incompletas conservan compatibilidad sin atribuirles un ID/total que no publicaron. Estas comprobaciones del frontend no reemplazan la autorización del servidor ni crean una transacción de snapshot entre páginas.

## Validación
Cuatro pruebas nuevas reprodujeron en la base el listado antiguo tras 401/403/500 y la ausencia de estado de actualización. Pasan después de corregir el hook. Una aserción espera la notificación asíncrona normal de React Query, manteniendo el mismo ID esperado tras completar la lectura.
La ejecución focalizada aprobó 68 pruebas en cuatro archivos: contrato de lectura, hook real con servicio simulado, paginación existente y controles reales del listado con hook simulado. TypeScript aprobado. La suite completa se verifica en GitHub Actions sobre el SHA definitivo.
Una ejecución completa local no terminó correctamente por `ENOSPC` en 24 archivos de prueba. El informe incompleto se conserva aparte y no se usa como certificado. Se retiraron únicamente outputs regenerables de builds anteriores y la caché del compilador Node, conservando fuentes, dependencias, respaldos y evidencia; la regresión completa pasa a CI para no volver a llenar el disco del usuario.
La preparación de una nueva barra de estado y un adaptador adicional de navegador fue rechazada: no se incluyeron ni se atribuyen pruebas de ese recorrido. Los cambios visibles usan el listado existente. El navegador de tarjetas ya existente se ejecuta por separado como regresión; no demuestra el nuevo protocolo de listado ni credenciales reales.

## Entrega
Se amplía el workflow existente `Survey cards production verification`, sin crear otro pipeline redundante. La publicación exige tipos, suite completa y build aprobados en CI, recursos del candidato y verificaciones públicas de lectura. El rollout no envía contraseñas ni modifica encuestas reales; se conserva la revisión anterior para rollback.
No se modifican cuentas de Analía, dominios propios, WhatsApp, webhooks, el esquema de datos ni la migración Render→Vercel/Neon. No se da por cerrado el onboarding institucional por corregir una lista.
Comandos focalizados: `npx vitest run src/hooks/useSurveyAdmin.readiness.test.tsx src/hooks/useSurveyAdmin.pagination.test.tsx src/utils/surveyListReadiness.test.ts src/pages/admin/encuestas/index.lifecycle.test.tsx`; `npm run typecheck`. Documentación técnica consultada: TanStack Query, Infinite Queries y useInfiniteQuery v5.
