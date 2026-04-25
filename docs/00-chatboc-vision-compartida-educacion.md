# Chatboc.ar - Vision compartida para educacion
## Objetivo

Transformar chatboc.ar de "bot de WhatsApp" a SaaS CRM/AI educativo con cuatro superficies separadas:
1. Backoffice operativo del colegio.
2. App portal de familias.
3. App portal de alumnos.
4. Canales conversacionales y comerciales: WhatsApp, widget web, voz y tienda escolar.

El producto ya tiene una base util: multi-tenant, tickets, chat, catalogo, embeddings, realtime y voz. El error seria pegar encima una capa escolar sin separar ownership, roles, contratos ni experiencia por canal. Este paquete divide el trabajo para backend y frontend y agrega un marco comun para no romper la plataforma.

## Tesis de producto

- El canal WhatsApp es entrada, no producto completo.
- El admin del tenant debe operar como CRM/mesa de ayuda/centro de comunicaciones.
- El portal de familia y el portal de alumno deben ser apps aparte, no "una pantalla mas" del panel admin.
- El marketplace existente debe convertirse, por tenant, en una tienda o portal transaccional: cuotas, matriculas, uniformes, libros, talleres, viajes, eventos, cooperadora y catalogos propios.
- Analiticas, heatmaps, encuestas, reclamos, ubicaciones, resumenes IA y estados deben compartir el mismo modelo de eventos.
- La vertical educacion exige mas disciplina que pyme generica: datos de menores, consentimientos, auditoria, perfiles jerarquicos, comunicaciones oficiales y sensibilidad reputacional.

## Contexto sectorial que justifica el cambio

- Mendoza ya opera un ecosistema oficial de gestion educativa y comunicacion con familias, estudiantes y docentes. Eso marca el piso de expectativa del mercado: no alcanza con FAQ o respuestas automaticas.
- La DGE supervisa tanto establecimientos de gestion estatal como privada. El producto tiene que soportar ambos modos de tenant, con permisos y flujos distintos.
- El sistema escolar argentino mezcla comunicacion, documentacion, asistencia, autorizaciones, incidencias, pagos y seguimiento. Si chatboc.ar quiere vender en colegios, debe cubrir esas capas en comun.
- La proteccion de datos no es decorativa: la plataforma va a tratar identificadores, imagenes, telefonos, ubicacion, datos de salud, certificados, relaciones familiares y potencialmente datos de menores.

## Principios no negociables

1. **Admin separado del portal final.**  
   El panel operativo del colegio y la app de familias/alumnos no comparten navegacion ni semantica de UI.

2. **Contrato unico de identidad y tenancy.**  
   Sin roles, scopes y eventos unificados, se rompe el producto.

3. **Nada de analiticas fantasma.**  
   Todo KPI, heatmap, tabla, alerta y resumen IA debe derivar del mismo stream/event store.

4. **Nada de lenguaje heredado de otros verticales.**  
   "Municipio", "pyme", "rubro" o nombres de legacy no deben filtrarse en UI, payloads ni logs visibles para clientes.

5. **Mobile first para usuarios finales.**  
   Familias y alumnos usan celular; el panel admin puede ser desktop first, pero el portal no.

6. **Privacidad y auditoria desde el dia 1.**  
   No exponer casos sensibles a roles amplios; no geolocalizar menores por defecto; no dejar accesos sin trazabilidad.

7. **Slices cortos para los agentes.**  
   Cada PR debe tocar un bloque acotado. Nada de cambios gigantes mezclando auth, datos, UI y analytics.

## Productos/experiencias que chatboc.ar debe vender a colegios

| Superficie | Que resuelve | Usuario principal | Canal |
| --- | --- | --- | --- |
| School Operations OS | Inbox, tickets, reclamos, incidencias, asignacion, anuncios, encuestas, analytics, reportes | Directivos, secretaria, preceptoria, administracion | Web |
| Family App | Comunicados, autorizaciones, estado de tickets, pagos, tienda, encuestas, chat, documentos | Madres, padres, tutores | PWA / Web / WhatsApp deep-link |
| Student App | Agenda, comunicados, documentos, estado de tramites, tienda, encuestas, soporte | Alumnos | PWA / Web |
| Conversational Entry | FAQ, handoff, apertura de reclamos, consultas de calendario, admisiones, pedidos | Comunidad educativa | WhatsApp / Widget / Voz |
| School Store | Cuotas, matriculas, talleres, uniformes, libros, salidas, cooperadora, catalogos propios | Familias y alumnos | Portal + WhatsApp + widget |
| Copilot IA | Resumenes, respuestas guiadas, borradores de comunicados, clasificacion de casos, reportes | Personal del colegio | Admin web |

## Diferenciacion por tipo de colegio

