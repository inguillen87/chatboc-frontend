# Frontend SaaS Audit + Backend Handoff 2026-05-09

Objetivo: avanzar frontend y backend como una sola plataforma SaaS, sin crear una app paralela, sin romper legacy y respetando el principio white label: el frontend renderiza contratos, acciones, textos y estados que vienen del backend.

## 1. Resultado frontend P1

Se hizo una primera pasada funcional sobre landing/demo/widget/rutas operativas para bajar errores reales de runtime y dejar la app mas tolerante a contratos backend actuales y futuros.

Cambios aplicados:

- Demo y widget: el demo ya no muestra errores crudos cuando el chat falla; degrada con mensaje operativo y conserva la experiencia.
- Demo selector: se consolidan los 3 pilares principales: gobiernos, empresas y colegios.
- Rutas tenant: se evito que rutas como `/pyme/metrics`, `/pyme/catalog` o `/market/blueprint` sean tratadas como slugs de tenant.
- Portal tenant canonico: se agregaron rutas `/t/:tenant/...` para pantallas del portal educativo/admin.
- Superadmin: se corrigieron imports/componentes faltantes que rompian el dashboard.
- CRM, municipal, tramites, encuestas y metricas: ahora toleran arrays legacy o envelopes tipo `{ items }`, `{ surveys }`, `{ data }`, `{ results }`.
- Feature flags educacion: las pantallas educativas quedan disponibles por defecto, siempre desactivables por env.
- E2E local: se reforzo smoke de landing, demo, widget, educacion y fallbacks de chat.

## 2. Verificacion frontend ejecutada

Comando principal:

```bash
npm run verify:local
```

Resultado:

- Build Vite OK.
- Unit/integration tests OK: 64 archivos, 241 tests.
- E2E Chromium OK: 4 tests.
- Smoke manual/Playwright en preview productiva: 15/15 rutas renderizaron sin errores runtime relevantes.

Rutas smokeadas:

- `/`
- `/demo`
- `/demo/municipio`
- `/market/blueprint`
- `/tickets/board`
- `/enterprise`
- `/admin/tenants`
- `/pyme/metrics`
- `/crm/integrations`
- `/municipal/tramites`
- `/municipal/integrations`
- `/municipal/surveys`
- `/municipal/analytics`
- `/educacion`
- `/t/demo/educacion/staff/inbox`

Nota honesta: `npm run typecheck` sigue teniendo deuda TypeScript amplia preexistente en el repo. No bloquea build/test actual, pero debe ser una tanda propia.

## 3. Blockers backend reales detectados en produccion

### Realtime voice capabilities

Consola produccion:

- `GET /api/public/realtime/voice-capabilities` devuelve 404.
- `GET /public/realtime/voice-capabilities` devuelve 404.
- Preflight CORS contra `https://chatbot-backend-2e14.onrender.com/api/public/realtime/voice-capabilities` falla porque no recibe HTTP OK.

Pedido backend:

- Exponer canonico `GET /api/public/realtime/voice-capabilities`.
- Habilitar CORS para `https://www.chatboc.ar` y `https://chatboc.ar`.
- Responder tambien `OPTIONS` con 2xx.
- Si el backend desplegado todavia no tiene el contrato, ocultar o devolver `features.tool_calling=false` desde widget-config.

Shape esperado:

```json
{
  "contract_version": "realtime.voice_capabilities.v1",
  "provider": "openai_realtime",
  "recommended_model": "gpt-realtime-2",
  "fallback_model": "gpt-realtime-1.5",
  "voice": "marin",
  "active_vertical": "municipio",
  "native_speech_to_speech": true,
  "features": {
    "barge_in": true,
    "server_vad": true,
    "tool_calling": true,
    "whatsapp_followup": true,
    "post_call_receipt": true,
    "human_handoff": true
  }
}
```

### Demo session sector/rubro

Consola produccion:

- `POST https://www.chatboc.ar/api/v2/demo/session` devuelve 400.
- Mensaje visible: `rubro o tenant_slug es obligatorio`.

Pedido backend:

- Para `sector: "educacion"` permitir iniciar con tenant demo por defecto, por ejemplo `colegio-demo`, o devolver opciones accionables.
- Para `sector: "gobierno"` y `sector: "empresas"` devolver primer rubro demo valido si el usuario todavia esta eligiendo categoria.
- Si sigue siendo 400, el error debe incluir `required_fields`, `fallback_options` y `request_id`.

