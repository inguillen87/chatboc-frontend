# Encuestas y consultoría: cobertura para segmentar

Sprint del 23 de septiembre de 2026. Continúa `SURVEY_ANALYTICS_EVIDENCE.md`
y `SURVEY_METHODOLOGY.md` sobre el mismo producto y sus contratos existentes.

## Resultado del sprint

La analítica administrativa de cada encuesta muestra cuántas respuestas tienen
datos registrados para canal, campaña, género, rango etario, barrio, ciudad,
provincia, país y coordenadas. Cada dimensión declara numerador, denominador,
registros sin dato y porcentaje. Una selección vacía muestra ausencia de base,
no un 0% inventado. Los filtros existentes actualizan esa misma base.

La aceptación completa también corrigió un contrato anterior de filtros: el
frontend buscaba `clave/etiqueta` en dimensiones planas, mientras el servidor
publica `label/value` y territorios anidados. Ahora reconoce esos formatos,
preserva el término exacto y no usa el conteo como valor del filtro. Una lista
actual vacía no resucita opciones de un alias viejo.

El cálculo usa agregación SQL sobre las respuestas seleccionadas por encuesta,
organización, origen y filtros; no extrapola desde las últimas respuestas ni
desde los listados top-N. No devuelve valores individuales, textos de respuestas,
direcciones, teléfonos, identidades ni los valores de los filtros.

El alcance es presencia de datos para analizar. Un campo no registrado puede ser
opcional, no solicitado o anonimizado. No demuestra rechazo, abandono, mala
calidad de la persona ni incumplimiento. Coordenadas dentro del rango numérico
no prueban domicilio, jurisdicción, precisión ni consentimiento. El panel no
habilita por sí mismo mapas, exportaciones o decisiones sobre participantes.

## Contrato y límites

`surveys.fieldwork_coverage.v1` se adjunta como `fieldwork_coverage` a los resúmenes
administrativos y a `modules.summary` del tablero después de la autorización
existente. Mantiene el permiso de datos sensibles, el tenant y el instrumento.
No se adjunta a resultados públicos ni cambia los contratos de captura web o
WhatsApp. La UI recibe los textos del servidor y no personaliza organizaciones.

La base debe coincidir con la del resumen recibido. Datos contradictorios,
alcance inválido, recarga, error o mezcla con fallback sintético retiran la ficha.
No se rellenan inconsistencias con ceros. `response_rate` es `null` e
`inference_authorized` es `false`.

No hay nuevas tablas, migraciones, variables de entorno ni procesos de escritura.
La ficha metodológica anterior conserva su activación independiente y su migración
pendiente; este sprint no modifica ese control.

## Aceptación reproducible

- `python -m unittest tests.test_survey_fieldwork_coverage -v`
- `python -m tests.survey_fieldwork_coverage_http`
- `python -m tests.run_fieldwork_browser --frontend <CHECKOUT_FRONTEND>`
- Pruebas frontend de lector de contrato, componente e integración en analítica;
  comprobación de tipos, suite general y build del mismo lote.

El navegador abre la aplicación real, ingresa con cuentas desechables y consulta
Flask con modelos y permisos originales sobre SQLite aislado. Comprueba 2/8 = 25%,
el filtro territorial 2/4 = 50%, limpiar filtros, recargar, base vacía, teclado,
cuatro anchos y ausencia de escrituras. No simula las respuestas de API.
Las pruebas locales no certifican sesiones productivas, PostgreSQL, mensajes
entregados por WhatsApp ni dispositivos físicos.

El runtime de navegador desactiva explícitamente el fallback sintético opcional
de Vite desarrollo, igual que producción. La primera ejecución con ese fallback
fue rechazada por el panel como corresponde; no se relajó la protección.

## Continuidad reconstruida

Aceptación local final: backend 14 pruebas del contrato, 15 de HTTP original y
112 regresiones existentes aprobadas; frontend 3455 pruebas en 432 archivos,
sin fallidas ni pendientes, tipos general/scope y build aprobados. Los cuatro
recorridos completos del navegador pasaron; se inspeccionaron capturas de
escritorio y móvil oscuro. La consulta conservó los instrumentos y las ocho
respuestas de prueba. Los avisos heredados de deprecación/SQLite se conservan
en los logs; no se presentan como errores de ejecución ni se silencian.

Evidencia local: `C:/Temp/chatboc-fieldwork-20260923/evidence/` y
`frontend/test-evidence/fieldwork-full/results.json`. Las capturas son de datos
de prueba. Los PR indican separadamente el estado de los controles remotos.

Bases exactas del sprint: backend `9d978fe48bd9f62dd2263dbd7c98861110b6a0e7`,
frontend `5307ed78eec15fc76a5432d54757389faf39a751`. Se trabaja en checkouts
aislados porque la carpeta de cierre de metodología sigue recibiendo trabajo.
Se preservaron las carpetas OneDrive y sus modificaciones, los cambios locales
del 22 de septiembre y el cierre concurrente del 23.
Antes de la aceptación final se incorporó por avance directo, sin duplicarlo,
el cierre frontend `380dfe203a4ab7854684cba482c600ffb2362d84` que corrigió la
navegación inicial de configuración. Es la base final del frontend de este lote.

Auditoría remota del 23/09: `chatboc.ar` y `www.chatboc.ar` apuntaban al frontend
`9d85b481b026484dec0042b0b4193aac8c734e31`; la API directa y el proxy público
servían `912446bf96f8330664a9dec009ae57dbf935c73c`. El Preview backend observado
servía `d0a7f11ec44abb32531baedcc2cc3387cb5861cf` tras dos respuestas 503 y una
200; el frontend candidato `344528986bf280d2de8b4bbd5b22f0accba6e539`
consultaba todavía la API productiva. No representan una pareja validada para
este sprint. Un deployment marcado Production no demuestra que los dominios
públicos apunten a él.

Los PR de release heredados #2796 backend y #1762 frontend estaban en borrador.
Persistían detecciones históricas de GitGuardian en fixtures de pruebas y un
fallo frontend de navegación inicial que otro trabajo estaba corrigiendo.
No se silencian esos controles ni se reescribe su historia. Este lote se publica
como PR apilado después de la validación local, sin disparar despliegues manuales.

## Referencias y siguiente sprint

[Qualtrics Distribution Summary](https://www.qualtrics.com/support/survey-platform/distributions-module/distribution-summary/)
separa las medidas de distribución según sus denominadores.
[AAPOR Standard Definitions](https://aapor.org/standards-and-ethics/standard-definitions/)
requiere disposiciones de casos para definir tasas de resultado. Se toma esa
distinción como referencia de diseño, sin afirmar equivalencia o certificación.

Siguiente sprint: registro versionado de disposiciones de campo (invitado,
contactado, elegibilidad, completo, parcial, rechazo y otras situaciones), con
motivo, actor, auditoría y reglas explícitas por canal. Solo después se podrán
calcular tasas con sus denominadores documentados. Este monitor no cierra ese
registro de casos. Siguen después calidad revisable, cruces con bases mínimas,
informes white-label trazables y asistencia analítica de IA sobre evidencia.
