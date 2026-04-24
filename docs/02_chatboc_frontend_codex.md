# CODEX FRONTEND — chatboc.ar

## 1. Objetivo

Transformar el frontend actual React/Vite/TypeScript en una superficie operativa moderna para:
- atención ciudadana;
- operación de tickets;
- widget embebible;
- copiloto para agentes;
- voz en navegador;
- auditoría y analítica.

## 2. Restricciones no negociables

1. Mantener compatibilidad con modo panel y modo widget.
2. Mantener tenant resolution desde URL/subdominio/config/script.
3. Mantener headers actuales hasta completar migración.
4. No romper embedding externo.
5. No mezclar sesión panel con sesión widget.
6. Todo stream nuevo se implementa sobre contratos tipados.
7. Toda UI IA debe poder mostrar estado, fuentes, políticas y errores.

## 3. Arquitectura objetivo

```text
src/
  app/
    router/
    providers/
    query/
    auth/
    tenant/
    feature-flags/
  domains/
    chat/
    tickets/
    catalog/
    rag/
    voice/
    analytics/
    audit/
    moderation/
  components/
    layout/
    widget/
    chat/
    tickets/
    forms/
    data-display/
  services/
    api/
    ai-stream/
    socket/
    webrtc/
  schemas/
    api/
    stream/
  stores/
    panel-session.ts
    widget-session.ts
    tenant.ts
  pages/
    panel/
    widget/
    admin/
```

## 4. Decisión fuerte de producto

No conviene rehacer el frontend usando ChatKit como base principal.  
Sí conviene copiar lo que ChatKit resolvió bien:
- UX conversacional madura;
- attachments;
- tool status;
- partial streaming;
- reasoning summaries opcionales;
- componentes embebibles.

chatboc.ar debe conservar su shell propia.

## 5. Epic FE-A — Contrato de API y tipado fuerte

### Objetivo
Terminar con drift entre backend y frontend.

### Tareas
- crear `zod` schemas para todas las respuestas nuevas;
- adaptar `apiFetch` a contratos versionados;
- normalizar errores;
- incluir `request_id` / `correlation_id` en toda respuesta;
- centralizar `tenant headers` y `auth headers`.

### Contratos críticos
- `AIResponseEnvelope`
- `AIStreamEvent`
- `Citation`
- `PolicyDecision`
- `TicketTimelineEvent`
- `RealtimePresenceEvent`
- `VoiceSessionConfig`

### Regla
No consumir endpoints nuevos sin schema validado.

## 6. Epic FE-B — Session model panel vs widget

### Objetivo
Separar completamente identidad y persistencia por contexto.

### Stores
- `panelSessionStore`
- `widgetSessionStore`
- `tenantStore`

### Reglas
- cookies y local/session storage separados;
- `anon_id`, `session_id`, `entity_token` del widget aislados;
- refresh flow independiente;
- invalidación fuerte en cambio de tenant.

### UI/estado
- bootstrapping del widget explícito;
- error legible cuando falla bootstrap por origin o token;
- expiración visible en voz/realtime.

## 7. Epic FE-C — Chat streaming semántico

### Objetivo
Dejar atrás loaders mudos y mejorar UX/observabilidad.

### Componentes
- `ChatStreamRenderer`
- `ToolExecutionChip`
- `CitationDrawer`
- `PolicyBanner`
- `UsageFootnote`
- `StreamingCursor`

### Eventos soportados
- `response.started`
- `response.delta`
- `response.reasoning_summary`
- `tool.started`
- `tool.completed`
- `citation.added`
- `moderation.warning`
- `response.completed`
- `response.error`

### UX deseada
- texto aparece token a token o bloque a bloque;
- tools visibles con estado;
- citas clickeables;
- aviso de bloqueo/redacción;
- feedback thumbs + etiqueta de problema.

### Regla dura
Nunca mostrar “pensamiento interno completo”.  
Sólo mostrar:
- progreso;
- resumen de razonamiento si backend lo autoriza;
- estado de tools.

## 8. Epic FE-D — Widget embebible 2.0

### Objetivo
Elevar el widget a producto enterprise/gobierno serio.

### Mejoras
- montaje robusto con `data-tenant`, `data-domain`, `data-rubro`;
- bootstrap asíncrono con fallback visual;
- detección de capabilities (mic, geo, clipboard, camera);
- control de tema/branding por tenant;
- lazy load;
- recuperación de sesión;
- soporte de attachments y citas.

### Modos
- chat texto
- chat + adjuntos
- chat + voz
- modo “formulario guiado”
- modo “ticket rápido”

### Estados visibles
- cargando
- tenant inválido
- origin no autorizado
- token expirado
- servicio degradado
- handoff a humano

## 9. Epic FE-E — Inbox realtime para tickets

### Objetivo
Convertir tickets + chat en una UI operativa real.

### Componentes
- `TicketInboxPage`
- `TicketListPane`
- `TicketConversationPane`
- `PresenceAvatars`
- `TypingIndicator`
- `ReadStateBadge`
- `AssignmentWidget`
- `TimelineMergeView`

### Eventos socket
- `ticket.status.changed`
- `ticket.assignment.changed`
- `ticket.presence.changed`
- `conversation.typing`
- `conversation.message.read`
- `conversation.message.created`

### UX
- lista izquierda con filtros;
- conversación y timeline combinadas;
- cambios en vivo;
- presencia por ticket;
- unread count consistente;
- acciones rápidas (asignar, cerrar, escalar, responder con sugerencia IA).

## 10. Epic FE-F — Agent assist para operadores

