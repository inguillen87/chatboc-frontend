# Backlog ejecutable full-stack (separado por ownership)

> Objetivo: evitar drift entre frontend y backend y ejecutar roadmap con entregables pequeños y medibles.

## 0) Bloque compartido (frontend + backend) — obligatorio

### CT-01 · Contratos API/eventos congelados (v1)
- Definir esquema canónico por dominio:
  - Auth
  - Tickets
  - Encuestas/Votaciones
  - Marketplace/Pedidos
  - Portal usuario
  - Analytics/Heatmaps
  - Socket events
- Publicar ejemplos request/response y errores estándar.
- Versionado explícito por endpoint crítico.

**DoD**
- OpenAPI/JSON schemas disponibles.
- Consumer contract tests en CI.
- Legacy documentado con fecha de deprecación.

### CT-02 · Matriz de roles/permisos
Roles mínimos:
- `superadmin`
- `tenant_admin`
- `employee_agent`
- `catalog_manager`
- `analytics_viewer`
- `end_user`

**DoD**
- Matriz capability -> endpoint -> pantalla.
- Backend enforced (no solo guard frontend).

### CT-03 · Taxonomía única de eventos
Eventos mínimos:
- `message_received`
- `ticket_created`
- `ticket_assigned`
- `ticket_resolved`
- `survey_answer_submitted`
- `vote_submitted`
- `product_viewed`
- `cart_started`
- `checkout_started`
- `order_created`
- `location_shared`
- `widget_session_opened`
- `portal_session_opened`

**DoD**
- 1 esquema base para todos los canales.
- Dashboard de cobertura por tenant/canal.

### CT-04 · Decisión de arquitectura portal
- Portal usuario separado del admin panel (build/deploy/URL canónica).

**DoD**
- Build independiente.
- Navegación y analytics desacopladas del admin.

---

## 1) Backlog Backend

## P0 (crítico)

### BE-01 · Endurecer auth widget/panel
- JWT RS256/ES256.
- JWKS público.
- Rotación de claves.
- TTL corto para widget + refresh segregado.

### BE-02 · RBAC multi-tenant
- Modelo persistente de roles/capabilities por tenant.
- ABAC liviano por `categoria`, `zona`, `estado` en tickets.

### BE-03 · Motor de asignación automática de reclamos
- Reglas por tenant: `(categoria, zona, prioridad, horario, disponibilidad)`.
- Fallback a cola sin asignar + escalamiento.

### BE-04 · Workflow operativo de tickets
- Estado estandarizado.
- SLA de primera respuesta y resolución.
- Reasignación auditada.
- Integración realtime (`presence`, `read-state`, `unread`).

### BE-05 · Encuestas/votaciones enterprise
- Publicación, cierre, resultados, exportación, segmentación.
- Contrato estable de respuestas y metadata.

### BE-06 · Estado público de reclamo
- Endpoint seguro por código/token.
- Sin exposición de datos sensibles.

### BE-07 · Marketplace APIs robustas
- Productos, variantes, stock, categorías, media.
- Pedido y estados de fulfillment.
- Rastreabilidad omnicanal por `contact_key`.

### BE-08 · Bootstrap de portal usuario
- Sesión de usuario final tenant-scoped.
- Deep links firmados WhatsApp/widget -> portal.

### BE-09 · Analytics pipeline
- Ingesta consistente por canal.
- KPIs por tenant.
- Costo IA, funnel market, reclamos por zona/categoría.

### BE-10 · Agregaciones geográficas
- Bins/clusters/capas desde backend.
- Contrato para MapLibre sin lógica geoespacial pesada en frontend.

## P1 (segunda ola)

### BE-11 · Gateway interno de IA
- Structured outputs.
- Tool registry versionado.
- Logging de decisiones por tenant.

### BE-12 · Moderación/policy gates
- Pre y post moderation por canal.
- Cuotas y límites por tenant.

### BE-13 · Auditoría operativa
- Logs de prompts/tools/actions/actor/tenant.
- Export legal/operativo.

