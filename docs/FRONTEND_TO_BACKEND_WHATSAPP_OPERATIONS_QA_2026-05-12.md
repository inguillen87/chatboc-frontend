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
- Si `channel.enabled=false`, frontend muestra setup/degradacion segura en lugar de romper pantalla.

## Reglas respetadas

- No se hardcodean flujos por municipio, pyme o colegio.
- Labels de modulos/capacidades priorizan `label`, `title`, `name`, `nombre` del backend.
- Las keys se formatean solo como fallback neutro.
- No se muestra voz si el contrato realtime no lo habilita.
- El endpoint completo de WhatsApp se usa como progressive enhancement; si falla, queda el resumen de admin-experience.

## Pedido backend/deploy

- Confirmar que `GET /api/v2/whatsapp/experience` responde `whatsapp.experience.v1` con `request_id`.
- Confirmar alias `GET /api/v2/tenants/{tenant_slug}/whatsapp/experience`.
- Incluir dentro de `GET /api/v2/tenant/admin-experience` al menos un resumen en `whatsapp`, `whatsapp_experience` o `widget_whatsapp`.
- En `modules[]`, idealmente enviar:

```json
{
  "id": "widget_whatsapp",
  "label": "Widget/WhatsApp/Voz",
  "endpoint": "/api/v2/whatsapp/experience"
}
```

- Para video, mantener `analysis_ready=false` hasta que haya analisis IA real.
- Para voz, mantener la regla:
  - `conversation_intelligence.voice_calls.enabled === true`
  - `conversation_intelligence.voice_calls.capabilities.native_speech_to_speech === true`
- Para tracking, si no hay coordenadas reales, mantener `fallback_when_no_coordinates: "timeline_only"`.
- Para tracking publico, responder siempre JSON desde:
  - `/api/public/tracking/experience?kind=claim&code={code}&pin={pin}`
  - `/api/public/tracking/experience?kind=order&code={code}`
- El contrato de tracking puede incluir `timeline`, `events`, `milestones`, `current_status`, `render_contract`, `map` y `request_id`; el frontend lo renderiza de forma tolerante.
