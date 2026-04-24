# Chatboc.ar - Frontend execution brief
## Vertical educacion: colegios publicos y privados de Mendoza y Argentina

## Objetivo del frontend

Subir la plataforma a nivel SaaS premium separando tres experiencias:
1. Admin del colegio.
2. App de familias.
3. App de alumnos.

WhatsApp y widget deben funcionar como puertas de entrada a esas experiencias, no como islas.  
El usuario final debe poder entrar al tenant correcto, ver comunicados, tickets, tienda y estado de tramites desde mobile con muy poca friccion.

## Diagnostico UX

- El producto tiene demasiada superficie para seguir agregando pantallas sin arquitectura de informacion.
- Si el portal usuario vive dentro del admin, la UX va a quedar contaminada por menus operativos.
- Heatmaps y analytics sin estados claros destruyen confianza.
- Un marketplace generico no alcanza: en educacion debe venderse como tienda escolar o portal transaccional.
- Las familias usan celular; si mobile/PWA es mediocre, el vertical no escala.

## No negociables

1. **Apps separadas.**  
   Admin, familia y alumno no comparten shell, menu lateral ni jerarquia visual.

2. **Mobile first para portal.**  
   Desktop first solo para admin.

3. **Nada de placeholders.**  
   Toda ruta carga algo real, o muestra estado vacio con razon.

4. **Nada de dead buttons.**  
   Toda accion navega, envía, guarda, exporta o se ve deshabilitada con motivo preciso.

5. **Nada de terminologia heredada.**  
   Fuera "municipio", "pyme", "rubro" y restos de verticales previos.

6. **Estados de datos obligatorios.**  
   Loading, vacio, error, sin permisos, stale/offline y exito.

7. **White-label serio por tenant.**  
   Logo, colores, copy, dominio y tema sin romper accesibilidad.

## Arquitectura de experiencias

| App | Usuario | Prioridad | Caracteristicas |
| --- | --- | --- | --- |
| Admin escolar | Directivos, secretaria, preceptoria, tesoreria, admisiones, soporte | Alta | Bandejas, analytics, store admin, contenido, encuestas, roles |
| Family App | Madres, padres, tutores | Muy alta | Comunicados, autorizaciones, tickets, tienda, pagos, chat, encuestas |
| Student App | Alumnos | Alta | Agenda, comunicados, tramites, documentos, tienda, soporte |
| Widget publico | Visitantes y comunidad | Alta | FAQ, admisiones, acceso portal, apertura de caso |
| School Store | Familias y alumnos | Alta | Catalogo, producto, carrito, pedido, estado |
| Sales/demo microsite | Autoridades y leads | Media | Demo guiada, captura de lead, argumentos del vertical |

## Navegacion recomendada

### Admin escolar
- `/admin`
- `/admin/inbox`
- `/admin/cases`
- `/admin/assignments`
- `/admin/families`
- `/admin/students`
- `/admin/staff`
- `/admin/announcements`
- `/admin/calendar`
- `/admin/surveys`
- `/admin/analytics`
- `/admin/heatmaps`
- `/admin/store`
- `/admin/orders`
- `/admin/admissions`
- `/admin/settings`

### Family App
- `/app`
- `/app/comunicados`
- `/app/calendario`
- `/app/tickets`
- `/app/autorizaciones`
- `/app/tienda`
- `/app/pedidos`
- `/app/pagos`
- `/app/documentos`
- `/app/encuestas`
- `/app/chat`

### Student App
- `/student`
- `/student/agenda`
- `/student/comunicados`
- `/student/tickets`
- `/student/tienda`
- `/student/documentos`
- `/student/encuestas`

## Sistema visual recomendado

- UI sobria, institucional y confiable.
- Tipografia legible, targets tactiles amplios, densidad baja en mobile.
- Color por severidad y estado, no por decoracion.
- Skeleton loaders en cards, charts y mapas.
- Empty states explicativos, no tristes ni genéricos.
- Indicadores de frescura: "actualizado hace X", "sin eventos", "stream desconectado".
- Dark mode opcional en admin; en portal priorizar legibilidad sobre estetica.

## Fase A - Shells, tenancy y roles

### FE-EDU-001 - Separar app shells
**Objetivo:** tres shells: admin, family, student.  
**Alcance:** layouts, routing, guards, branding por tenant, carga de sesion.  
**Aceptacion:**
- Cada perfil entra a una app distinta.
- Navegacion y breadcrumbs no se mezclan.
- El portal final no hereda menus admin.

### FE-EDU-002 - Navegacion por rol y permisos
**Objetivo:** que nadie vea modulos que no puede usar.  
**Alcance:** guards, menu config, badging, estados sin permisos.  
**Aceptacion:**
- `secretaria` no ve tesoreria si no corresponde.
- `family_user` no ve staff ni analytics.
- Menus y botones coinciden con permisos backend.

