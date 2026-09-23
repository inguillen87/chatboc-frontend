# SuperAdmin enterprise — contrato y alcance del sprint

Base frontend: `33fab036c1f1559251317191a524767f158261b3`. Contratos backend revisados desde Git: `912446bf96f8330664a9dec009ae57dbf935c73c`. La lectura de ese código no sustituye una verificación HTTP en producción. Este sprint no cambia backend, cuentas, roles ni configuración de proveedores.

## Qué representan los datos

| Fuente | Alcance y unidad |
| --- | --- |
| `/api/admin/tenants` | `total` es el total del directorio. `tenants` es una página. Estados, tipos y planes calculados en el frontend se refieren únicamente a las organizaciones cargadas. |
| `/api/v2/superadmin/executive-summary` | `summary.tenants` incluye todos los TenantProfile consultados. Las filas están en `tenant_health.items`, con identidad en `tenant.slug/nombre` y puntaje en `health.score`. No deben crearse identificadores `tenant_1` a partir de su posición. |
| `/api/v2/superadmin/command-center` | `summary.tenants` cubre la selección limitada: 50 por defecto y 200 como máximo. No reemplaza el total del directorio. El período de la respuesta no convierte los controles de salud actuales en una tendencia de 30 días. |
| `/api/admin/crm/leads?limit=8` | `items`, `total` y `summary` describen solamente los contactos devueltos. El backend examina una selección reciente limitada antes de ordenar/filtrar. No es el tamaño global del CRM ni una muestra estadística. |
| `/api/admin/leads/pipeline` | `total` y distribución de etapas describen los registros devueltos, limitados. `conversion_rate` es ganado/total en escala 0–1; `avg_first_response_seconds` es null en este contrato. |
| `/api/admin/leads/strategic-overview` | Métricas en `totals`, incluyendo `total_leads`, `open_leads`, `sla_breached` y `win_rate`. `win_rate` ya está en escala 0–100. |
| `/api/admin/analytics/tenant-health` y `profile-360` | Índice legacy de 0–100, con fórmula de tickets, encuestas y conversaciones. `profile-360.meta.last_updated_at` es la fecha informada por el servidor. |
| `/api/v2/tenants/:slug/health` | Índice distinto, de 0–100: proporción de seis controles de configuración y actividad. `/api/v2/tenant-health` también resuelve una sola organización; no es una colección global. |

El índice V2 verifica actividad, widget, WhatsApp, equipo, notificaciones y tickets vencidos. El backend considera las notificaciones saludables cuando no hay entregas ni fallos registrados. Por eso el índice no certifica disponibilidad, SLA, éxito de entrega ni un servicio probado. No se mezclan su promedio y el índice legacy. Una base sin puntajes válidos se muestra como no disponible, aunque el servidor devuelva 100 como valor predeterminado para una colección vacía.

No hay un contrato de ingresos, MRR, ARR o facturación en estas respuestas. La distribución por plan no permite inferir ingresos. Tampoco hay serie histórica para inventar tendencias. Las temperaturas CRM son clasificaciones recibidas del backend; las desconocidas permanecen sin clasificar.

## Contexto y errores

Las lecturas globales omiten el tenant heredado del navegador. Se conservan los filtros de query elegidos por el operador y los métodos que reciben un tenant explícito. La consulta global de salud usa el endpoint de colección; la consulta explícita mantiene su endpoint V2 por tenant. No cambian transportes de autenticación ni operaciones de escritura.

El adaptador `src/components/admin/platform/data.ts` conserva la base de cada cifra, usa las filas originales del contrato y distingue un error de un cero válido. Una diferencia entre el total del directorio y el resumen ejecutivo se informa sin sobrescribir ninguno. El promedio indica cuántas filas tienen puntaje válido; rechaza valores fuera de rango, identificadores ausentes y duplicados.

## Riesgo backend pendiente

`routes/super_admin.py:list_tenants` ejecuta `_bootstrap_missing_tenants()` antes de paginar. Ese GET puede crear y confirmar organizaciones faltantes para usuarios administrativos. Las consultas iniciales en paralelo pueden observar totales diferentes. Es una hipótesis respaldada por el código para diferencias que desaparecen al recargar; este sprint no modifica esa rutina. Consultar el directorio conserva ese comportamiento existente. Un siguiente corte backend debería separar esa reparación de una lectura, conservar su idempotencia y documentar explícitamente el origen de los registros creados.

