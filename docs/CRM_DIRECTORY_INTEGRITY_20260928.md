# Personas 360: paginación verificable y recuperación del directorio

Base: `7ec4b6d7cb0a25658a363145de948904e31402bb`, PR #1793.
Alcance: consulta paginada de Personas 360, sin cambios en las APIs ni en los permisos.

## Bloque implementado

- Se comprueban límites y totales enteros seguros, coherencia entre cantidad de registros y paginación, identidad única por página y cursor de continuación válido. No se transforma un total malformado en una cifra ni se acepta una página vacía que promete seguir indefinidamente.
- La continuación debe corresponder al cursor aceptado, mantener contrato/límite/política de datos personales y no repetir identidades o cursores anteriores. Los ecos de organización y filtros, cuando están publicados, deben coincidir con la solicitud. No se exige inventar nuevos campos de respuesta.
- Una página denegada, malformada o contradictoria retira también la población anterior de esta consulta. El resultado imperativo no devuelve datos rechazados ni un botón lógico para seguir cargando. La recuperación explícita comienza en la primera página, sin reutilizar el cursor rechazado.
- Cada montaje y combinación de organización/filtros tiene un ámbito propio. Desmontar, deshabilitar o cambiarlo retira la consulta y descarta respuestas tardías. Los callbacks retenidos no vuelven a consultar una vista deshabilitada.
- Se conservan los 30 segundos de vigencia, la revalidación al recuperar foco y la lectura secuencial con cursores nuevos. Las llamadas inmediatas duplicadas a Cargar más comparten la solicitud en curso, sin añadir otra página duplicada.
- El fallback heredado se conserva sólo para el 404 inicial y mantiene todos sus registros protegidos. Un 404 de continuación no cambia a otro directorio para aparentar éxito. La política de enmascaramiento y los enlaces de casos siguen bajo las reglas existentes.

## Pruebas y recuperación

Se recuperaron dos archivos de trabajo pendientes en una rama nueva desde producción. Los originales en `chatboc-directory-pagination-20260928` permanecen sin cambios; sus hashes se registraron en `.vercel/directory-evidence/recovered-source.json`. Con sólo las regresiones recuperadas sobre la implementación publicada se observaron 4 aprobaciones y 17 fallos.

Se ampliaron pruebas de recarga multipágina, errores de continuación, PII revocada, página vacía válida, reinicio de filtros, desmontaje/remontaje, StrictMode, callbacks retenidos y regreso a la pestaña. Las aserciones del observador esperan su notificación; los resultados imperativos se comprueban directamente. TypeScript detectó que el tipo de refetch no declara hasNextPage; el resultado se calcula a partir de la última página comprobada, sin cast para ocultar el error.

El nuevo navegador renderiza UsuariosPage, Personas 360, hook, adaptadores y normalizadores reales. Sólo se sustituyen HTTP, sesión/rol/socket y un panel de campañas que no se utiliza en estos escenarios. No se sustituye el directorio por una lista artificial. Se revisan datos enmascarados, doble Cargar más, 403 durante recarga, identidades/cursor/PII/ámbito contradictorios, reintento, búsqueda con cursor nuevo y cambio de organización con una solicitud pendiente. La organización padre cambia mediante el fixture; eso no equivale a probar un login productivo.

## Límites preservados

Los cambios se limitan a la lectura del directorio y su ciclo de consulta. No agregan identidades, permisos, PII completa, rutas, campos comerciales, campañas, mensajes o escrituras. Los ecos de organización y filtros son opcionales: su ausencia no se reemplaza por una afirmación de autorización. El backend y la ruta autenticada siguen siendo la autoridad de acceso.

No se exige que el total permanezca idéntico entre páginas: puede variar con los datos del servidor. Se rechaza una continuación cuyo total sea menor que la población que intenta presentar. Sin un snapshot de servidor no se certifica una fotografía transaccional del directorio; un solapamiento producido por cambios concurrentes exige volver a consultar, no se oculta eliminando duplicados silenciosamente.

El transporte compartido no consume AbortSignal. Se utiliza la señal de TanStack Query para descartar resultados y retirar esta consulta; eso no implica detener el GET en red ni el trabajo del servidor. Se contrastó el comportamiento de paginación secuencial y cancelación con la implementación instalada de query-core y la documentación oficial, sin actualizar dependencias.

No se modificó backend ni se presupone que todos los tenants ya sirvan el contrato v2. Los archivos de CRM del backend de referencia se consultaron en modo lectura, sin publicar cambios ni atribuirles una implementación de directorio no encontrada en esa revisión. La compatibilidad heredada sigue cubierta por pruebas. Tampoco se modificaron sesiones, pagos, cuentas, datos de clientes, infraestructura o MuniControl.

## Publicación y evidencia

Se reutilizan los workflows existentes de CRM y rendimiento de arranque. CRM añade el nuevo guion y sus resultados al artifact, conservando seguimiento e historial. La protección de arranque/PWA sigue ejecutándose para cambios de src; no se recortan sus escenarios ni presupuestos.

La promoción exige fuente limpia, SHA local/remoto exacto, ambos workflows aprobados, artifacts abiertos y cotejados por digest, candidato Production READY sin asignación automática de dominios y canaries públicos antes y después. Preview permanece separado en `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX`; la base `dpl_J4RKmrGubQZFLZ5fjGogQk1xtoqW` se conserva para rollback.

Los resultados efectivos de CI y publicación se registran por revisión en el PR y `.vercel/directory-evidence/publication.json`. Los recorridos funcionales utilizan transporte/datos sintéticos; los canaries productivos son públicos y de sólo lectura. No se certifica navegación autenticada con contactos reales ni todos los módulos de CRM.

## Resultado local previo al commit

Aprobaron TypeScript, 3806 pruebas en 444 archivos (38 adicionales respecto de la base, sin fallidas ni pendientes), build de producción y el nuevo navegador. Los tres escenarios, 1440×1000 claro, 390×844 oscuro y 320×740 claro, realizaron 19 lecturas y cero escrituras cada uno. Se verificaron el retiro de datos, paginación secuencial, recuperación y cambio de ámbito; no hubo errores JavaScript ni desbordamiento. Axe no encontró incidencias serias/críticas en la barra de búsqueda/paginación evaluada; se revisó visualmente la captura móvil oscura.

La primera ejecución del fixture identificó un export faltante del límite de sesión (`resolveTenantSlug`) y no pudo montar la página; se completó sólo ese adaptador de prueba, manteniendo UsuariosPage y el directorio reales. No se alteraron producto, timeouts o controles de privacidad para obtener ese resultado.