### FE-EDU-003 - Resolver tenancy y deep links
**Objetivo:** entrar al tenant correcto desde web, widget y WhatsApp.  
**Alcance:** slug, subdominio, query params, magic links, handoff al portal.  
**Aceptacion:**
- Un link recibido por WhatsApp abre la app correcta del colegio.
- No hay pantallas ambiguas ni selector manual si el contexto ya existe.

## Fase B - Operacion y contenido

### FE-EDU-004 - Inbox operativo premium
**Objetivo:** convertir tickets sueltos en bandeja operativa usable.  
**Vistas:**
- cola general
- mis casos
- backlog por categoria
- detalle con timeline
- drawer de asignacion
**Aceptacion:**
- filtros por campus, categoria, prioridad, SLA y responsable
- presencia/read state si existe realtime
- timeline clara para adjuntos, notas internas y estado

### FE-EDU-005 - Panel de asignacion y roles
**Objetivo:** que el admin tenant distribuya empleados por categoria de reclamo.  
**UI:** matriz categoria -> equipo / empleado / horario / campus.  
**Aceptacion:**
- reglas visibles y editables
- simulacion simple: "este caso iria a..."
- no esconder errores de configuracion

### FE-EDU-006 - Comunicados, calendario y acuse
**Objetivo:** reemplazar chat desordenado por comunicacion oficial.  
**Vistas:**
- builder de comunicado
- segmentacion
- preview mobile
- tablero de lectura/acuse
**Aceptacion:**
- familia ve feed limpio
- admin ve entregado/leido/confirmado
- eventos y noticias no se confunden con tickets

### FE-EDU-007 - Encuestas y votaciones
**Objetivo:** tener un modulo nativo y claro.  
**Vistas:**
- builder
- publicacion
- seguimiento
- resultados
**Aceptacion:**
- encuesta != votacion != autorizacion
- resultados por canal/campus/rango
- export y visualizacion clara

### FE-EDU-008 - Casos sensibles y seguimiento
**Objetivo:** exponer estados sin romper confidencialidad.  
**UI:**
- tracking para usuario final
- vistas restringidas para convivencia/bullying
- indicador de visibilidad restringida
**Aceptacion:**
- family app ve solo lo que corresponde
- admin con poco permiso no accede a datos sensibles

## Fase C - Portal familia/alumno y tienda

### FE-EDU-009 - Family App
**Objetivo:** experiencia mobile superior al chat suelto.  
**Pantallas minimas:**
- home con resumen
- comunicados y eventos
- tickets/tramites
- autorizaciones
- tienda/pagos
- documentos
- chat/soporte
**Aceptacion:**
- acceso en menos de tres pasos desde WhatsApp
- home con prioridades reales: proximos eventos, pendientes, estado de casos, pagos

### FE-EDU-010 - Student App
**Objetivo:** dar autonomia sin exponer datos familiares.  
**Pantallas minimas:**
- agenda
- comunicados
- soporte
- documentos
- encuestas
- tienda
**Aceptacion:**
- separacion clara respecto de familia
- copy y flows acordes a alumno, no a administrativo

### FE-EDU-011 - Tienda escolar / marketplace
**Objetivo:** que el catalogo del tenant se vea y compre bien.  
**Vistas:**
- home de tienda
- listado
- ficha
- carrito
- checkout
- estado de pedido
**Casos de uso:**
- cuotas / matricula
- uniformes
- libros
- talleres
- viajes
- cooperadora
**Aceptacion:**
- deep link desde WhatsApp y widget
- preview en admin
- si no hay pago online, UX de pago manual clara

### FE-EDU-012 - Admisiones / inscripciones
**Objetivo:** que el front tambien venda.  
**Vistas:**
- landing de inscripcion
- formulario inteligente
- agenda de visita
- estado de postulacion
**Aceptacion:**
- origen de lead conservado
- CTA visibles en widget y web publica

## Fase D - Analytics, IA y premium UX

### FE-EDU-013 - Analytics operativa
**Objetivo:** dashboards creibles, no decorativos.  
**Vistas:**
- KPIs principales
- tendencias
- por categoria
- por campus
- por canal
- por tenant si superadmin
**Aceptacion:**
- todos los cards enlazan a detalle
- unidad temporal clara
- estados vacios con razon

### FE-EDU-014 - Heatmaps y mapas
**Objetivo:** mostrar zonas, friccion y demanda con utilidad real.  
**Tipos de heatmap:**
- horas/dias
- campus/sector
- geografico cuando hay geo
**Aceptacion:**
- clustering
- tooltips utiles
- filtros por fecha, categoria, canal, sede
- leyenda clara
- indicador de fuente y frescura

### FE-EDU-015 - Resumenes IA y reportes
**Objetivo:** usar IA para management, no solo chat.  
**UI:**
- cards resumidas
- reporte descargable
- preguntas guiadas
- drill-down a datos base
**Aceptacion:**
- toda conclusion enlaza a datos o filtros subyacentes
- no ocultar "sin datos" detras de copy marketinera

