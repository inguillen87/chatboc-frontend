# Frontend · vertical Educación para chatboc.ar

## 1. Objetivo

Elevar el frontend actual para educación sin romper panel, widget ni el contrato de headers/tenancy ya existente.

El frontend debe resolver cuatro superficies:

1. **sitio público del colegio + widget**
2. **portal familiar**
3. **panel staff / inbox escolar**
4. **panel red educativa / analítica**

## 2. Principios UX

1. **mobile first**
   - la mayoría de las familias va a entrar desde celular

2. **role first**
   - no mostrar el mismo menú a familia, preceptor y tesorería

3. **student-context first**
   - una familia no piensa en “tickets”; piensa en “mi hijo/a”, “inasistencias”, “documentos”, “pagos”

4. **public vs verified**
   - el widget público sólo responde lo institucional
   - al tocar datos individuales, pasar a verificación/login

5. **low-friction + low-connectivity**
   - formularios cortos
   - estados simples
   - PWA y reintentos
   - fallbacks

## 3. Qué del frontend actual conviene reutilizar

### A. Shell SPA + routing
Mantener la SPA actual y crear rutas/áreas nuevas por vertical. No dividir en otra app salvo que el crecimiento lo exija.

### B. Cliente API y headers actuales
Mantener:
- `X-Chat-Session-Id`
- `X-Anon-Id`
- `X-Entity-Token` / `X-Token`
- `Authorization`
- `X-Tenant`

Y sumar contexto escolar arriba de eso, no en reemplazo.

### C. Widget embebible
Reutilizar el widget actual en:
- sitio público del colegio
- landing de admisiones
- área de ayuda de familias

### D. Tickets UI
Reutilizar el patrón de inbox/tickets/timeline como base del panel escolar.

### E. Realtime
Reutilizar sockets para:
- presencia
- typing
- lecturas
- actualizaciones de casos/documentos/campañas

## 4. Arquitectura visual recomendada

## 4.1 Modo público institucional
Ideal para sitio web del colegio.

### Objetivos
- responder preguntas frecuentes
- derivar a áreas
- capturar leads de admisión
- iniciar solicitudes simples
- mostrar calendarios, documentación, aranceles, horarios
- pedir verificación cuando se consulta algo individual

### Pantallas / componentes
- widget chat institucional
- home de ayuda
- FAQ con búsqueda
- accesos rápidos:
  - documentación de inscripción
  - horarios
  - calendario
  - contacto
  - turnos
  - admisiones
  - pagos
- banner de emergencias / comunicados urgentes

## 4.2 Portal familiar
Este es el gran salto de producto.

### Home familiar
Debe mostrar:
- selector de alumno/s
- últimos comunicados
- estado de trámites
- últimas inasistencias
- documentos solicitados/emitidos
- conversaciones abiertas
- botones rápidos

### Acciones rápidas
- justificar inasistencia
- pedir certificado
- consultar cuota
- pedir turno
- informar retiro autorizado
- chatear con el colegio

### Módulos
- `Mi familia`
- `Mis alumnos`
- `Comunicaciones`
- `Asistencia`
- `Documentos`
- `Pagos` (sólo privados)
- `Turnos`
- `Casos`
- `Configuración`

## 4.3 Panel staff
No debe ser “el mismo panel actual con más menús”. Debe tener foco operativo.

### Home staff
- inbox por área
- pendientes del día
- backlog por tipo de caso
- campañas pendientes
- alertas de justificativos
- documentos por emitir
- métricas rápidas

### Áreas
- secretaría
- preceptoría
- dirección
- convivencia
- administración/tesorería
- admisiones
- mantenimiento

### Vistas clave
- inbox unificado
- tablero por estado
- timeline del caso
- ficha contextual de alumno/familia
- panel de acciones IA sugeridas
- bulk actions por campañas o asistencia

## 4.4 Panel de red / multi-escuela
Para grupos o redes:
- métricas por institución
- backlog comparativo
- SLA
- campañas centralizadas
- políticas por escuela
- biblioteca de plantillas
- auditoría exportable

## 5. Journeys prioritarios

## 5.1 Justificación de inasistencia
**Familia**
1. entra al portal
2. elige alumno
3. selecciona fecha
4. adjunta evidencia si hace falta
5. envía

**Staff**
1. recibe justificación
2. revisa
3. aprueba/rechaza
4. queda trazado

UI requerida:
- wizard corto
- estado en tiempo real
- historial por alumno

## 5.2 Solicitud de certificado
**Familia**
1. elige tipo de certificado
2. confirma alumno
3. envía solicitud

**Staff**
1. ve cola de solicitudes
2. genera documento
3. marca listo
4. notifica descarga

UI requerida:
- catálogo de documentos
- estados
- descarga segura
- vencimiento del link

## 5.3 Comunicado con acuse
**Staff**
1. crea campaña
2. define audiencia
3. elige canal
4. envía

**Familia**
1. recibe mensaje
2. confirma lectura
3. puede responder si aplica

UI requerida:
- segmentador por nivel/sede/curso
- preview
- métricas de leído/no leído
- reenvío

## 5.4 Caso escolar / incidente
**Familia o staff**
1. abre caso
2. lo atiende el área correcta
3. hay conversación y estado
4. se cierra con trazabilidad

UI requerida:
- inbox
- timeline
- etiquetas
- prioridad
- sensibilidad
- escalado

## 5.5 Cobranza / recordatorio (privados)
**Familia**
- ve estado simple
- consulta deuda
- recibe recordatorios
- pide plan o contacto

**Administración**
- ve bandeja de gestión
- envía recordatorios segmentados
- sigue respuestas

