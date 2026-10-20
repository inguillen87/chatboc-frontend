# Carrito compartido: orden de respuestas, aislamiento y controles de compra

Base en GitHub: `ed55a11d748f4d05641f0aaa7c9c5c4cde34530f`, PR #1795, todavía no desplegada al iniciar este bloque. Producción observada: `aabfa1a6ff575014674801abf3d9a4627330dfaf` (#1794).

## Cambios

- Una lectura anterior no puede sobrescribir la cantidad, total ni capacidades que confirmó una incorporación posterior. Sus errores tampoco borran la respuesta actual ni cambian el indicador de actividad de una operación más nueva.
- Se agrupan las consultas repetidas en curso. Una actualización explícita solicitada durante una incorporación espera a que termine la escritura y luego obtiene una lectura actual; varias solicitudes de actualización comparten esa lectura.
- La incorporación tiene bloqueo síncrono antes de que React deshabilite el botón. Un segundo intento mientras existe una escritura pendiente devuelve false sin enviarse ni encolarse. Otra acción deliberada después de terminar sigue permitida.
- El proveedor aplica su propia clave por organización y habilitación, de modo que catálogo y ficha de producto no dependan de que cada consumidor recuerde agregar una key. Las respuestas retiradas no actualizan la vista ni escriben su caché local. Los callbacks antiguos quedan inactivos.
- En rutas administrativas, de analítica o municipales protegidas por esta regla, incluidas `/t/<tenant>/...`, no se lee ni modifica el carrito público. Las identidades vacías o malformadas tampoco acceden al caché ni a la red.
- El caché del navegador se lee una vez por montaje como borrador de presentación, nunca como identidad de cliente, habilitación de pago o autorización de checkout. Valores malformados no rompen el proveedor. La lectura inicial mantiene los controles bloqueados hasta disponer de una respuesta actual.
- Un error actual retira artículos, totales, perfil y capacidades de esa vista y reemplaza su caché por una presentación vacía sin importes; no borra el carrito del servidor. Una lectura posterior verificada recupera los datos.
- Los controles de cantidad de la ficha se bloquean durante la operación del carrito. Se corrigió el contraste del botón Agregar al pasar el puntero. El checkout no afirma Carrito vacío cuando lo que ocurrió fue un error de consulta; mantiene el resultado de checkout recibido independientemente de esa lectura.

## Verificación

Las primeras doce regresiones fallaron sobre la implementación anterior. Se extendieron con orden de lecturas/escrituras, StrictMode, desmontaje, callbacks retenidos, lecturas en cola, identidades inválidas, caché malformado y recuperación. Los casos de respuesta tardía esperan que la solicitud haya comenzado antes de retirar el proveedor; no confunden evitar iniciar una petición con descartar una ya enviada.

El nuevo navegador monta MarketProductPage, MarketCartProvider, apiClient y normalizadores reales con transporte sintético. Usa los botones existentes para agregar y cambiar cantidades; el cambio de organización es navegación de fixture. Los tres escenarios a 1440 px claro, 390 px oscuro y 320 px claro incluyen cuatro incorporaciones sintéticas cada uno, doble clic, controles pendientes, respuestas antiguas sin persistencia, error y recuperación. No se inicia una pasarela ni se realiza un cobro.

Las comprobaciones de navegador esperan la finalización de las respuestas retiradas antes de inspeccionar nuevamente la vista y el caché. Axe encontró contraste insuficiente en el hover del botón Agregar: se oscureció ese estado, sin retirar la comprobación. Los escenarios de 1440/390/320 volvieron a aprobar, sin errores JavaScript, desbordamiento ni incidencias serias/críticas en el panel comercial evaluado.

El checkout del corte anterior también volvió a aprobar sus tres recorridos, incluidas preferencia/enlace alternativos y conservación de su recibo ante un error al refrescar el carrito. La aserción adicional verifica que ese error no se presente como Carrito vacío. Las verificaciones unitarias fuerzan lecturas ya iniciadas antes de una escritura para probar el orden de llegada real, no sólo la cancelación previa a la red.

## Certificación local

