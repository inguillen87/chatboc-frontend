# CRM: tareas por contacto — cierre del sprint

Base frontend preservada: `a7e2b3eb64917b2702d6bfd935d0581d5b8fafa0` (PR 1775). Se recuperaron los archivos de las sesiones interrumpidas en un worktree separado, sin sobrescribir los originales ni mezclar las ramas de encuestas/Tierra del Fuego.
Backend coordinado: PR #2800, rama `feat/crm-tasks-hardened-20260924`, contrato `crm.tasks.v1`.

## Implementación
Desde Persona 360 se abre la ficha de tareas sólo cuando el backend publica una capacidad disponible y coherente con la organización. El módulo admite varias tareas independientes con título, descripción, responsable elegible, prioridad, vencimiento, estado y revisión. No sustituye el seguimiento simple por contacto publicado en el sprint anterior.
Los permisos del servidor determinan qué campos se pueden editar y qué transiciones están disponibles. La consulta de detalle actualiza los permisos de edición; una versión distinta bloquea la escritura hasta revisar la tarea. El historial conserva versión, fecha, actor y motivo, con paginación independiente.
Crear, actualizar o cerrar exige confirmación explícita. Cada operación utiliza una clave que se conserva para un reintento manual de la misma operación. El recibo debe coincidir con la clave, contacto, tarea, revisión, campos solicitados y vencimiento; un HTTP 200 incoherente no se presenta como éxito. Tras confirmación se recarga la lista actual, sin reemplazarla por una revisión histórica recuperada.
Las respuestas tardías no afectan otro editor; se controlan los efectos de montaje repetidos y las lecturas de historial. Un error retira los eventos anteriores y bloquea cambios; las denegaciones retiran los datos de tareas. Fechas no modificadas conservan segundos y precisión, en lugar de truncarse al campo de edición por minutos.
Diseño claro/oscuro adaptable, teclado, objetivos táctiles y movimiento reducido. Las etiquetas y estados operativos de la ficha provienen del contrato del backend, sin personalización local por municipio.

## Integridad y compatibilidad
El listado, cursores, conteos e historial se verifican antes de presentarlos. Una página con identidades duplicadas no se concatena silenciosamente. Los identificadores de contacto y tarea no se derivan de nombres, correos o números visibles.
Las pruebas existentes de Persona 360 mantienen sus comprobaciones de historial y carreras. Se separó el mock del endpoint de capacidades del mock de historial para no consumir respuestas que pertenecen a otro contrato; no se aumentaron expectativas de llamadas ni se borraron pruebas.

## Evidencia local
**3310 pruebas aprobadas / 414 archivos**, cero fallidas y pendientes; TypeScript aprobado. Son 25 pruebas nuevas sobre la base publicada de 3285.
Backend completo con sesión/modelos/rutas/migración originales y SQLite desechable: **22 pruebas aprobadas**, con tres recorridos Chromium de 1440/390/320 píxeles, modo oscuro, persistencia y consulta de historial. Por recorrido se crearon dos tareas y se completó una; la base verificó los registros y eventos esperados. No hubo datos de clientes reales ni acceso externo del backend de prueba.
Se revisaron capturas y se mantuvieron los controles de accesibilidad. La evidencia usa cuentas sintéticas y un adaptador de transporte local; no acredita autenticación externa, envío de notificaciones ni operación productiva.
La compilación local también aprobó. El backend `b6a476cd17916d5ed98242e021d912b5d946242e` aprobó **7 pruebas transaccionales en PostgreSQL 16** en GitHub Actions, run `36071041962`: servicio, modelos y migración reales, con tablas padre mínimas de prueba. Esta evidencia verifica transacciones y triggers, no autenticación PostgreSQL de aplicación completa.

## Reproducción
Frontend: `npm run typecheck`, `npm test -- --maxWorkers=4`, `npm run build`.
Aplicación completa: desde el checkout backend coordinado, `python -m tests.crm_tasks_http_acceptance --frontend <ruta-frontend> --evidence <carpeta>`.
El workflow frontend ejecuta tipos, regresión completa y build; el recorrido navegador/backend se ejecutó por separado en el entorno local desechable. No atribuir al workflow una prueba que no ejecuta.

## Entrega y activación
Código publicado en rama y PR; **no activado en producción**. La migración de las nuevas tablas e historial permanece fuera del grafo activo, en `migrations/pending`. El flag `CRM_TASKS_ENABLED` es falso por defecto. El frontend no habilita tareas si falta el backend o el esquema no está listo.
La activación requiere una publicación coordinada del backend y de su esquema revisado, seguida del frontend compatible. El checklist está en `docs/CRM_TASK_LEDGER_20260924.md` del backend. No se cambia el despliegue que ya funciona en `chatboc.ar`, ni bases, canales, números, credenciales o dominios de clientes durante este corte.

## Límites
Este bloque gestiona tareas del contacto, no proyectos, subtareas, notificaciones automáticas ni sincronización de calendario. Completar una tarea no cierra automáticamente un reclamo o pedido. La clave de reintento se conserva mientras el editor permanece abierto; cerrar y crear otra operación con una clave distinta no garantiza deduplicación. Los triggers protegen el historial contra modificaciones ordinarias, pero no constituyen un registro WORM frente a un administrador de base privilegiado.