### BE-14 · Reclamos multimodales
- Imagen/audio/ubicación -> clasificación -> borrador ticket.

### BE-15 · Realtime collaboration
- typing/unread/read/presence con consistencia de actor.

## P2 (post-estabilización)

- Voz avanzada browser/widget.
- Sync offline bidireccional.
- MCP/tools enterprise.

---

## 2) Backlog Frontend

## FE-P0

### FE-01 · Router canónico por tenant
- Ruta única para navegación pública/portal.
- Redirects para prefijos legacy.

### FE-02 · TypeScript strict progresivo
- Arrancar por API/context/market/portal.
- Cero regresiones en CI por módulos migrados.

### FE-03 · Continuidad omnicanal en cliente
- Persistir y reinyectar:
  - `X-Contact-Key`
  - `X-Conversation-Id`
- Handoff WhatsApp -> portal/market sin pérdida de contexto.

### FE-04 · Checkout orquestado E2E
- Estados explícitos.
- Reintentos y recuperación de sesión.
- Telemetría por paso.

### FE-05 · Portal app separada
- Build y PWA propios.
- URL canónica por tenant.

### FE-06 · Encuestas con contrato único
- Eliminar cascada de fallbacks cuando v1 esté estable.
- Tipos TS alineados al contrato backend.

### FE-07 · UX de permisos
- Pantallas 403 usables.
- Estado de capability faltante.
- Telemetría de denegaciones.

## FE-P1

- Dashboard de cobertura de identidad (`/analytics/identity/coverage`).
- Banner de calidad de datos por `alerts`/`alert_count`.
- Vista de funnel WhatsApp con `unique_contacts`.

---

## 3) KPIs de avance (quincenal)

- `% eventos con contact_key` por canal.
- `% endpoints críticos sin fallback legacy`.
- `Tasa de errores por contrato` (4xx/5xx de shape inválido).
- `Tiempo primera respuesta` y `tiempo resolución` tickets.
- `Conversión checkout` y `abandono por paso`.

---

## 4) Orden de ejecución sugerido

1. CT-01/CT-02/CT-03 (congelar base compartida)
2. BE-01/BE-02 + FE-01/FE-02/FE-03
3. BE-03/BE-04 + FE-07
4. BE-07/BE-09 + FE-04/FE-05
5. BE-05/BE-10 + FE-06
6. BE-P1 y FE-P1

Este orden minimiza riesgo de drift y maximiza valor operativo temprano.

---

## 5) Tablero de ejecución (abril 2026)

> Estado operativo para seguimiento semanal (CTO + leads BE/FE).
> Nota: estados FE actualizados según implementación Stage 4 ya mergeada en frontend.

### CT (compartido)

- [x] **CT-01** · Contrato `analytics.identity_coverage.v1` publicado en docs.
- [x] **CT-01** · Contrato de error estándar `shared.error.v1` publicado.
- [ ] **CT-01** · OpenAPI consolidado por dominios (tickets/market/encuestas/socket).
- [ ] **CT-02** · Matriz capability -> endpoint -> pantalla (v1 publicada en `docs/rbac.capability_matrix.v1.md`, pendiente firma BE/FE).
- [ ] **CT-03** · Taxonomía única de eventos (parcial; falta normalizar dashboards legacy).
- [ ] **CT-04** · Decisión final de arquitectura de portal (build aislado desplegado en prod).

### Backend

- [x] Identidad omnicanal base (`contact_key`, `conversation_id`, hooks request/response).
- [x] Coverage endpoint `/analytics/identity/coverage` con `alerts`, `target_by_channel`, `emit_alert_events`.
- [x] Funnel WhatsApp admin con `unique_contacts` + `contract_version`.
- [x] Demo placeholders backend en modo explícito (`ENABLE_DEMO_MODE=true`), desactivados por defecto.
- [ ] **BE-02** · Enforcement RBAC/ABAC completo en rutas críticas.
- [ ] **BE-03/BE-04** · Motor de asignación + SLA con trazabilidad integral.
- [ ] **BE-07** · Contratos de fulfillment/pedidos estabilizados como v1.

