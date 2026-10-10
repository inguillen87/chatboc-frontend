# Centro de decisiones: navegación, fuentes y actualizaciones coordinadas

Base de producción: ac064aa5183c2181e7b2e56a841b3baf892bfaa8 (PR 1771).

## Cambios implementados

El centro operativo compartido incorpora navegación por resumen, reclamos, encuestas/canales, equipo, mapa, acciones e integraciones IA. Los accesos trasladan el foco al bloque existente; no escriben registros ni cambian la organización.

El panel de fuentes distingue consultas pendientes, respuestas disponibles, ausencia de publicación y errores. Muestra la hora de lectura, no una afirmación de actualidad de los registros originales. Los filtros territoriales se identifican como exclusivos del mapa; el período se comparte con el resumen. Los hotspots globales dejan de mezclarse con un mapa segmentado.

La sesión operativa requiere la organización del contexto de la aplicación. No toma un slug residual de localStorage. Al cambiar organización se reinician filtros y solicitudes de la vista. Ocho respuestas API verifican el tenant declarado antes de normalizar; si una respuesta no declara tenant, la autorización sigue dependiendo del servidor. Las respuestas incompatibles o fallidas no mantienen datos anteriores en pantalla.

Los eventos se agrupan durante 250 ms, con un lote de lectura en curso y como máximo otro pendiente. Sólo se aceptan eventos con organización explícita y coherente. Los eventos antiguos sin tenant dependen de la consulta periódica de respaldo, no de una invalidación global. Los eventos y consultas periódicas programados por este panel se pausan con la pestaña oculta; al volver se consolida una actualización. No se cancelan escrituras ni se cambian mensajes/canales.

## Validación

Cuatro regresiones nuevas se ejecutaron contra el panel anterior y fallaron: contexto no confirmado, respuesta extranjera, mapa privado retenido tras denegación y hotspots ajenos al filtro. Se restauró inmediatamente la implementación corregida. Las expectativas no se relajaron.

La prueba Chromium usa el panel, consultas y coordinador reales con transporte/socket y cartografía sustituidos. Ejecuta 1440x1000 claro, 390x844 oscuro y 320x740 claro: teclado/foco, overflow, estado por fuente, 50 eventos agrupados en una actualización, pestaña oculta sin nuevas lecturas y retiro del mapa después de 403. Axe cubre el nuevo panel de fuentes, no toda la aplicación.

Las cifras de suite, SHA, revisión visual y publicación se registran en el PR de este sprint. No se atribuyen resultados de la versión anterior al nuevo código.

## Alcance de entrega

Comparte implementación entre municipios y empresas, sin textos o lógica especiales para Junín o Tierra del Fuego. No altera sus URLs, números, credenciales ni configuraciones de tenant. No migra las ramas paralelas de encuestas/white label y no certifica sus recorridos autenticados. No se modifican datos de clientes.

El detalle de oportunidades/tareas persistentes, integración de ramas pendientes, nuevos conectores de redes sociales y una aceptación completa por cada cliente son trabajos distintos. Este sprint no afirma haber terminado todo el CRM ni haber superado comercialmente a la competencia.
