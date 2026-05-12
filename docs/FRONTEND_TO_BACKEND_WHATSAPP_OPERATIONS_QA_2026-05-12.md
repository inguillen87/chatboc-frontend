# Frontend to Backend Sync - WhatsApp Operations QA 2026-05-12

Fecha: 2026-05-12

Objetivo: consumir `whatsapp.experience.v1` como modulo operativo premium dentro del panel tenant, sin crear una pantalla paralela ni duplicar flujos legacy.

## Aplicado frontend

- Se agrego cliente v2:
  - `GET /api/v2/whatsapp/experience`
  - `GET /api/v2/tenants/{tenant_slug}/whatsapp/experience`
- `tenant.admin_experience.v1` ahora puede exponer `whatsapp`, `whatsapp_experience` o `widget_whatsapp`; frontend lo normaliza como resumen inicial.
- Se agrego `WhatsappOperationsHub` dentro del Tenant Admin OS.
- Si el modulo `widget_whatsapp` no viene en `modules[]` pero el bundle trae datos de WhatsApp, frontend agrega una entrada operativa local neutra para no perder la vista.
- El hub renderiza:
  - salud del canal: provider, numero, webhook, status webhook y reason code.
  - boton de prueba del canal solo si backend publica `channel.test_endpoint`, `channel.healthcheck_endpoint` o `channel.test_action_endpoint`.
  - reglas enterprise: templates fuera de 24h, limite outbound, quiet hours y bloqueos.
  - ventana 24h: contactos activos y conocidos.
  - capacidades conversacionales compactas desde `conversation_intelligence.inputs`.
  - voz realtime solo si `voice_calls.enabled === true` y `capabilities.native_speech_to_speech === true`.
  - video como adjunto/estado, sin prometer analisis IA si `analysis_ready === false`.
  - modulos de contenido: catalogo, encuestas/votaciones, noticias/eventos, promociones y links.
  - alerta accionable si `catalog.image_coverage_rate` es bajo.
  - tracking tipo courier desde `tracking.claims`, `tracking.orders`, `tracking.courier_style_map` y `tracking.milestones`.
  - `tracking.claims.experience_endpoint` y `tracking.orders.experience_endpoint` como contrato principal para seguimiento publico.
  - probador operativo de `GET /api/public/tracking/experience` con `kind=claim|order`, `code` y `pin` cuando aplique.
  - progreso visual del tracking y mini mapa solo cuando el contrato publico trae coordenadas `lat/lng`, `latitude/longitude` o aliases equivalentes.
- Si `channel.enabled=false`, frontend muestra setup/degradacion segura en lugar de romper pantalla.

## Reglas respetadas

- No se hardcodean flujos por municipio, pyme o colegio.
- Labels de modulos/capacidades priorizan `label`, `title`, `name`, `nombre` del backend.
- Las keys se formatean solo como fallback neutro.
- No se muestra voz si el contrato realtime no lo habilita.
- El endpoint completo de WhatsApp se usa como progressive enhancement; si falla, queda el resumen de admin-experience.

## QA backend confirmado 2026-05-12

- `GET /api/v2/whatsapp/experience` responde `whatsapp.experience.v1` con `request_id` y header `X-Request-Id`.
- `GET /api/v2/tenants/{tenant_slug}/whatsapp/experience` queda cubierto como alias tenant-aware.
- `GET /api/v2/tenant/admin-experience` incluye resumen WhatsApp y el modulo `widget_whatsapp`.
- El modulo `widget_whatsapp` expone:

```json
{
  "id": "widget_whatsapp",
  "label": "Widget/WhatsApp/Voz",
  "endpoint": "/api/v2/whatsapp/experience"
}
```

- Video se mantiene como adjunto con `analysis_ready=false`.
- Voz se habilita solo con:
  - `conversation_intelligence.voice_calls.enabled === true`
  - `conversation_intelligence.voice_calls.capabilities.native_speech_to_speech === true`
- Tracking conserva `experience_endpoint` para claim/order y `fallback_when_no_coordinates: "timeline_only"`.
- `GET /api/public/tracking/experience` responde JSON con `tracking.experience.v1`, `request_id`, timeline, status, mapa/render contract y errores JSON accionables.
- Para tracking publico, frontend usa:
  - `/api/public/tracking/experience?kind=claim&code={code}&pin={pin}`
  - `/api/public/tracking/experience?kind=order&code={code}`
- El contrato de tracking puede incluir `timeline`, `events`, `milestones`, `current_status`, `render_contract`, `map` y `request_id`; el frontend lo renderiza de forma tolerante.
- Para mostrar el boton de prueba del canal, backend puede agregar en `channel`:

```json
{
  "test_endpoint": "/api/v2/whatsapp/test",
  "test_method": "POST",
  "test_label": "Probar canal"
}
```

Si esos campos no vienen, frontend no inventa el boton.

## Verificacion frontend

- `vitest run src/api/v2/saas.whatsapp.test.ts --pool=threads` OK.
- `vite build` OK.