UI requerida:
- muy clara, sobria y no agresiva
- separado de lo académico
- política de visibilidad estricta

## 5.6 Admisiones (privados)
**Prospecto**
1. entra al sitio
2. consulta propuesta
3. pide información
4. agenda visita
5. deja datos

**Administración**
1. ve lead
2. clasifica interés
3. agenda
4. hace seguimiento

## 6. Componentes que recomiendo construir

## 6.1 Shared
- `StudentSwitcher`
- `GuardianVerificationBanner`
- `SensitivityBadge`
- `CaseTimeline`
- `CampaignStatsCard`
- `DocumentRequestCard`
- `AttendanceStatusPill`
- `SchoolQuickActions`
- `CampusSelector`
- `AudienceBuilder`
- `AckStatusTable`

## 6.2 Family portal
- `FamilyHome`
- `StudentOverviewCard`
- `AbsenceJustificationForm`
- `DocumentRequestWizard`
- `PaymentNoticePanel`
- `AppointmentBookingForm`
- `AuthorizedPickupManager`
- `CommunicationsFeed`

## 6.3 Staff panel
- `StaffInbox`
- `CaseFiltersBar`
- `StudentContextDrawer`
- `BulkCampaignComposer`
- `AttendanceReviewQueue`
- `DocumentOpsQueue`
- `AdmissionLeadBoard`
- `BillingManagementTable`

## 6.4 Public widget
- `PublicSchoolLauncher`
- `VerifiedFamilyEscalationStep`
- `AdmissionsQuickPath`
- `EmergencyBanner`
- `KnowledgeSearchOverlay`

## 7. Diseño de información

## 7.1 Menús por rol

### Familia
- Inicio
- Mis alumnos
- Comunicaciones
- Asistencia
- Documentos
- Turnos
- Casos
- Pagos (si aplica)
- Perfil

### Secretaría
- Inbox
- Documentos
- Comunicaciones
- Turnos
- Familias
- Reportes

### Preceptoría
- Inbox
- Asistencia
- Incidentes
- Comunicaciones
- Alumnos

### Dirección
- Resumen
- Inbox
- Incidentes
- Campañas
- Reportes
- Configuración

### Administración/Tesorería
- Inbox
- Pagos
- Familias
- Comunicaciones
- Reportes

### Admisiones
- Leads
- Visitas
- Campañas
- Conversaciones

## 7.2 Contexto por alumno
La UI debe navegar por alumno, no sólo por conversación:
- foto/avatar opcional
- nombre completo
- curso/división
- sede
- estado de asistencia
- documentos pendientes
- casos abiertos
- restricciones de visibilidad

## 8. Streaming, chat e IA en frontend

## 8.1 Modo público
- respuestas rápidas, claras
- citar fuentes institucionales
- CTA a trámite o contacto
- jamás mostrar datos individuales

## 8.2 Modo familiar verificado
- puede acceder a trámites y estado personal
- respuestas con más contexto
- confirmaciones y acciones guiadas

## 8.3 Modo staff
- copiloto interno:
  - resumir caso
  - sugerir respuesta
  - clasificar prioridad
  - redactar campaña
  - resumir respuestas de familias

## 8.4 Feature flags
Todo lo nuevo debe salir con flags:
- `education_enabled`
- `family_portal_enabled`
- `attendance_enabled`
- `documents_enabled`
- `billing_enabled`
- `admissions_enabled`
- `voice_enabled`

## 9. Accesibilidad y experiencia real

### Imprescindible
- textos simples
- botones grandes
- mobile friendly
- contraste y accesibilidad
- estados entendibles
- no sobrecargar con jerga técnica

### Proactivo
- versión PWA
- caché de últimas conversaciones
- reintento de envíos
- skeletons y offline-lite
- soporte de adjuntos desde celular

## 10. Analítica UI

### Staff / dirección
- FRT
- TTR
- backlog
- campañas leídas
- justificativos pendientes
- documentos emitidos
- uso de autoservicio
- costo IA por área/canal

### Privados
- leads de admisión
- conversión por fuente
- cobranza gestionada
- engagement familiar

## 11. Qué no conviene hacer en frontend

- no mezclar todo en el mismo dashboard genérico
- no exponer módulos sensibles a roles incorrectos
- no resolver roles sólo ocultando botones
- no meter un menú con 20 ítems desde el día 1
- no hacer del family portal un clon del panel staff
- no depender de desktop para flujos familiares

## 12. Orden de implementación frontend

## Slice 1
- shell educación
- role-based routing
- family home
- staff inbox alias sobre tickets
- public widget school mode

## Slice 2
- student switcher
- guardian verification UX
- documents UI
- campaigns UI
- contextual case timeline

## Slice 3
- attendance UI
- incident UI
- appointments
- report dashboards

## Slice 4
- private billing UI
- admissions funnel UI

## Slice 5
- voice widget/browser
- offline-lite
- advanced analytics

## 13. Resultado esperado

Al terminar la ola fundacional, el frontend debería permitir:

1. un sitio público escolar con asistente útil y seguro
2. un portal familiar usable desde celular
3. un panel staff realmente operativo
4. un inbox por áreas y sedes
5. trámites concretos con estado y trazabilidad
6. campañas y acuses
7. escalado posterior a privados con admisiones y pagos

## 14. Resumen ejecutivo brutal

El frontend de educación no debe ser una “pantalla nueva”. Debe ser una reorganización por rol y por alumno/familia usando motores que ya tenés.

La prioridad no es embellecer. La prioridad es:
- contexto correcto
- permisos correctos
- journeys cortos
- mobile first
- trazabilidad
- cero exposición de datos de menores
