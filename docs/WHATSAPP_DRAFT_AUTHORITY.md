# Autoridad de creación de borradores WhatsApp

Base: frontend 2b888471 (línea canónica de módulos #1756), backend f13cd73f (#2790).
El corte refuerza el gestor existente; no crea otra variante del catálogo ni un
proveedor WhatsApp nuevo. No modifica endpoints, dependencias o textos de UI.

Un callback de materialización conservado de un render anterior mantenía el valor
error anterior. Después de un fallo transitorio podía invocarse aunque el botón
visible ya estuviera deshabilitado. Un recibo exitoso tampoco actualizaba el ref de
catálogo hasta el render siguiente: una segunda invocación inmediata podía crear
otra identidad de operación antes de ver el estado materializado.

La autorización local ahora se retira sincrónicamente al leer/escribir, permanece
retirada tras resultados inciertos y sólo se restablece después de verificar el
catálogo/recibo. El ref de catálogo se actualiza antes de liberar la operación.
Los handlers conservados no pueden iniciar lecturas al desmontar la pantalla ni
usar un pack de una lectura anterior, aunque coincidan ID y versión. Las consultas
mantienen tenant explícito con persistTenantSlug:false, sin seleccionar un tenant
global como efecto secundario del panel.

La clave de idempotencia se conserva hasta un recibo válido. Releer no reintenta
una escritura; el operador debe volver a solicitarla. La autorización de servidor
sigue siendo independiente y obligatoria. El panel sólo crea borradores locales:
no envía mensajes, conecta números ni solicita aprobación de Meta/Twilio.

Diez regresiones nuevas cubren callbacks retenidos, fallos de lectura/escritura,
éxito antes de rerender, packs obsoletos, revocación y selección de tenant. Se
conservan los tests anteriores de reintento, ciclo A→B→A y permisos. La verificación
local sólo parsea/transpila TypeScript; no equivale a ejecutar React. La suite,
tipos y build se ejecutan en CI y sus resultados se registran en el PR al finalizar.

No publicado en Vercel por este commit. El conector sigue sin equipos accesibles;
no se reintenta Desktop Commander pausado por cuota ni se cambian permisos/gastos.
La aceptación HTTP nueva del backend se realiza por separado con datos desechables.
