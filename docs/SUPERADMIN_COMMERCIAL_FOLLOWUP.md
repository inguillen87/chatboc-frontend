# SuperAdmin: seguimiento comercial por organización

Base exacta: 662698487637087c5d71e5cb44a9b19031466adb, correspondiente al rediseño de SuperAdmin del PR #1767. No se usa main antiguo ni se incorporan las releases pendientes de encuestas/Tierra del Fuego.

## Entrada y alcance

SuperAdmin → Organizaciones → Seguimiento comercial. La ficha abre sobre la organización elegida y conserva la sesión de plataforma. Reutiliza los endpoints autenticados existentes de `/api/admin/tenants/<slug>/leads`. No modifica cuentas, roles, autenticación, proveedores, dominios ni base de datos.

Incluye búsqueda sin distinción de acentos, filtros por etapa, CSV de casos filtrados, ficha de contacto, historial y notas, y revisión explícita del cambio de etapa. El listado solicita hasta 100 filas; su cobertura no se presenta como el total global del CRM. El historial conserva únicamente los últimos 100 eventos publicados por el backend, no un registro inmutable.

Las operaciones usan organización + tipo + ticket_id interno. El número visible sólo identifica al caso en pantalla. Respuestas de listas de otra organización, identidades ambiguas y recibos incompatibles no habilitan operaciones. Una sesión nueva del editor retira historial y borradores anteriores. Los resultados tardíos no modifican otro caso. Los controles locales no sustituyen permisos del backend.

## Guardado y límites

Cancelar la confirmación no escribe. Notas y motivos admiten hasta 1000 caracteres; el motivo es obligatorio en este flujo. Cambiar etapa también cambia el estado operativo del caso; Ganado lo cierra y Perdido lo cancela según el contrato backend revisado. La confirmación lo advierte antes de aplicar.

Una operación pendiente bloquea dobles clics y el cierre/cambio de caso. Una respuesta incierta conserva el borrador, bloquea nuevas escrituras y exige consultar manualmente el historial. No hay reenvíos automáticos. El backend actual no ofrece idempotency keys ni compare-and-swap para estos endpoints: este cliente no garantiza exactamente-una-vez ni evita conflictos con otro administrador. El historial está limitado y una lectura posterior no prueba por sí sola que una escritura incierta no ocurrió.

El cierre o cambio de caso pide confirmar el descarte cuando hay borradores. No se guardan borradores en localStorage. Recargar/cerrar el navegador puede perderlos; no se implementa persistencia offline. Una denegación 401/403/404 retira datos y borradores. La autorización efectiva debe seguir comprobándose en el servidor.

No se envían mensajes, no se crean recordatorios automáticos, no se inventan tareas comerciales, ingresos ni fechas de actividad. Las fechas sin zona horaria se identifican como tales.

## Compatibilidad y trabajo todavía pendiente

Se agrega una entrada en OrganizationDirectory sin reemplazar sus manejadores de perfiles, edición, usuarios, acceso, estado o purga. El pipeline global legacy no se modifica en este corte: sus controles anteriores de cambios masivos y timeline deben migrarse al flujo verificado en una fase posterior. No afirmar que este PR corrigió todas las rutas legacy.

El siguiente corte backend debe separar el bootstrap de organizaciones del GET del directorio, estabilizar paginación y denominadores, e incorporar control de concurrencia e idempotencia. La revisión actual se basó en routes/admin_tenant.py y routes/super_admin.py del SHA backend 912446bf96f8330664a9dec009ae57dbf935c73c; no certifica solicitudes HTTP productivas.

## Validación

Se ejecutaron 43 comprobaciones locales de lógica/contratos y transporte con Node assert, VM y transpilación TypeScript. No equivalen a ejecutar Vitest, React ni un navegador. La transpilación de los diez archivos TypeScript/TSX del lote no reportó errores sintácticos; tampoco equivale al typecheck de la aplicación.

Se añaden pruebas Vitest del contrato, transporte, editor y entrada desde el directorio: cancelación, doble clic, identidad interna distinta del número visible, borrador conservado, denegación, respuestas tardías entre organizaciones y fallo de lectura posterior a un guardado confirmado. El workflow dedicado ejecuta typecheck, suite completa y build usando las dependencias del repositorio. Su resultado debe comprobarse por SHA; al escribir este documento la ejecución remota aún no se había realizado.

Esta rama no constituye promoción a producción ni comprobación con la sesión real de Google. No se deben heredar los 2867 resultados de la release base como evidencia del código nuevo. El estado final y la evidencia del SHA se registran en el PR.
