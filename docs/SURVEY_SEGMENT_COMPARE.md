# Comparación descriptiva de segmentos

Sprint del 23/09/2026, continuación de cobertura de campo. Bases de trabajo:
backend `d07d3401f4af4413fa0301416adf8fd843fc9bbe` y frontend
`8a19376acf40085491a9ebdc8e6a3480e8816a85`. Se conservan ambos repositorios
originales y los checkouts anteriores; no se recreó la aplicación.

## Problema y alcance

La API anterior devolvía `segment_a.stats` y `segment_b.stats`; la pantalla
esperaba `buckets`, con lo cual una comparación válida podía quedar vacía.
Además, el cálculo consultaba las últimas 500 respuestas y la pantalla no
enviaba sus filtros globales. La diferencia visual podía usar un cambio relativo
en lugar de una diferencia entre porcentajes.

El contrato `surveys.segment_compare.v1` vincula encuesta, tenant, origen,
filtros globales y filtros de cada grupo. Devuelve bases explícitas, solapamiento
y opciones por pregunta. Los agregados abarcan las respuestas seleccionadas;
los detalles repetidos no multiplican una selección de la misma respuesta.
Las selecciones incompatibles de una pregunta de opción única se excluyen de
esa pregunta y se informa su cantidad. Las sugerencias de grupos también se
obtienen de la base completa, con una cantidad acotada de opciones por dimensión.
Cada porcentaje usa su propia base de respuestas válidas por pregunta; la
diferencia es **A menos B, en puntos porcentuales**. Si no hay base, el
porcentaje y la diferencia quedan sin valor, no se convierten en cero.

La pantalla verifica el contrato y deja de mostrar resultados anteriores durante
la actualización o ante un error de acceso. Los textos del informe provienen del
servidor; no se personalizan componentes para un municipio.

Esto describe respuestas registradas. No mide representatividad, causalidad,
significación estadística ni tasa de respuesta. No determina si una persona fue
invitada, contactada, elegible o rechazó participar. La selección múltiple puede
superar 100% al sumar opciones. Los grupos pueden compartir respuestas.

## Validación reproducible

`tests/run_segment_compare_browser.py --frontend <checkout-frontend>` inicia
la aplicación Flask y la SPA originales con cuentas y SQLite desechables.
Comprueba la comparación SÍ/NO (75% frente a 25%, diferencia 50 p.p.), filtro
territorial (50% frente a 50%, diferencia 0 p.p.), grupos solapados, recarga,
ausencia de resultados antiguos al cambiar de encuesta y navegación por teclado
en anchos 1440, 820, 390 oscuro y 320. Bloquea conexiones externas y verifica
que no cambian cuestionarios ni respuestas.

Aceptación local final: 14 pruebas HTTP originales y 87 regresiones backend
aprobadas; frontend completo 3487 pruebas en 434 archivos, sin fallidas ni
pendientes. Tipos general/scope, guard de rutas y build aprobados. Los cuatro
recorridos completos del comparador y los cuatro de regresión de cobertura
pasaron. Se inspeccionaron capturas de escritorio y móvil oscuro.

El recorrido completo detectó y permitió corregir el rechazo del alias `tenant`
que el cliente envía junto con `tenant_slug`: se aceptan cuando coinciden; si
son contradictorios, se rechazan antes de consultar. Las cuatro pruebas nuevas
de integración de página requirieron usar el router real, porque el harness
global omitía el identificador de encuesta. No se redujeron los controles para
que pasaran. Un primer proceso Node 24.15.0 abortó con un error nativo de Windows;
la aceptación final usó el runtime disponible Node 24.19.0.

La aceptación local no certifica concurrencia PostgreSQL, sesiones productivas,
WhatsApp entregado ni una instalación en dispositivos físicos. La evidencia
está en `C:/Temp/chatboc-fieldwork-20260923/evidence/` y en
`frontend/test-evidence/segment-compare-full/results.json`. Los PR registran el
estado remoto por separado. Este sprint no promueve producción, migra bases,
envía mensajes ni modifica el acceso de Agente Conversa.

Las bases, conflictos, celdas y canales de cada comparación se obtienen en una
sola sentencia SQL. Las etiquetas/estructura del cuestionario se consultan por
separado: no se certifica una revisión estructural inmutable ante una edición
simultánea de cuestionarios legados. La compilación del SQL para PostgreSQL no
reemplaza una prueba de concurrencia en ese motor.

## Continuidad y próximo corte

Se priorizó este defecto del recorrido existente antes del registro de
disposiciones. El inventario confirmó que `CampaignPreparation` y
`CampaignDeliveryIntent` representan preparación sin envío; no prueban contacto
ni invitación y no tienen un vínculo durable con una encuesta. Los grants de
elegibilidad tampoco equivalen a personas invitadas o población elegible.

El próximo corte debe definir ese vínculo y el registro versionado de
disposiciones con actor, motivo y auditoría, reutilizando contactos y campañas.
La ficha metodológica conserva su activación y migración pendientes. No se
ejecutan migraciones ni se activan proveedores como parte de esta comparación.

## Acceso de Tierra del Fuego comprobado

El 23/09/2026 se verificó `https://agente-conversa.vercel.app/`: acceso de
demostración de Mesa Única de Discapacidad. Página y estado público respondieron
200; el menú sin sesión respondió 401. La pantalla requiere las credenciales
de evaluación existentes. Versión servida `39f957900540e33d6f66123534f5f19eb84ae03d`,
despliegue `dpl_CxYFwUrmFgpKpPTmtfqsMHFqc2RC`.

Permite orientación y derivaciones simuladas. No conecta WhatsApp real ni
registros oficiales. Ese acceso no incorpora automáticamente este sprint de
analítica de ChatBoc. Se conservaron credenciales y alias sin modificación.
