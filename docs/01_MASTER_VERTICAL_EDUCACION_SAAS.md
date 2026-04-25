# Vertical Educación para chatboc.ar
## Mendoza primero, Argentina después

## 1. Tesis de producto

La oportunidad real no es construir un ERP escolar completo. Eso te hunde en complejidad académica, integraciones eternas y bajo time-to-value.

La decisión correcta es otra:

**convertir chatboc.ar en el sistema operativo de atención, comunicación, conocimiento y operaciones de colegios públicos y privados**, reutilizando lo que ya existe:
- motor multi-tenant
- panel + widget embebible
- tickets + chat en vivo + timeline
- catálogo + embeddings + Qdrant
- voz realtime
- notificaciones y automatizaciones

## 2. Qué problema resolvemos en educación

### Público
- saturación de consultas repetitivas a secretaría y dirección
- comunicaciones a familias desordenadas
- reclamos de mantenimiento, convivencia e incidentes sin trazabilidad
- inasistencias y justificativos dispersos
- certificados y trámites lentos
- poca visibilidad de tiempos de respuesta y carga operativa
- necesidad de operar con celular, WhatsApp y conectividad imperfecta

### Privado
- todo lo anterior, más:
- admisiones y seguimiento comercial
- cobranza, recordatorios y convenios
- turnos con administración/tesorería
- campañas a familias y prospectos
- experiencia digital de institución “moderna” en sitio web y canales

## 3. Posicionamiento de chatboc.ar para escuelas

### Lo que sí somos
- asistente institucional del colegio
- mesa de ayuda omnicanal
- inbox operativo con IA
- hub de comunicaciones a familias
- portal de trámites y documentos
- front desk por voz y web
- capa de conocimiento institucional y normativa

### Lo que no conviene ser en V1
- sistema de notas/boletines completo
- LMS
- planificación docente completa
- ERP financiero profundo
- motor académico integral con horarios, actas y libretas como núcleo

Eso se integra o se posterga. En V1 hay que capturar la capa donde más duele: **fricción comunicacional + operaciones + atención + autoservicio**.

## 4. Segmentos objetivo

### A. Colegio público individual
Caso típico:
- una institución con alta carga administrativa
- familias consultando por horarios, requisitos, documentación, inasistencias, actos, comedor, transporte o convivencia

Producto recomendado:
- widget web institucional
- inbox de secretaría/preceptoría/dirección
- módulo de asistencia e inasistencias
- solicitudes de certificados
- campañas y comunicados con acuse
- knowledge base institucional

### B. Red escolar / supervisión / jurisdicción
Caso típico:
- varias escuelas bajo una dirección o administración central
- necesidad de métricas comparables, plantillas de políticas y auditoría

Producto recomendado:
- tenant raíz + escuelas hijas o sedes
- políticas por red
- reportes por escuela/sede
- dashboards de carga, cumplimiento y SLA
- catálogos de normativas y documentos compartidos

### C. Colegio privado
Caso típico:
- foco en comunicación, experiencia familiar, cobranza y admisiones

Producto recomendado:
- todo el paquete core
- admisiones
- cobranzas/notificaciones
- turnos
- campañas segmentadas
- FAQ comercial + institucional
- voz de recepción

## 5. Roles que el producto debe soportar

### Internos
- superadmin plataforma
- administrador de red educativa / holding / diócesis / grupo
- director / rector / representante legal
- secretaría
- preceptoría
- tesorería / administración
- equipo de orientación / convivencia
- docente
- operador de mesa de ayuda

### Externos
- tutor / madre / padre / responsable
- alumno (opcional, no prioritario en V1)
- prospecto de admisión
- proveedor / mantenimiento / transporte

## 6. Principio clave de identidad

En educación hay menores y datos sensibles. El sistema debe distinguir, como mínimo, estos estados:

1. **anónimo**
   - sólo accede a información pública del colegio

2. **familiar conocido**
   - existe coincidencia preliminar por email/teléfono/DNI pero no está verificado

3. **familiar verificado**
   - el colegio confirmó relación con alumno/s

4. **staff**
   - acceso interno según rol, sede, turno y área

5. **operador privilegiado**
   - puede ver casos sensibles y exportes

Sin esto, el vertical es inviable.

## 7. Módulos que recomiendo

## 7.1 Core escolar
- portal público con chatbot institucional
- inbox escolar por áreas
- knowledge base con respuestas citadas
- campañas/comunicados por curso, división, sede o nivel
- acuse de lectura y seguimiento
- turnos con secretaría/administración
- solicitudes de documentos
- escalado a humano

## 7.2 Operaciones escolares
- inasistencias y justificativos
- incidentes de convivencia
- mantenimiento y reclamos edilicios
- autorizaciones y retiros
- solicitudes internas del staff
- agenda/calendario escolar

## 7.3 Privados
- admisiones y preinscripción
- seguimiento de leads
- recordatorios de cuotas
- convenios y estados de gestión
- campañas de open day / inscripción

## 7.4 Premium
- voz recepción / central telefónica
- imagen → ticket (ej. mantenimiento, documentación)
- dashboards predictivos operativos
- offline-lite PWA
- integraciones profundas con sistemas externos

## 8. Diferencia pública vs privada

| Tema | Público | Privado |
|---|---|---|
| Canales | alta dependencia de web + WhatsApp + voz | web + WhatsApp + email + campañas |
| Prioridad | trámites, asistencia, comunicación, incidentes | experiencia familiar, cobranzas, admisiones |
| Estructura | más peso de sede/nivel/turno y supervisión | más peso de relación familia-cobranza |
| Métricas | tiempos de respuesta, carga operativa, trazabilidad | conversión admisiones, cobranza, retención, SLA |
| Riesgo | volumen + desorden operativo | expectativa de UX alta + sensibilidad comercial |