## Validación local de este corte

- `data.test.ts`: 14 pruebas del adaptador; incluye base vacía, errores con datos anteriores, paginación, identidades anidadas, puntaje 1, contratos desconocidos y discrepancia de totales.
- `enterpriseService.globalScope.test.ts`: 20 pruebas con el `apiFetch` real y transporte HTTP simulado; contexto almacenado y URL anterior, filtros explícitos, rama por tenant y conservación de Bearer/cookies.
- `enterpriseService.test.ts`: 21 regresiones existentes aprobadas junto a esas pruebas; 55 pruebas en ese lote.
- TypeScript y comprobación de diff aprobados en la revisión local del adaptador. El cierre integrado, navegador, CI y release se documentarán por separado.

Los fixtures usan identidades sintéticas. Estas pruebas no realizaron escrituras en producción, envío de WhatsApp ni cambios de cuenta. El estado de publicación y la aceptación visual permanecen a cargo del cierre de release.

## Funcionalidad y aceptación integrada

El acceso Google verificado conserva el arreglo de cookies de la base `33fab036`. El ingreso predeterminado de un superadministrador y `/perfil` sin contexto explícito abren `/superadmin`. Las entradas de organizaciones conservan su contexto. La navegación de plataforma muestra ChatBoc, el rol y el correo de la sesión; no presenta el comercio de prueba como identidad del SuperAdmin. No se cambiaron cuentas ni permisos.

El espacio se organiza en Resumen, Organizaciones, CRM, Canales y Diagnóstico. Incluye gráficos Recharts, transiciones Framer Motion que respetan movimiento reducido, directorio paginado, filtros combinables y CSV de las filas filtradas con protección de fórmulas. La ficha identifica la organización y el responsable devueltos por el servidor. Las acciones existentes de edición, acceso, WhatsApp y purga conservan sus manejadores y confirmaciones.

Aceptación en navegador de la SPA real con servicios e identidades sintéticos locales:

- Búsqueda y filtros combinados: un resultado y cero resultados; exportación deshabilitada cuando no hay filas. Paginación de 100 a 105 organizaciones sin perder la búsqueda.
- CSV descargado y leído: 162 bytes, cabecera y exactamente una fila de la organización filtrada.
- Ficha correcta, foco visible y datos de responsable/fecha; escritorio y móvil sin desbordamiento horizontal en los anchos comprobados. Tema oscuro legible.
- Errores HTTP 503 se muestran como no disponibles; Reintentar recupera el directorio, Actualizar contactos recupera CRM y Actualizar resumen recupera sus cuatro indicadores sin recargar la página.
- Rol administrador de organización rechazado al intentar abrir SuperAdmin. Contextos implícitos antiguos no restringen las lecturas globales.
- Conversión sintética de 1/3 presentada como 33.3%; tiempo de respuesta nulo como no disponible; salud legacy como puntaje sobre 100 y win rate como porcentaje.

La suite completa integrada pasó con 2867 pruebas. TypeScript y compilación aprobados. La revisión del dashboard cubre además los mensajes técnicos de inicio de widget incrustados en un resumen: se presentan como conversación iniciada sin motivo registrado. Los resultados finales de compilación, suite, SHA y publicación se registran en la evidencia de release y en el PR. Los endpoints secundarios sin fixture devolvieron 501 explícito: no constituyen aceptación de sus integraciones reales. No se ejecutaron operaciones comerciales, purgas ni envíos reales durante la revisión del rediseño.

`.vercelignore` excluye simuladores, evidencias locales, variables de entorno y compilaciones locales del despliegue de fuentes. El control previo de archivos verifica esas exclusiones.

## Siguiente sprint

Separar la reparación de organizaciones del GET del directorio en una operación explícita, idempotente y auditada. Añadir paginación estable, fecha de generación y denominadores de los resúmenes, con pruebas HTTP de permisos y ausencia de escrituras durante las consultas. Luego completar el seguimiento comercial con flujos probados contra esos contratos; los módulos de encuestas y el white-label de Tierra del Fuego conservan sus lotes independientes pendientes de publicación.
