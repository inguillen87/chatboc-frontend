# Analítica geográfica operativa — 24/09/2026

## Base y alcance
Base publicada: `6e2f33f8adec2e12f379734c1700dcd3fabad4b9` (PR 1773), deployment `dpl_Hh3TbeVXPsMv2LWFTJL9PT7az71m`.
Se mejora la vista compartida `AnalyticsPage → HeatmapDashboard` sin clonar componentes por organización. Junín, Tierra del Fuego y otras organizaciones consumen el mismo código según permisos, datos y configuración del backend.
No se integran automáticamente las ramas de encuestas/segmentación/acceso 1762–1765. No se crean usuarios ni números WhatsApp, no se cambia el backend, no se migran datos y no se modifican las URLs de los white labels.

## Implementado
- Cabecera con organización/período, filtros accesibles, aplicación explícita y estado de consulta; métricas de cobertura separadas de elementos geográficos visibles.
- Barras por categoría, distrito, canal y fuente cuando el servidor publica conteos válidos. Seleccionar una barra consulta su clave real, no su etiqueta de presentación.
- Separación de filtros de servidor y filtros visuales de estado/severidad. Un resultado sin coincidencias queda vacío: nunca repone puntos, celdas o GeoJSON de la selección anterior.
- Respuestas tardías no cruzan sesiones de organización/período/filtros. Cualquier error retira mapa, métricas y distribuciones previas.
- La ruta de mapas usa resolución estricta del hub: 401/403 y errores de servicio no provocan lectura alternativa ni reutilización de caché antigua. Otras llamadas legacy al hub no cambian en este lote.
- Verificación de organización en el envelope y registros geográficos explícitos. La identidad canónica de tickets se conserva para las interacciones existentes del mapa, con el contexto de organización.
- Metadatos y privacidad sobreviven al normalizador. Si las coordenadas individuales están suprimidas, sólo se usan las celdas agregadas recibidas, sin reconstruir puntos ni mostrar la cola de direcciones.
- La cobertura en puntos porcentuales no se multiplica por 100. Conteos contradictorios o ausentes no se sustituyen por cifras inventadas.
- Corrección del adaptador: coordenadas vacías no se convierten en `0,0`.
- Diseño adaptable, temas claro/oscuro, teclado, objetivos táctiles, movimiento reducido y detalle de trazabilidad.

## Límites
Las barras describen conteos publicados, no personas únicas, representatividad ni tasas poblacionales. Los filtros contradichos por el servidor se rechazan; si no informa filtros aplicados, la interfaz los identifica como solicitados, no certificados.
Una celda no es un caso individual ni autoriza reconstruir su identidad. Las mutaciones permanecen en la ficha con los permisos del backend. La ubicación renderizada no certifica GPS, precisión de dirección ni ejecución de cuadrillas.

## Validación ejecutada
TypeScript aprobado. Suite local completa: **3232 pruebas / 408 archivos**, cero fallidas y pendientes; 52 casos nuevos respecto de la base publicada.
La regresión de coordenadas vacías falló con el adaptador anterior (generaba un punto `0,0`) y pasó después de la corrección sin eliminar comprobaciones.
Chromium: 1440×1100 claro, 390×844 oscuro y 320×740 claro. Los tres recorridos aprobaron filtros, teclado, cero coincidencias, privacidad agregada, retiro tras 403, ausencia de desbordamiento y movimiento reducido. Axe no detectó infracciones serias/críticas dentro del alcance evaluado.
El servicio analítico, normalizador, interfaz y renderer MapLibre son reales; transporte, datos y mapa base son sintéticos. Se bloquearon solicitudes externas y no hubo mutaciones. Esta evidencia no prueba autenticación productiva ni cobertura cartográfica real.
Comandos reproducibles: `npm run typecheck`, `npm test -- --maxWorkers=4`, `node tests/geo-workspace.browser.mjs`. Evidencia local en `.vercel/geo-evidence`; CI y publicación se registran por SHA en el PR.

## Cierre operativo y continuidad
Publicar exige build de producción verificado, revisión de respuestas del deployment, control de avance concurrente y conservación del rollback. No se debe relajar el guard de previews para obtener verde.
Después de este bloque: integrar de forma coordinada las ramas pendientes de encuestas/TDF; completar responsables, acciones y vencimientos persistentes del CRM; validar recorridos autenticados por organización y estado de entrega de mensajes. No se consideran terminados por enumerarlos.
