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


## 4) Fase transversal: marca blanca y PWA multidispositivo

**Decisión comercial confirmada:** el plan Full activo incluye el uso del SaaS completo con identidad, dominio/URL y canales propios; no sólo un widget ni una plataforma nueva por cliente. Autoservicio en Configuración (marca, dominio, PWA, plan/consumo) e Integraciones (WhatsApp, pagos y otros canales).
**WL-FULL:** derecho comercial de servidor + tenant activo + permiso de usuario + conexión verificada; no desbloquear por flags editables o permisos genéricos. Integrar controles existentes, definir cuotas y upgrade/downgrade sin pérdida de datos. Versionar configuración de cada organización sobre versiones compartidas del producto, no ramas permanentes por cliente.

Estado: **PLANIFICADO**, incorporado por requerimiento de Marcelo. No declara funciones nuevas implementadas.
Especificación compartida, ownership y criterios de aceptación: [WHITE_LABEL_PWA_ENTERPRISE_PLAN](docs/WHITE_LABEL_PWA_ENTERPRISE_PLAN.md).

- **UX-DEVICE**: condición de terminado de cada módulo en móvil/tablet/escritorio, iPhone/iPad/Android y navegadores desktop. Incluye táctil/teclado, safe areas, modo oscuro, movimiento reducido, accesibilidad y evidencia física separada de emulación.
- **WL-00/01**: inventario y contrato de identidad por tenant, permisos, validación de assets y configuración pública sin secretos.
- **WL-02**: estudio de marca (nombre, logos, iconos, colores, soporte), vista previa, publicación auditada y rollback. Un build, no un fork por cliente.
- **WL-03**: dominio propio/subdominio verificado, HTTPS, autenticación, canonical URLs y aislamiento de sesiones/enlaces.
- **WL-04**: PWA de identidad propia, manifest/iconos, instalación y actualización seguras, cachés/storage/push separados; API sensible NetworkOnly.
- **WL-05**: misma identidad en widget, portal, encuestas, catálogos/pedidos y comunicaciones. Configuración/aprobaciones Meta/Twilio comprobadas por separado.
- **WL-06**: caso TDF con nombre/URL actuales por recuperar y segunda organización empresarial Full sobre todo el SaaS compartido. FARO es referencia histórica, no marca vigente; demo conceptual y tenant productivo no se confunden.

Dependencias: CT-01/02/04, BE-01/02/08 y FE-01/03/05/07; conservar contratos existentes y las líneas de septiembre.
La activación productiva depende además de los gates de Render/Vercel/Neon. Esta fase no autoriza cambios DNS, compras, migraciones, retiro de Render ni promoción de dominios.
Cada entrega registra estado planificado/implementado/probado/publicado y versión de esquema, aplicación, branding y dominio por separado.
