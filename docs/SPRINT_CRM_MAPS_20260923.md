# Sprint: CRM accionable y mapas sin telemetría ficticia

Base exacta: d3d536d52e822aa3e0d3b1cea7241df49ae2b60d (PR #1768). Este corte no incorpora las ramas pendientes de encuestas/Tierra del Fuego, no modifica números Meta, dominios, sesiones, roles ni registros de clientes. Los resultados de pruebas del corte anterior no certifican estos cambios: consultar CI y cierre del PR por SHA.

## Implementación

SuperAdmin → Organizaciones → Seguimiento comercial: indicadores sobre los casos cargados, gráficos de distribución por etapa y última actividad, filtros accionables, orden por antigüedad/nombre y vista de tablero. Las columnas incluyen etapas desconocidas en un grupo separado. El tablero abre la ficha verificada existente: no mueve casos por arrastre ni omite la confirmación del cambio de etapa. Se mantienen borradores y protecciones de identidad del corte anterior.

Los gráficos son componentes HTML/CSS accesibles con botones nativos y valores visibles. Respetan prefers-reduced-motion y data-reduce-motion. No se agrega otra librería de gráficos ni se hacen solicitudes extra al interactuar con gráficos, filtros o vistas.

La base de los gráficos es la selección cargada del endpoint limitado a 100, no el total global. El historial sigue limitado por el servicio existente. Distribución de etapas NO equivale a embudo de conversión. Una actividad de 7 días o más NO equivale a incumplimiento de SLA. Fechas futuras, imposibles, ausentes o sin zona horaria se clasifican como no verificables. La fecha de evaluación es explícita y se actualiza con una nueva lectura del listado. No se inventan ingresos, MRR, ARR, prioridades predictivas ni fechas posteriores a un guardado.

TrackingMap compartido: sólo recibe puntos geográficos válidos. Se elimina la posición de móvil interpolada desde el estado, el centro ficticio de Buenos Aires y las rutas/radares SVG decorativos. El marcador de móvil requiere coordenadas reales y el permiso de visibilidad correspondiente. No se dibuja una ruta vial que el servidor no haya suministrado. Si faltan puntos, no se inicializa el proveedor de mapas. Si falla, se conservan los puntos válidos en una alternativa textual. La atribución del proveedor queda habilitada.

Los cambios de etiqueta no reinician el proveedor ni recentran el mapa. Cambiar la preferencia de movimiento no cambia el encuadre; afecta sólo futuras transiciones geométricas. El componente admite etiquetas de presentación proporcionadas por sus consumidores y no contiene ramas específicas de Junín o Tierra del Fuego. Los valores por defecto son genéricos; este corte no implementa un contrato de branding completo ni una ruta real de reparto.

## Pruebas previstas en el workflow

Typecheck, suite completa y build, seguidos de Chromium a 1440, 390 y 320 px. El harness usa componentes y recibos del CRM reales con un transporte y respuestas HTTP sintéticos, bloquea llamadas externas y no usa credenciales ni datos de clientes. Verifica overflow, movimiento reducido, barras mediante teclado, tablero, borrador al cancelar cierre y una nota dirigida al ID interno correcto. Axe comprueba infracciones serias/críticas en el diálogo. Capturas y JSON se conservan en el artifact commercial-insights-evidence durante 7 días. Esto NO acredita acceso Google, backend productivo ni visualización de mapas CARTO en campo.

## Continuidad del plan (pendiente, no declarada implementada)

1. Cierre de integración/producción: resolver autorización del scope de Vercel, revisión visual y sesión real, comprobar contratos HTTP y despliegue por SHA sin debilitar guards de preview. Desktop Commander estaba offline y Vercel devolvió 403 en esta sesión.
2. CRM completo: oportunidades independientes de reclamos, responsables, tareas y vencimientos persistentes, agenda, segmentación y pipeline global migrado. Antes de automatizar escrituras, idempotencia y control de concurrencia en backend. MRR/ARR sólo desde facturación verificable.
3. White label Junín/Tierra del Fuego: diccionario y navegación desde contratos backend, identidad visual, permisos y paridad móvil. Conservar las dos URLs/versiones actuales de TDF y el enrutamiento/números de Junín; no provisionar ni migrar números durante este sprint.
4. Encuestas y calor territorial: integrar las ramas pendientes con denominadores explícitos, filtros geográficos coherentes, privacidad espacial, cobertura real y estados de proveedor. No confundir respuestas recibidas con representatividad estadística.
5. Empresas/marketplace: estados de pedido, pago y entrega separados; transiciones permitidas por servidor, detalle/evidencias y seguimiento público privado por contrato. El mapa corregido no sustituye una integración GPS ni calcula ETA.
6. Reclamos: timeline, responsable, SLA real, anexos y notificaciones trazables. No reutilizar etapas comerciales como estados operativos sin un contrato explícito.

El sprint se entrega como código y evidencia verificable. El estado de producción se informa por separado; que compile no significa que esté desplegado.
