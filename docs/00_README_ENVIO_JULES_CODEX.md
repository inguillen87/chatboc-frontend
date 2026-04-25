# Chatboc.ar · paquete vertical Educación (Mendoza + Argentina)

## Qué incluye este bundle

1. `01_MASTER_VERTICAL_EDUCACION_SAAS.md`
   - estrategia de producto y posicionamiento para colegios públicos y privados
   - prioridades por fase
   - módulos recomendados
   - diferencias entre sector público y privado

2. `02_BACKEND_VERTICAL_EDUCACION_CODEX.md`
   - arquitectura backend objetivo
   - bounded contexts, modelos, endpoints, eventos y reglas de seguridad
   - criterio de reutilización del backend actual sin reescritura

3. `03_FRONTEND_VERTICAL_EDUCACION_CODEX.md`
   - arquitectura frontend objetivo
   - portales, paneles, flentes UX, journeys y componentes
   - criterio de compatibilidad con el frontend actual

4. `04_PROMPT_BACKEND_EDUCACION_AUDITORIA.md`
   - prompt readonly para Jules/Codex sobre `chatbot-backend`

5. `05_PROMPT_BACKEND_EDUCACION_IMPLEMENTACION.md`
   - prompt de implementación backend fase fundacional

6. `06_PROMPT_FRONTEND_EDUCACION_AUDITORIA.md`
   - prompt readonly para Jules/Codex sobre `chatboc-frontend`

7. `07_PROMPT_FRONTEND_EDUCACION_IMPLEMENTACION.md`
   - prompt de implementación frontend fase fundacional

8. `08_BACKLOG_VERTICAL_EDUCACION.yaml`
   - backlog ejecutable por épicas, fase, prioridad y dependencias

## Cómo usarlo con Jules y Codex

### Backend
Mandale, en este orden:
1. `01_MASTER_VERTICAL_EDUCACION_SAAS.md`
2. `02_BACKEND_VERTICAL_EDUCACION_CODEX.md`
3. `04_PROMPT_BACKEND_EDUCACION_AUDITORIA.md`

Cuando termine la auditoría:
4. `05_PROMPT_BACKEND_EDUCACION_IMPLEMENTACION.md`

### Frontend
Mandale, en este orden:
1. `01_MASTER_VERTICAL_EDUCACION_SAAS.md`
2. `03_FRONTEND_VERTICAL_EDUCACION_CODEX.md`
3. `06_PROMPT_FRONTEND_EDUCACION_AUDITORIA.md`

Cuando termine la auditoría:
4. `07_PROMPT_FRONTEND_EDUCACION_IMPLEMENTACION.md`

## Regla operativa

- un repo por agente
- una branch por slice
- una tarea por PR
- no mezclar auth + IA + UI en el mismo PR
- no reescribir framework
- no romper contratos `/ask/*`, `/tickets/*`, `/catalogo/*`
- no romper headers `X-Chat-Session-Id`, `X-Anon-Id`, `X-Entity-Token`/`X-Token`, `Authorization`, `X-Tenant`

## Branches sugeridas

### backend
- `audit/educacion-backend-readonly`
- `feat/edu-foundation-domain`
- `feat/edu-communications-and-guardians`
- `feat/edu-attendance-incidents-docs`
- `feat/edu-private-school-billing`
- `feat/edu-voice-frontdesk`

### frontend
- `audit/educacion-frontend-readonly`
- `feat/edu-family-portal-shell`
- `feat/edu-staff-inbox-and-cases`
- `feat/edu-attendance-documents-ui`
- `feat/edu-private-school-finance-ui`
- `feat/edu-public-widget-and-voice`

## Qué no hacer

- no convertir V1 en un ERP escolar completo
- no construir boletines/calificaciones/planificación docente full en la primera ola
- no duplicar motor de tickets si ya existe y sirve
- no duplicar motor de RAG si catálogo + Qdrant ya cubren la base
- no exponer datos de menores por widget público
- no mezclar familias, alumnos y staff sin verificación fuerte
- no usar memoria cross-tenant ni caché cross-tenant

## Juicio técnico

El ángulo correcto para educación no es “otro vertical más”. Es una capa de producto sobre la base actual:
- chat público del colegio
- mesa de ayuda/inbox escolar
- comunicaciones a familias
- inasistencias, justificativos y documentos
- incidentes y mantenimiento
- admisiones y cobranzas en privados
- switchboard de voz / recepción escolar
- base de conocimiento institucional con citas y trazabilidad

Eso aprovecha lo que ya existe en chatboc.ar y evita el error clásico de intentar rehacer todo como un software académico gigante.