### Frontend

- [x] **FE-01** · Ruta canónica tenant (`/t/:tenantSlug/*`) y redirects legacy cerrados.
- [ ] **FE-02** · `strict` habilitado en `api` + `context` sin regressions.
- [x] **FE-03** · Reinyección obligatoria de `X-Contact-Key` y `X-Conversation-Id` en wrappers HTTP.
- [x] **FE-04** · Checkout state machine con telemetría por transición.
- [ ] **FE-08** · Superficie de soporte con `request_id` (analytics + tickets públicos) visible/copiable en UI para debugging.
- [x] **FE-P1** · Banner de calidad de datos usando `alert_count` y `slo_status`.

### Cadencia sugerida

- **Semanal (lunes):** actualizar este tablero con owner y bloqueo principal.
- **Quincenal:** revisar KPIs `% eventos con contact_key` y `% endpoints sin fallback legacy`.
- **Mensual:** congelar un paquete de contratos nuevos (máx. 2 dominios por ciclo).

### Artefactos vinculados

- `docs/analytics.identity_coverage.v1.contract.md`
- `docs/shared.error.v1.contract.md`
- `docs/rbac.capability_matrix.v1.md`


## 6) Continuidad SaaS y autoservicio por vertical — septiembre 2026

Detalle y referencias primarias: `docs/ORGANIZATION_PROFILE_WORKSPACE_RELEASE.md`.
Complementa el plan white label del PR #1739; no reemplaza CT/BE/FE ni los gates
pendientes de Render/Vercel/Neon. No implica que TDF ya tenga Full productivo.

- **SS-PROFILE (implementado en este corte, publicación por verificar):** perfil
  institucional existente con identidad y secciones recibidas del backend según
  municipio/gobierno/colegio/empresa/pyme, sin convertir a todos en Empresa.
- **SS-CONTINUITY (criterio transversal):** conservar organización, usuarios,
  credenciales e integración de Junín; personalizar no crea otra aplicación ni número.
- **UX-DEVICE (implementado en el perfil, resto por certificar):** corregir ancho
  implícito de grid y desplazamiento interno que ocultaba información en móvil;
  probar también el formulario interno, no sólo overflow del documento.
- **SS-SELF-SERVICE (siguientes fases):** identidad versionada, invitaciones/roles,
  onboarding reanudable e idempotente y diagnósticos de integraciones por tenant.
- **WL-DOMAIN/PWA (pendiente):** dominio elegido bajo control del cliente, DNS/TLS,
  identidad instalada y aislamiento por origen; no confundir link_web con un dominio
  de acceso verificado ni emulación de viewport con instalación física.
- **SS-PLAN (mantener separado):** Full vigente, autorización de usuario y conexión
  del proveedor son condiciones independientes; no conceder derechos desde React.
- **BENCH-ONBOARDING (planificado):** medir altas de autoservicio, minutos manuales,
  bloqueos y primera tarea completada. Referencia funcional respond.io y Jelou;
  no copiar métricas comerciales como resultados de Chatboc.
- **DEP-UPGRADE (planificado):** evaluar React 19 y Vite actual con matriz de
  compatibilidad y regresiones. Versiones instaladas y soporte revisados; sin
  cambiar dependencias en este sprint ni generar forks por cada organización.

### SS-PROFILE-SAVE: perfil institucional y edicion colaborativa

Implementacion: revision esperada, recibo verificable, campos institucionales y
auditoria en una transaccion. Perfil personal e institucional conservan su alcance.
Interfaz: comparacion de versiones, conflictos con eleccion explicita, conservacion
de cambios, confirmacion de descarte y aviso de cierre segun soporte del navegador.
Detalle: docs/ORGANIZATION_PROFILE_SAVE_RELEASE.md.