### Objetivo
No sólo responder al ciudadano, también asistir al agente humano.

### Features
- sugerencia de respuesta;
- resumen del caso;
- extracción de próximos pasos;
- consulta RAG con citas;
- advertencias de policy;
- botón de “crear borrador, no enviar”.

### Reglas
- sugerencias separadas del mensaje real;
- agente humano confirma antes de enviar;
- mostrar fuentes utilizadas;
- registrar feedback del agente.

## 11. Epic FE-G — Multimodal en UI

### Objetivo
Permitir foto/documento → preanálisis → ticket.

### Componentes
- `ImageUploadDropzone`
- `ImageAnalysisPreview`
- `ConfidenceMeter`
- `SuggestedFieldsForm`
- `PIIWarningBanner`

### UX
1. subir imagen;
2. preanalizar;
3. revisar campos sugeridos;
4. editar;
5. confirmar creación.

### Regla
No crear ticket de forma silenciosa sólo con la imagen.

## 12. Epic FE-H — Voz en navegador

### Objetivo
Agregar voice UX de baja latencia al widget y al panel.

### Servicios
- `services/webrtc/session.ts`
- `services/webrtc/audio.ts`
- `services/webrtc/events.ts`

### Componentes
- `VoiceCallButton`
- `VoiceStatusPill`
- `TranscriptPanel`
- `InterruptButton`
- `HandoffButton`

### Estados
- idle
- requesting_permission
- connecting
- listening
- speaking
- reconnecting
- handoff
- ended
- failed

### Reglas UX
- permiso de micrófono explícito;
- indicador claro cuando el sistema escucha;
- transcript parcial opcional;
- botón de interrumpir;
- handoff visible;
- degradación a modo texto si falla voz.

## 13. Epic FE-I — Citas, explicabilidad y confianza

### Objetivo
Hacer verificable la respuesta del sistema.

### Citas
- mostrar documento, fragmento y score/confianza si existe;
- panel lateral de fuentes;
- scroll a chunk cuando aplique;
- distinguir fuente interna vs web.

### Badges
- “respuesta basada en normativa”
- “respuesta generada sin fuentes”
- “requiere validación humana”
- “bloqueado por política”

### Regla
No vender certeza falsa.  
Si no hay fuente, la UI debe indicarlo.

## 14. Epic FE-J — Admin de políticas, conocimiento y costos

### Objetivo
Hacer operable el producto desde panel.

### Módulos nuevos
- `PoliciesAdminPage`
- `KnowledgeSourcesPage`
- `PromptVersionsPage`
- `AuditExplorerPage`
- `AnalyticsCostsPage`

### Funciones
- CRUD de políticas;
- ver fuentes RAG e ingestas;
- ver versiones de prompts;
- explorar auditoría por request/tool/user;
- costo por tenant/canal/modelo.

## 15. Epic FE-K — PWA / offline selectivo

### Objetivo
Preparar escenarios de baja conectividad.

### Alcance inicial
- cache del shell;
- cola de acciones no críticas;
- draft de ticket offline;
- sync visual al reconectar.

### No incluir inicialmente
- voz offline;
- RAG completo local;
- colaboración rica offline.

## 16. Epic FE-L — Observabilidad de frontend

### Objetivo
Poder depurar fallas reales.

### Instrumentación
- `request_id` en consola y errores reportados;
- métricas de latencia widget bootstrap;
- métricas de first token / full response;
- errores de permisos de micrófono;
- socket reconnects;
- cortes de stream.

### Dimensiones
- tenant
- channel
- feature
- browser
- session type

## 17. Diseño visual recomendado

### Widget
- compacto;
- fuerte branding por tenant;
- foco en fricción baja;
- progreso muy visible;
- referencias/citas plegables.

### Panel operador
- layout tipo inbox;
- densidad alta;
- shortcuts de teclado;
- historial y acciones en paralelo;
- IA como copiloto, no como reemplazo invisible.

## 18. Gestión de estado recomendada

- React Query para server state;
- stores pequeños para sesión/tenant/voice;
- event bus local para stream y socket;
- no meter todo en un store global único;
- normalizar tickets y mensajes por id.

## 19. PR plan sugerido

### PR-FE-01
Schemas zod + contratos base

### PR-FE-02
Session split panel/widget + bootstrap robusto

### PR-FE-03
Chat streaming renderer + citations

### PR-FE-04
Policy banners + error model + request correlation

### PR-FE-05
Ticket inbox realtime + presence/read receipts

### PR-FE-06
Agent assist surfaces

### PR-FE-07
Image analysis flow + ticket draft

### PR-FE-08
Voice browser WebRTC UI

### PR-FE-09
Admin pages: policies / prompts / audit / analytics

### PR-FE-10
Offline/PWA selectivo

## 20. Criterios de aceptación frontend

- widget y panel siguen operativos;
- stream semántico visible y estable;
- citas renderizadas y navegables;
- tickets muestran presencia/unread/read;
- voice widget conecta y degrada a texto si falla;
- operador ve sugerencias IA separadas del envío real;
- políticas y auditoría tienen UI mínima;
- costos y KPIs tienen visibilidad inicial.

## 21. Qué no hacer en frontend

- no mezclar stores de panel y widget;
- no depender de texto libre sin schema;
- no ocultar bloqueos o redacciones de políticas;
- no simular progreso falso cuando no hay stream real;
- no autoenviar respuestas sugeridas al ciudadano;
- no esconder la ausencia de fuentes;
- no convertir voz en una UX opaca o “mágica”.