| Capacidad | Colegio publico | Colegio privado | Nota |
| --- | --- | --- | --- |
| Reclamos y consultas por area | Muy alta | Muy alta | Base comun del producto |
| Comunicados oficiales y cartelera | Muy alta | Muy alta | Debe permitir acuse de lectura |
| Incidencias de convivencia / bullying | Alta | Alta | Visibilidad restringida |
| Mesa de ayuda de secretaria / preceptoria | Muy alta | Muy alta | Handoff humano + SLA |
| Inscripciones / admisiones | Media | Muy alta | Privados necesitan pipeline comercial |
| Pagos y cuotas | Baja / variable | Muy alta | Tambien sirve cooperadora o eventos |
| Tienda escolar | Baja / media | Alta | Uniformes, libros, talleres, viajes |
| Integraciones academicas | Alta | Alta | Import/export primero, conectores despues |
| Analytics ejecutiva | Alta | Alta | Directivos y dueños la necesitan |

## Roles compartidos que deben existir

- `superadmin`
- `tenant_owner`
- `director_rector`
- `secretaria`
- `preceptoria`
- `administracion_tesoreria`
- `admisiones`
- `orientacion_convivencia`
- `docente`
- `mantenimiento`
- `catalog_manager`
- `analytics_viewer`
- `family_user`
- `student_user`

Cada tenant debe poder crear empleados, asignarlos a campus/areas/categorias y definir reglas de derivacion por tipo de reclamo.

## Modulos verticales prioritarios

1. **Directorio escolar y contexto academico**  
   Sedes, niveles, turnos, cursos, divisiones, personal, familias, alumnos.

2. **Comunicaciones oficiales**  
   Circular, noticia, evento, recordatorio, emergencia, acuse de lectura.

3. **Mesa de ayuda y reclamos**  
   Secretaria, preceptoria, administracion, mantenimiento, tecnologia, convivencia, transporte, comedor.

4. **Encuestas y votaciones**  
   Satisfaccion, eventos, votaciones internas, sondeos a familias, feedback post-tramite.

5. **Portal familia/alumno**  
   Estado de reclamos, documentos, pedidos, comunicados, chat, pagos, catalogo.

6. **Tienda escolar / marketplace**  
   Catalogo por tenant para productos y servicios del colegio.

7. **Admisiones / inscripciones**  
   Captura de leads, agenda de visitas, checklist documental, seguimiento.

8. **Analytics + heatmaps + IA**  
   Volumen, horarios pico, categorias, campus, zonas, friccion, conversion, costos IA, resumenes.

9. **Conocimiento y RAG**  
   Reglamentos, calendario, requisitos, aranceles, FAQs, menus, protocolos, instructivos.

10. **Auditoria, consentimiento y privacidad**  
   Historial de accesos, consentimientos, retencion, exportes, masking y politicas.

## Roadmap comun recomendado

| Horizonte | Objetivo | Resultado minimo |
| --- | --- | --- |
| 0-90 dias | Base segura y operativa | Auth endurecido, AI gateway, RBAC, directorio escolar, inbox y routing, portal bootstrap, eventos unificados |
| 90-180 dias | Producto vendible al vertical | Family app separada, student app basica, anuncios, encuestas, tienda escolar, analytics y heatmaps, admisiones |
| 180-365 dias | Producto premium | RAG multi-fuente, multimodal, voz, integraciones, offline parcial, reportes IA y automatizaciones seguras |

## KPI de negocio y producto

- First response time por area.
- Tiempo de resolucion por categoria.
- Porcentaje de auto-resolucion sin humano.
- Porcentaje de comunicados con lectura o acuse.
- Participacion en encuestas y votaciones.
- Conversion de admisiones.
- Conversion y ticket medio de tienda escolar.
- Cobranza recuperada por recordatorios y links de pago.
- Volumen por canal y por campus.
- Casos sensibles abiertos/cerrados.
- Frescura de analytics: ultimo evento, ultima agregacion, stream online/offline.
- Costo IA por tenant, canal y flujo.

## Cosas que no conviene hacer ahora

- No meter calificaciones o boletines si no hay integracion confiable y consentimiento claro.
- No geolocalizar alumnos o familias por defecto.
- No construir una app unica para admin + familias + alumnos.
- No hacer voz browser/mobile en el primer sprint del vertical.
- No hacer integraciones profundas con sistemas oficiales sin capa de import/export previa.
- No mezclar encuestas, votaciones y autorizaciones en una sola entidad confusa.

## Reglas operativas para Jules y Codex

- Un PR = un slice funcional.
- Mantener compatibilidad con contratos existentes salvo versionado explicito.
- Agregar tests, migraciones y fixtures por cada nuevo modulo.
- No entregar placeholders, botones muertos ni pantallas vacias sin razon.
- Si un dashboard no tiene datos, debe explicar por que: sin eventos, sin permisos, sin rango, sin stream o sin configuracion.
- Toda nueva vista debe tener estados: loading, vacio, error, sin permisos y exito.
- El tenant demo de educacion debe existir para QA y demos comerciales.

## Fuentes base usadas para este brief

- Evaluacion tecnica de chatboc.ar (31/03/2026).
- Propuesta Instituto Sagrada Familia - Chatboc.ar (16/04/2026).
- DGE Mendoza y GEI/GEM como referencia de expectativa de mercado.
- Marco argentino de educacion y proteccion de datos personales.
- Documentacion oficial OpenAI para Responses, Structured Outputs y Realtime.