Aprobaron TypeScript, 3884 pruebas en 447 archivos (35 nuevas respecto de #1795, sin fallidas ni pendientes), compilación de producción y los seis recorridos locales de producto/carrito y checkout. Los informes y capturas están en `.vercel/cart-evidence` y `.vercel/checkout-evidence`. La certificación de GitHub debe corresponder al SHA final de este PR; no se reutiliza la prueba de un candidato anterior.

## Límites y compatibilidad

- El guard impide escrituras simultáneas en una sesión del proveedor. No es idempotencia del servidor ni un bloqueo global entre pestañas, navegadores o proveedores distintos. Un usuario puede volver a intentar una incorporación después de una respuesta fallida; si el servidor ya la aplicó y se perdió la respuesta, reconciliar ese resultado exige soporte backend adicional.
- No se cancelan solicitudes ya enviadas ni se deshacen cambios en el servidor. Se retira exclusivamente su autoridad sobre el estado y la persistencia de la vista anterior. No se agregan reintentos automáticos del POST ni una cola de productos descartados por el bloqueo.
- Una consulta fallida deja de mostrar y conservar la copia local de ese carrito. Es una decisión explícita de recuperación, no una eliminación del carrito remoto. No constituye soporte offline de compra ni saneamiento global del almacenamiento del navegador.
- No se cambian endpoints, selección de contratos, nombres de campos, normalización monetaria compartida, stock, precios, pagos, permisos, sesiones autenticadas, cuentas o datos de clientes. Los errores actuales conservan el manejo existente de mensajes; este bloque no añade una política global de redacción de errores.
- Las cantidades positivas fraccionarias siguen permitidas por el contexto. La ficha mantiene sus límites publicados de unidades; no se introduce una nueva regla de inventario.

Se consultaron las referencias oficiales de React sobre limpieza de efectos, respuestas fuera de orden e identidad de componentes por key. El aislamiento se aplica en el proveedor compartido, no mediante suponer que todo consumidor futuro recordará reiniciarlo.

## Estado de publicación

El conector Vercel devolvió nuevamente 403 Forbidden al consultar el deployment del equipo `team_BV1xuY6BnEzGanfok8GAyjZv` / `marcelos-projects-c26aa499`. El error exige reautenticación o acceso al equipo. No se modificaron permisos, credenciales ni conexión, ni se intentó publicar por otra vía para eludirlo.

Una lectura pública de `/login` confirmó HTTP 200 y revisión `aabfa1a6ff575014674801abf3d9a4627330dfaf`. Por tanto, al iniciar la entrega siguen pendientes de producción tanto #1795 como este incremento. El registro `.vercel/cart-evidence/publication-blocked.json` conserva la comprobación; no hay un deployment ni una promoción de este sprint.

Después de restablecer acceso autorizado, la publicación debe crear el candidato del SHA aprobado, validar revisión/recursos/canaries y cotejar aliases antes de promover con rollback disponible. No se fusiona otra rama para forzar el despliegue. MuniControl no fue leído ni modificado.

## Revisión P2: compatibilidad con identificadores Unicode

La revisión de #1796 detectó que la validación ASCII añadida al proveedor bloqueaba identificadores válidos admitidos por la navegación pública, por ejemplo `peñalolén`. Se reprodujo con cuatro casos de compatibilidad que fallaron frente al primer corte; los ocho casos de estructura insegura permanecieron rechazados.

Se reemplazó la restricción local por `sanitizePublicInternalNavigationPath`, ya utilizado por la navegación del producto, con el tenant codificado como un único segmento. Se conserva intacta su identidad para API y almacenamiento. Las rutas con separadores, traversal, controles o texto no codificable siguen bloqueadas; no se agregó una excepción por municipio.

La regresión focalizada aprobó 100 pruebas de contexto, checkout y rutas. El navegador agregó navegación codificada, lectura e incorporación para el identificador Unicode y verificó que el almacenamiento y la API conservaran la identidad. El metadato de tenant del transporte sintético se codifica ahora al escribir su cabecera de QA y se decodifica en el servidor simulado: la cabecera anterior no conservaba los caracteres del escenario. No se modificó el transporte de producción para compensar un fallo del fixture.

Los tres escenarios volvieron a aprobar, ahora con cinco incorporaciones sintéticas por caso. El primer corte aprobado de 3884 pruebas no se considera certificación automática de este cambio: el SHA corregido requiere nueva suite completa y ambos workflows antes de una eventual publicación autorizada.