## 9. Reutilización inteligente de chatboc.ar

### Reusar sin reescribir
1. **tickets actuales**
   - convertirlos en “casos escolares”
   - tipos: administrativo, asistencia, convivencia, mantenimiento, documentación, cobranza, admisión

2. **catálogo + Qdrant**
   - reutilizar como base de conocimiento escolar
   - manuales, reglamentos, calendario, aranceles, formularios, FAQs

3. **widget embebible**
   - ponerlo en sitio del colegio
   - modo público por defecto
   - exigir verificación para hablar de un alumno concreto

4. **voz realtime**
   - recepcionista virtual del colegio
   - horarios, requisitos, turnos, pase a humano

5. **analytics**
   - ampliar hacia métricas escolares

## 10. Mejoras proactivas que agrego

### A. Grafo tutor-alumno
No basta con “usuario”. Educación necesita una relación:
- un tutor con varios alumnos
- un alumno con varios tutores
- alumnos en distintas sedes o niveles
- permisos por relación y por tipo de trámite

### B. Sobre cerrado de sensibilidad
Toda conversación, documento o ticket debe poder clasificarse:
- público
- interno
- familiar
- sensible
- crítico

Eso gobierna:
- quién ve
- quién exporta
- si puede aparecer en widget
- si puede ser resumido por IA
- si requiere aprobación humana

### C. Campaigns con acuse
No alcanza con mandar mensajes.
Hace falta:
- segmentar por curso/división/sede
- acuse leído/no leído
- reintento por canal
- resumen IA de respuestas
- exportable

### D. Document factory
Trámite típico escolar:
- “necesito certificado de alumno regular”
- “necesito constancia de cuota”
- “necesito copia de reglamento”
- “necesito justificar inasistencia”

Esto debe tener:
- plantilla
- estado
- SLA
- validación
- descarga segura
- notificación cuando esté listo

### E. Front desk de voz
Escuelas reciben llamadas repetitivas:
- horarios
- documentación
- aranceles
- ubicación
- pases a secretaría
- confirmación de turnos
- estado de trámites

Tu stack de voz ya te da ventaja acá.

### F. Admission funnel
Para privados:
- chat de admisiones
- captación desde el sitio
- clasificación de interés
- agenda de visita
- seguimiento comercial liviano
- FAQs de propuesta educativa

### G. Gestión de retiro / autorizaciones
Muy valioso y poco resuelto:
- quién puede retirar al alumno
- autorización vigente/no vigente
- evidencia documental
- alertas a portería/preceptoría

### H. Modo conectividad irregular
En muchas escuelas y sedes no conviene depender de señal perfecta.
Necesitás:
- PWA
- cola de acciones
- caché de conversaciones recientes
- fallback a canales asincrónicos

## 11. Roadmap recomendado

## Fase 0 · endurecimiento de plataforma
Objetivo:
- dejar lista la base para una vertical sensible

Entregables:
- JWT/JWKS robusto
- auditoría
- moderación
- AI gateway unificado
- RBAC más estricto
- aislamiento por tenant y vertical

## Fase 1 · foundation educación
Objetivo:
- abrir el vertical sin romper la SaaS actual

Entregables:
- modelo escuela/sede/nivel/división
- grafo tutor-alumno
- comunicaciones e inbox escolar
- KB escolar con citas
- verificación de familiar
- documentos/trámites base
- taxonomía de casos escolares

## Fase 2 · operaciones
Entregables:
- inasistencias y justificativos
- convivencia/incidentes
- mantenimiento escolar
- campañas con acuse
- calendario y turnos
- dashboards operativos

## Fase 3 · premium
Entregables:
- admisiones
- cobranzas privadas
- voz recepción
- imagen → ticket
- offline-lite
- integraciones con ERP/SIS externos

## 12. KPIs que importan

### Públicos
- tasa de autoservicio
- reducción de consultas repetitivas
- first response time
- tiempo de cierre por tipo de caso
- % comunicados leídos
- % justificativos procesados dentro de SLA
- backlog por escuela/sede

### Privados
- tasa de respuesta de familias
- admisiones captadas por canal
- conversión de lead a visita
- mora gestionada con éxito
- tiempo de emisión de certificados
- satisfacción de familias

## 13. Qué no permitir en la ejecución técnica

- no abrir datos de menores en widget anónimo
- no mezclar memoria ni caché entre colegios
- no permitir a IA responder temas sensibles sin verificación
- no meter toda la lógica escolar en prompts
- no crear 15 microservicios nuevos
- no reescribir backend o frontend de cero
- no convertir el panel actual en un laberinto genérico

## 14. Decisión táctica importante

**La vertical educación debe entrar como una capa de capacidades y dominios nuevos sobre la plataforma actual.**

No como:
- un producto aparte
- una app aparte
- una reescritura
- una copia de municipios con otro nombre

Tiene que heredar:
- multi-tenant
- inbox/tickets
- widget
- voz
- RAG
- analytics
- identidad dual panel/widget

## 15. Resumen ejecutivo brutal

Lo mejor que podés hacer para conquistar colegios de Mendoza y Argentina es esto:

1. endurecer identidad, auditoría y AI gateway
2. reutilizar tickets como casos escolares
3. reutilizar catálogo/Qdrant como KB escolar
4. construir portal familiar + inbox staff + widget institucional
5. agregar asistencia, documentos, campañas e incidentes
6. sumar privados con admisiones y cobranza
7. explotar voz y multimodal después

Lo peor que podrías hacer es intentar competir ya mismo como ERP académico total. Eso te saca foco, alarga ventas y te rompe el producto base.
