# Frontend to Backend Sync - Admin Panel, Encuestas, Catalogo y Analytics 2026-05-13

Fecha: 2026-05-13

Objetivo: eliminar ruido visible y evitar mocks/fallbacks. Frontend debe renderizar datos reales del backend o un estado limpio accionable.

## Hallazgos en produccion

- `GET /api/v2/tenants/junin-1/admin-experience?tenant_slug=junin-1&tenant=junin-1` devuelve 500 HTML. Debe responder JSON accionable con `request_id`.
- `GET /api/public/encuestas/v1` y `GET /public/encuestas/v1` devuelven 404.
- `GET /api/public/encuestas/v1/{slug}` y `GET /public/encuestas/v1/{slug}` devuelven 404 para votaciones en vivo.
- Analytics municipales llaman endpoints ausentes o no publicados: `/api/analytics/report/latest`, `/api/analytics/identity/coverage`, `/api/admin/analytics/whatsapp-funnel`.
- En tenant municipio `junin-1`, el catalogo publico llego mezclado con productos de pyme/bodega. El carrito rechaza items sin `catalogo_item_id`.

## Contratos necesarios sin fallback

### Tenant admin experience

- `GET /api/v2/tenants/{tenant_slug}/admin-experience`
- Debe devolver `tenant.admin_experience.v1` o error JSON.
- No devolver HTML ante excepcion.
- Si falta data, devolver modulos vacios/disabled con `reason_code`, no 500.
- Excluir modulos de portal de usuario final del bundle admin, o marcarlos como `audience: "end_user"` para que el frontend no los muestre en admin.

### Encuestas publicas

- `GET /api/public/encuestas/v1`
- `GET /public/encuestas/v1`
- `GET /api/public/encuestas/v1/{slug}`
- `GET /public/encuestas/v1/{slug}`
- Responder JSON con `contract_version`, `items` o detalle de encuesta/votacion.
- Si el slug no existe, responder JSON con `status_code`, `reason_code`, `action_hint`, `request_id`.
- Las votaciones live deben incluir resultados, comentarios y heatmap reales cuando esten disponibles.

### Catalogo y carrito tenant-safe

- `GET /api/public/tenants/{tenant_slug}/catalog` debe filtrar estrictamente por tenant.
- Cada item publicable debe traer `tenant_slug` y `catalogo_item_id` real.
- Si el item es demo, mock o pertenece a otro rubro/tenant, no debe salir en el catalogo publico del tenant.
- `POST /api/{tenant_slug}/carrito` debe aceptar el mismo `catalogo_item_id` publicado por el catalogo.

### Analytics operativos

- Publicar o retirar del contrato frontend los endpoints:
  - `/api/analytics/report/latest`
  - `/api/analytics/identity/coverage`
  - `/api/admin/analytics/whatsapp-funnel`
- Si existen, deben responder JSON + CORS + `X-Request-Id`.
- Si no estan disponibles, el contrato admin debe marcarlos como disabled para que frontend no los llame.

### Landing hero conversacional real

- `GET /api/public/landing-experience` debe publicar `hero.conversation_demo` cuando haya una demo real trazable.
- Cada flow debe representar una accion real por rubro: reclamo municipal, pedido/lead pyme, caso escolar o votacion/sondeo.
- No mandar logos grandes como reemplazo de demo. Si no hay demo real, omitir `conversation_demo`.
- Cada demo accionable debe traer inputs reales cuando existan: imagen, ubicacion, audio, archivo o texto.
- Si se manda una imagen, `preview_url` debe ser una URL valida y accesible. Si no hay imagen real, no mandar `preview_url`.
- Si el agente crea algo, incluir `action` con `label`, `status`, `detail` y `fields` con ids reales o trazables.
- Incluir `workflow_steps`, `highlights` y `metrics` solo cuando representen pasos/datos reales del flujo.
- El CTA principal debe llevar a una demo o captura de lead funcional; si backend rechaza el lead, responder validacion JSON con campos requeridos.
- `POST /ask/municipio` y aliases de demo no deben devolver 500 para `demo_session_id` valido. Deben responder contrato JSON del chat o error accionable con `request_id`.
- `POST /api/public/lead-capture` debe aceptar el payload de landing/demo y crear lead real para seguimiento comercial o devolver validacion JSON especifica.
- No publicar ids, metricas, productos, tickets ni heatmaps inventados para llenar la landing.

## Cambios frontend aplicados

- Portal de usuario final queda bloqueado para usuarios backoffice. Si un admin entra a `/portal/*` o `/:tenant/portal/*`, vuelve a `/perfil`.
- El sistema operativo tenant filtra aliases de portal de usuario final y no deja seleccionado un modulo filtrado.
- Errores HTML del admin experience se limpian en UI; backend sigue debiendo devolver JSON.
- Catalogo tenant agrega defensa por señales explicitas de vertical/sector para evitar mezcla municipio/pyme si el backend manda esas señales.
- Estadisticas municipales envuelven graficos en contenedor medido para evitar Recharts con ancho/alto invalidos.
- Hero de landing ahora renderiza una demo conversacional tipo mobile desde `hero.conversation_demo`: tabs por rubro, mensaje usuario, adjuntos, respuesta IA, accion creada, pasos y metricas.
- Frontend oculta imagenes rotas del hero. No muestra placeholders: si `preview_url` no carga, se elimina visualmente y queda solo el dato textual recibido.

## Pendiente backend

No resolver con mocks. La prioridad es publicar contratos reales, tenant-safe y con errores JSON accionables.