Pendiente: release backend/frontend coordinada y prueba autorizada de lectura y
guardado en QA. Esto no cierra la operacion productiva, marca blanca completa,
integracion de horarios con agentes ni la migracion de infraestructura.

### SS-PROFILE-ACCEPTANCE: sesiones y SPA reales sobre entorno desechable

Implementado: prueba coordinada con create_app, login por contraseña, sesiones,
middleware, roles y persistencia reales; sin mocks de autorización ni API.
Corregidos país vacío convertido en cambio falso y administración delegada
bloqueada por rol global. Mensajes de mantenimiento separados de permisos.
Contrato editability opcional y contrastes del perfil revisados en modo oscuro.

Evidencia y ejecución: docs/ORGANIZATION_PROFILE_HTTP_ACCEPTANCE.md. CI frontend
mantiene suite/tipos/build/fixtures; CI backend suma diez recorridos HTTP completos
y conserva PostgreSQL para concurrencia. El recorrido SPA coordinado es local.
Sigue abierto el gate de aceptación institucional contra QA desplegado y la
publicación coordinada. No se cierra WhatsApp del proveedor, MFA, las ocho
migraciones ni el 503 de arranque en frío por pasar estas pruebas.

### SS-STARTUP-UX: recuperación clara y par inmutable de Preview

Implementado para release: estados de inicio/espera/offline/error/versiones,
reintento de lectura sin recarga ni repetición de acciones; pantalla ya montada
permanece estable. Interfaz neutra por marca, claro/oscuro, teclado y movimiento
reducido. No reconfigura la identidad del cliente ni introduce contenido de negocio.
El flujo QA admite un candidato de backend exacto con SHA requerida, manteniendo
las ocho rutas auditadas y el rechazo de producción. Pin verificado en bundle.
Detalle y comandos: docs/STARTUP_RECOVERY_RELEASE.md. La verificación del par y
la autenticación institucional son gates diferentes; no se cambian alias estables
ni escrituras por construir el candidato. Cold start y ocho migraciones pendientes
conservan su seguimiento. Junín y el piloto TDF no se duplican ni se reconfiguran.

### SS-RUNTIME-RESUME: continuidad del trabajo al volver a la plataforma

Implementado: aviso no modal en la barra existente; comprobación segura al volver
a una pestaña o reconectar, con lease corto y un único GET concurrente. No hay
polling, recarga de ruta, cierre de sesión ni repetición de acciones de negocio.
Diferencia entre red informada, servicio verificado y resultado de acciones previas.
La altura medida de la cabecera evita ocultar los controles del aviso, también
al cambiar de tamaño. Contrastes, teclado y movimiento reducido cubiertos.

Detalle y evidencia: docs/RUNTIME_RESUME_RELEASE.md. Se mantiene pendiente resolver
la latencia de arranque del servidor con mediciones remotas y cerrar aceptación
institucional de QA. Este corte no sustituye migraciones, WhatsApp real o PWA física.

### SS-ORGANIZATION-SETUP: centro de configuración por vertical

Implementado: proyección opcional v2 por tipo autenticado (municipio, gobierno,
colegio, empresa, pyme o genérico), preservando el contrato gubernamental v1.
UI guiada por evidencia del servidor, próximos pasos y enlaces con scope de ida
y retorno; detalles técnicos diferenciados y continuidad de cuentas/canales.
No convierte sender registrado en conectado ni una etapa lista en salida productiva.

Cierre de aislamiento visual: respuestas A-B-A, rechazo de acceso, fuente inválida,
error temporal sin acciones y eliminación de inferencia de /implementacion como
tenant público. Se mantienen permisos, planes y reglas de provisión existentes.
Documentación/evidencia: docs/ORGANIZATION_SETUP_WORKSPACE.md.

Siguientes gates: selección de módulos por cliente, marca/dominio versionados,
aceptación institucional en QA y publicación coordinada. Mantener separados los
pendientes de migración, WhatsApp/Meta/Twilio y pruebas de dispositivos físicos.
