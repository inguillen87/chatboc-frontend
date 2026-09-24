# Seguimiento persistente de contactos — 24/09/2026

## Base y alcance
Base preservada: `66c7142219d759c613a88c35a9d7bace645f4683` (PR 1774). Se retoma el worktree de seguimiento que quedó sin publicar, sin sobrescribir el trabajo paralelo de encuestas.
La entrega añade una agenda de próximas acciones al CRM del SuperAdmin y una entrada en la ficha Persona 360 para contactos con identidad explícita y datos habilitados. El mismo componente se utiliza para todas las organizaciones: no hay personalizaciones locales de Junín o Tierra del Fuego.

## Flujo implementado
1. La agenda solicita hasta 100 contactos al endpoint existente de leads globales. Su alcance es la selección devuelta, no toda la cartera ni todos los vencimientos existentes. Identidades incompletas, enmascaradas o ambiguas no habilitan edición.
2. Filtros locales: todos, vencidos, hoy, próximos, sin fecha y fecha no verificable. Búsqueda por contacto u organización, con normalización de acentos y zona horaria explícita.
3. La ficha consulta el contacto exacto por organización y `contact_id`; no convierte números visibles ni IDs de usuario en identidad de contacto.
4. Notas de hasta 1200 caracteres y una próxima acción por contacto se guardan en los campos backend existentes `owner_notes` y `next_action_at`. No cambia etapa comercial, consentimiento, responsable asignado ni otros campos del contacto.
5. El editor pide confirmación, relee la versión antes del PATCH, valida el recibo de la operación y vuelve a consultar el registro. Sólo anuncia guardado verificado cuando las notas y fecha persistidas coinciden.
6. Una sesión abandonada durante la lectura previa no llega a escribir. Doble clic, navegación y cierre están bloqueados mientras se confirma. Cancelar la revisión no escribe.
7. Un cambio detectado antes del guardado conserva el borrador y exige revisión. Un resultado incierto no se reenvía automáticamente. Denegaciones retiran los datos del editor.
8. Descartar o quitar la fecha requiere acciones explícitas. Las fechas imposibles o sin zona verificable no se presentan como instantes válidos.

## Límites funcionales
Se programa una próxima acción por contacto; no es un gestor de múltiples tareas, no asigna un responsable, no crea eventos externos, no envía mensajes ni dispara recordatorios. Las notas se guardan en el contacto.
La comparación previa detecta cambios conocidos, pero el backend no implementa compare-and-swap ni idempotencia en esta ruta. Puede existir una carrera entre dos operadores después de la comprobación. No se garantiza exactamente una escritura ante errores de red. La verificación posterior acredita el dato observado, no un historial inmutable.
El listado global selecciona contactos según el servicio existente; los filtros y conteos no incluyen contactos que no fueron devueltos. Las fechas se editan en la zona del navegador y se envían como instantes UTC.

## Validación ejecutada
- TypeScript y suite completa local: **3285 pruebas aprobadas en 412 archivos**, cero fallidas o pendientes. Son 53 casos nuevos respecto de la base publicada.
- Chromium a 1440×1000, 390×844 oscuro y 320×740: tres recorridos aprobados, con cancelación, una sola solicitud de guardado, recarga, conflicto previo, retiro tras denegación, teclado, movimiento reducido y ausencia de desbordamiento. Datos y persistencia de estos tres escenarios son sintéticos.
- **10 pruebas HTTP e integración** ejecutadas sobre las rutas originales del backend `dd2747fb9395fe4803cea945c6979095134ad983`, con SQLite desechable y red externa bloqueada. Incluyen un recorrido Chromium que guarda desde la interfaz, vuelve a leer y recarga; luego se comprueba en la base la nota, fecha y un único evento adicional.
- La autenticación de administradores tenant utiliza el login original. La sesión de plataforma usa el emisor original con claims sintéticos y una allowlist local del entorno de pruebas. No verifica el proveedor Clerk externo. Se mantiene y prueba el rechazo del login por contraseña del SuperAdmin.
- Una prueba existente del SuperAdmin encontró dos apariciones válidas del nombre del contacto tras añadir la agenda. Se precisó el selector a la cabecera de contactos recientes y se añadió la comprobación del endpoint de la agenda. No se eliminó la prueba de respuestas fuera de orden ni se relajaron sus expectativas.

Comandos: `npm run typecheck`; `npm test -- --maxWorkers=4`; `node tests/followup-workspace.browser.mjs`.
Aceptación integrada: `python tests/followup-backend-http.py --backend <ruta-al-checkout-backend> --browser`. Requiere las dependencias de ambos repos y Chromium. Los scripts no cargan el archivo .env del desarrollador ni acceden a redes externas desde el backend de prueba.
El workflow `CRM persistent follow-up` ejecuta TypeScript, suite, build y navegador sintético. La aceptación Python con backend completo se ejecutó localmente y no se presenta como parte de ese job de CI.

## Entrega y siguiente dependencia
El resultado de GitHub Actions, SHA y deployment se registra en el PR. Publicar requiere comprobar la revisión compilada, rutas del backend, respuestas del deployment, ausencia de avance concurrente y rollback. No se cambian credenciales ni permisos de producción, canales, números o bases de clientes.
Este bloque reutiliza el contrato existente; no despliega código backend. No integra las ramas pendientes de encuestas/acceso Tierra del Fuego. El siguiente incremento debe abordar tareas y responsables persistentes como entidades propias, concurrencia e idempotencia backend, sin presentar esta próxima acción como un motor de automatizaciones.
