# Encuestas: evidencia analitica y continuidad de consultoria

## Sprint actual: base de medicion visible

Continua el SaaS compartido y los cortes previos de seguridad del cierre/borrado.
No crea una nueva plataforma ni sustituye la operacion por organizacion.

Implementado en este corte:
- Corregir tasa_completitud: el contrato canonico usa puntos porcentuales 0..100.
  Un valor0.5 es0.5%, no50%; un1 es1%, no100%. Valores invalidos y base vacia
  no se convierten en porcentajes plausibles mediante clamp o ceros de respaldo.
- Contrato autenticado surveys.analytics_evidence.v1 construido en backend,
  sin nuevas consultas. Usa el mismo resumen y los mismos filtros autorizados.
- Tarjetas que distinguen conteos observados de completitud estimada sobre
  respuestas recientes. El limite de lectura es tecnico, no un diseno muestral.
- Identidades diferenciadas no se presentan como personas unicas verificadas.
- Detalle de registros seleccionados/revisados, exclusiones por origen,
  presencia de filtros sin sus valores y limites de interpretacion.
- Lectura responsive, modo claro/oscuro, detalle por teclado y movimiento reducido.
- Validador de DTO, tenant/instrumento y denominadores; retiro de la nueva ficha
  mientras su fuente esta recargando o fallo. No certifica la cache anterior.

La ficha dice explicitamente que estos agregados no autorizan inferencias a una
poblacion. No fabrica margen de error, intervalos, tasa de respuesta o abstencion.
No agrega ponderacion estadistica. El SHA de la ficha identifica el contenido
publicado, NO una firma digital o certificado metodologico.

## Contratos y privacidad

La ficha se adjunta solo a summary/resumen y modules.summary de dashboard/tablero
administrativos, despues de los permisos existentes. No se inserta en servicios
compartidos con encuestas publicas o en resultados live con supresion de celdas.
No se copian textos de respuestas, emails, identificadores individuales o valores
de filtros. No hay un nuevo boton de exportacion que saltee los permisos/auditoria
existentes. Los productores de datos y las reglas de exclusion no se modifican.
Los textos vienen del backend; ningun municipio o empresa esta hardcodeado en UI.

El backend devuelve ausencia de ficha ante datos inconsistentes o no verificables.
El frontend reconstruye solo propiedades aprobadas, comprueba numeros y contexto,
y conserva compatibilidad con un backend anterior sin este contrato.

## Validacion y limites

Las pruebas puras del builder cubren datos completos/parciales/vacios/sinteticos,
numeros invalidos, aislamiento del alcance, denominadores y ausencia de inferencia.
Las pruebas HTTP usan create_app, login, modelos, permisos y rutas originales
contra SQLite e identidades desechables. Comprueban200 respuestas y1completa =>0.5%,
las ocho rutas de resumen, el bundle, denegaciones401/403,404 y filtros.
Los cinco recorridos visuales usan el componente real y fixtures generados por el
builder de backend. La red externa queda bloqueada; los imports de Google Fonts
de la hoja global usan fuentes de sistema en esa prueba. No se afirma que esos
recorridos sean una sesion autenticada completa en el navegador o dispositivos fisicos.

Los resultados finales, commits y archivos de evidencia se registran en los PR.
No hubo datos de clientes, mensajes de WhatsApp, aprobaciones Meta o migraciones
como parte de este sprint. La publicacion productiva conserva su cierre separado.

## Secuencia de investigacion aplicada que sigue pendiente

1. Registro metodologico por estudio: proposito, responsable, universo, marco,
   reclutamiento, modos, fechas, cuestionario versionado, idiomas e incentivos.
   Datos no aportados se muestran como faltantes, nunca inferidos por el agente.
   Cierre: persistencia/auditoria/roles y ficha reproducible ligada a la version.
2. Operacion de campo: disposicion de casos, contactos, elegibilidad, completados,
   rechazos y duplicados. Separar satisfaccion de servicio, participacion abierta
   y estudio inferencial. Cierre: cada tasa con numerador/denominador definidos.
3. Calidad revisable: alertas explicables, origen, consistencia, tiempos y revision
   humana; exclusiones versionadas sin borrar originales ni penalizar a colectivos
   por un score. Cierre: motivo/autor/fecha y comparacion antes/despues.
4. Analisis estadistico gobernado: cruces y series con bases minimas; pesos,
   calibracion y medidas de incertidumbre solo con diseno/modelo documentado.
   Cierre: metodos verificados, supuestos, bases efectivas y limites publicados.
5. Entregables de consultoria: informe ejecutivo y tecnico white-label, referencias
   al estudio y a cada cifra, exportaciones autorizadas y registro de revisiones.
   Cierre: misma version/datos para panel e informe, sin conclusiones inventadas.

## Comparacion externa que orienta el plan, no certificacion

AAPOR Transparency Initiative pide divulgar reclutamiento, origen sintetico,
precision justificada, ponderacion, controles y limitaciones. Esto inspira la
separacion de base tecnica/diseno muestral; este sprint no implica membresia,
certificacion ni cumplimiento completo de la iniciativa.
https://aapor.org/standards-and-ethics/transparency-initiative/

Qualtrics documenta diagnosticos de calidad y distingue respuestas preview/test/
sinteticas. Se toma como referencia para revisar antes de analizar; no se afirma
haber replicado su deteccion de bots, sus productos o todos sus procedimientos.
https://www.qualtrics.com/support/survey-platform/survey-module/survey-checker/response-quality/

Conservar los planes previos del proyecto: docs/FRONTEND_UXUI_ENCUESTAS_TASKS.md,
y en frontend docs/analytics_frontend_backend_audit.md. Este archivo agrega la
fase de evidencia sin reemplazar ni declarar terminadas las fases futuras.


## Continuidad: registro metodologico implementado

El modulo de declaraciones versionadas se describe en [SURVEY_METHODOLOGY.md](SURVEY_METHODOLOGY.md).
La persistencia, auditoria, historial y formulario fueron implementados con activacion
explicita pendiente de migracion/rollout. No se declara cerrada la verificacion
metodologica, operacion de campo o inferencia estadistica por este avance.

## Continuidad: cobertura para segmentar

El sprint documentado en [SURVEY_FIELDWORK_COVERAGE.md](SURVEY_FIELDWORK_COVERAGE.md)
agrega presencia y ausencia exactas de datos por dimension sobre las respuestas
filtradas, y corrige la conexion de los filtros territoriales. No sustituye el
registro de contactos/disposiciones de campo ni calcula tasas de respuesta.