Ejemplo deseado:

```json
{
  "error": {
    "code": 400,
    "message": "Elegí una categoría para iniciar el demo.",
    "required_fields": ["rubro"],
    "fallback_options": [
      { "sector": "educacion", "tenant_slug": "colegio-demo", "label": "Colegio demo" }
    ]
  },
  "request_id": "req_123"
}
```

### Socket realtime

Consola produccion:

- `/socket.io/?EIO=4&transport=polling` devuelve 404.
- WebSocket `wss://www.chatboc.ar/socket.io` falla.

Pedido backend/deploy:

- O servir Socket.IO en el dominio/proxy productivo.
- O publicar en widget-config/realtime config que socket esta deshabilitado para que frontend no intente conectar.

Contrato recomendado:

```json
{
  "realtime": {
    "socket_enabled": false,
    "socket_url": null,
    "fallback_mode": "polling_disabled"
  }
}
```

### Auth/profile/capabilities

Varias pantallas protegidas dependen de perfil, tenants y capacidades. Frontend puede tolerar nested/top-level, pero backend deberia estabilizar:

```json
{
  "user": {
    "id": 1,
    "email": "admin@tenant.com",
    "rol": "admin",
    "tenant_slug": "demo",
    "capabilities": {}
  },
  "tenant": {
    "id": 1,
    "slug": "demo",
    "vertical": "educacion"
  }
}
```

Endpoints involucrados:

- `GET /api/me`
- `GET /api/auth/me`
- `GET /app/me/tenants`
- `GET /api/v2/tenants/current`

### Education operational endpoints

Frontend ya esta listo para consumir estos contratos si estan disponibles:

- `GET /api/v1/education/admin/menu`
- `GET /api/v1/education/operations/summary`
- `GET /api/v1/education/operations/heatmap`
- `GET /api/v1/education/cases?envelope=1`
- `GET /api/v1/education/tenant/capabilities`

Pedido backend:

- Mantener array legacy en `GET /api/v1/education/cases`.
- Mantener envelope cuando `envelope=1`.
- Incluir `panel_sections[].endpoint` para que el frontend no invente navegacion.

### Legacy municipal/CRM/metrics

Frontend ahora tolera respuesta array o envelope, pero backend deberia estabilizar envelopes para:

- `GET /crm/integrations`
- `GET /municipal/tramites`
- `GET /municipal/integrations`
- `GET /municipal/surveys`
- `GET /api/metrics/summary`
- `GET /api/metrics/kpis`
- `GET /api/metrics/sales`
- `GET /api/metrics/products`
- `GET /api/metrics/regions`

Formato preferido:

```json
{
  "contract_version": "resource.list.v1",
  "items": [],
  "summary": {},
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 0
  },
  "request_id": "req_123"
}
```

### Same-origin production proxy

El frontend en `https://www.chatboc.ar` llama rutas `/api/*`. El deploy debe garantizar:

- `/api/*` proxy real al backend.
- `OPTIONS /api/*` responde OK cuando corresponda.
- Errores siempre JSON, no HTML.
- `X-Request-Id` visible para depurar.

## 4. Prioridad recomendada para backend

1. Rompe UX actual: demo session 400, realtime voice 404/CORS, Socket.IO 404.
2. Desbloquea pantallas ya implementadas: education operations, tenant capabilities, auth/me estable.
3. Mejora datos SaaS: envelopes consistentes en municipal/CRM/metrics.
4. Nice-to-have: aliases legacy adicionales solo si no duplican producto.

## 5. Proxima tanda frontend recomendada

- Rediseñar landing y paginas cercanas por secciones, manteniendo contenido backend-driven.
- Convertir el smoke de rutas en suite e2e permanente.
- Limpiar deuda TypeScript por dominios, empezando por auth/tenant/analytics.
- Gatear realtime/socket desde config backend antes de cualquier fetch/conexion.
- Consolidar helpers de normalizacion para no duplicar parsing de envelopes.
- Agregar experiencias demo por vertical con assets/PDFs profesionales servidos como contenido estatico o contrato backend.

