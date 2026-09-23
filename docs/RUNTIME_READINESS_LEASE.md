# SS-RUNTIME-PAIR: disponibilidad temporal y revisión de backend

Base: f88dd5f. Se conserva apiFetch y sus permisos, tenant y acciones existentes.
No cambia Agente Conversa ni conecta WhatsApp. No agrega dependencias.

## Defecto corregido

backendBootstrapGate guardaba indefinidamente la promesa resuelta de /api/version.
Una pestaña que volvía después de inactividad no verificaba nuevamente el servicio,
aunque éste hubiera escalado a cero o cambiado. Ahora la observación dura 30
segundos desde que se confirma; sólo se revalida cuando aparece otro llamador.
No hay polling durante inactividad ni cron nuevo. Los llamadores simultáneos
comparten la misma verificación. Una vuelta atrás del reloj invalida la observación.
Un fallo antiguo no borra una comprobación nueva después de limpiar el estado.

No es una reserva de capacidad ni elimina los cold starts del servidor. Otra
instancia puede estar fría aunque se haya comprobado una instancia recientemente.
Sólo GET /api/version puede repetirse y únicamente ante el contrato explícito
application_initializing. No se reenvían POST, PUT, PATCH, DELETE o mensajes.

## Release coordinada

VITE_EXPECTED_BACKEND_REVISION permite fijar un SHA exacto de 40 caracteres en
un build QA controlado. Una respuesta 200 de otra revisión no libera la espera:
se informa backend_revision_mismatch. Un éxito sin pin no satisface una petición
con pin. Sin esa variable, se conserva el contrato anterior. No se inventa una
revisión por defecto ni se apunta a producción como alternativa.

El pin NO activa por sí mismo el gate: se conserva VITE_BACKEND_BOOTSTRAP_GATE_ENABLED
y la activación por defecto en *.vercel.app. En un dominio white label debe
configurarse explícitamente. La presentación institucional y el shell sin conexión
conservan la excepción existente.

Parámetros no finitos o intentos fraccionarios se rechazan antes de consultar.
Antes, NaN en maxAttempts podía saltear todo el bucle y aparentar disponibilidad.
Se mantiene la espera acotada, el límite de reintentos y el rechazo de errores
503 genéricos, fallos terminales o una respuesta ajena al contrato.

## Verificación y publicación

Regresiones nuevas de caché, concurrencia, versión y parámetros inválidos, junto
con las pruebas originales del gate. CI focal comprueba tipos y build generales;
no se presenta como una nueva ejecución de todas las 3.026 pruebas del producto.
El check local transpila los módulos reales con un adaptador de entorno/presentación;
la CI utiliza Vitest y la configuración real del repositorio.

Backend coordinado: scripts/verify_paired_preview.py verifica versiones a través
del frontend, no sólo el backend directo. Su evidencia no autoriza promoción ni
reemplaza login/MFA institucional. No se desplegó este corte: faltan acceso Vercel
del equipo y conexión de la PC que tenía la CLI autorizada. Los aliases y los
bloqueos remotos se conservan; el 503 de arranque sigue pendiente de medición.