### FE-EDU-016 - PWA y offline parcial
**Objetivo:** que el portal sirva en conectividad inestable.  
**Alcance:**
- install prompt controlado
- offline shell segura
- cola de acciones no sensibles
- reintentos
**Aceptacion:**
- comunicados ya cargados siguen visibles
- tickets y pedidos explican si quedaron en cola
- nada sensible se cachea sin politica

### FE-EDU-017 - Accesibilidad y confianza
**Objetivo:** vender a instituciones sin UX amateur.  
**Alcance:**
- contraste
- foco visible
- labels
- semantica
- `prefers-reduced-motion`
- estados de error comprensibles
**Aceptacion:**
- flujos principales navegables con teclado
- formularios validan bien
- mobile usable sin zoom

### FE-EDU-018 - Localizacion y vertical dictionaries
**Objetivo:** preparar escalado y white-label.  
**Alcance:**
- `es-AR` por defecto
- base para `pt-BR` y `en`
- diccionarios por vertical y tenant
**Aceptacion:**
- nada de copy hardcodeada dispersa
- "tienda escolar" y terminos del colegio salen por configuracion, no por ifs salvajes

## Componentes/patrones que conviene crear

- `AppShellAdmin`, `AppShellFamily`, `AppShellStudent`
- `TenantBrandProvider`
- `RoleGuard`
- `EmptyStateReason`
- `FreshnessBadge`
- `CaseQueue`
- `AssignmentMatrix`
- `AnnouncementBuilder`
- `SurveyBuilder`
- `Storefront`
- `OrderStatusCard`
- `AdmissionsLeadForm`
- `AnalyticsFilters`
- `HeatmapPanel`
- `AISummaryCard`

## Instrumentacion front obligatoria

- eventos de navegacion y conversion por modulo
- origen del acceso: web, widget, WhatsApp, email, push
- tiempo hasta primer valor util en home
- clicks a CTA de tienda o admisiones
- errores visibles por pantalla
- estado de stream o ultima actualizacion de analytics

## QA visual y funcional obligatoria

### Admin
- overview con datos
- inbox con filtros
- heatmap con leyenda y tooltip
- builder de comunicado
- builder de encuesta
- store admin
- admissions dashboard
- modo claro y oscuro si existe

### Family App
- home mobile
- comunicado con acuse
- ticket con timeline
- tienda y carrito
- pedido/pago
- encuesta respondida
- offline shell segura

### Student App
- agenda
- comunicado
- ticket
- tienda
- encuesta

### Cross-channel
- deep link desde WhatsApp
- widget -> portal
- logout/login sin drift de tenant
- estados vacios con razon

## Corte recomendado para Codex / frontend agent (PR slices)

| Slice | Alcance | Dependencia |
| --- | --- | --- |
| FE-S1 | app shells separados + guards base | contratos de auth |
| FE-S2 | tenancy resolver + branded themes | FE-S1 |
| FE-S3 | menu por rol + estados sin permisos | FE-S1 |
| FE-S4 | inbox operativo + detalle de caso | BE support cases |
| FE-S5 | assignment matrix + settings de routing | BE routing |
| FE-S6 | announcement builder + feed familia | BE announcements |
| FE-S7 | survey/vote builder + resultados | BE campaigns |
| FE-S8 | family app home + tickets + comunicados | BE portal bootstrap |
| FE-S9 | student app base | FE-S8 |
| FE-S10 | tienda escolar + carrito + pedido | BE store/orders |
| FE-S11 | admisiones + lead capture | BE leads |
| FE-S12 | analytics + heatmaps + freshness | BE analytics |
| FE-S13 | AI summaries/report export UI | BE AI summary |
| FE-S14 | PWA/offline + accessibility hardening | core estable |

## Lo que frontend no debe hacer

- No calcular reglas de asignacion en el cliente.
- No inventar KPIs ni defaults silenciosos.
- No usar el admin como template del portal.
- No esconder errores de tenant o de permisos.
- No dejar mapas vacios sin explicar si faltan eventos, permisos o configuracion.
- No meter pagos y tienda en un solo componente gigante.
- No disenar una UX infantil para alumnos ni una UX corporativa fria para familias; el tono debe ser institucional, claro y humano.

## Formato de entrega exigido al agente

1. Resumen de cambios reales.
2. Rutas nuevas.
3. Componentes nuevos/modificados.
4. Estados vacios/error/loading agregados.
5. Tests agregados.
6. Capturas reales o pasos exactos de validacion.
7. Dependencias nuevas.
8. Blockers concretos.
9. Items diferidos con razon exacta.

No devolver brainstorming. No marcar "premium" si solo cambiaste colores.  
La mejora se valida con flujos reales, no con mockups.