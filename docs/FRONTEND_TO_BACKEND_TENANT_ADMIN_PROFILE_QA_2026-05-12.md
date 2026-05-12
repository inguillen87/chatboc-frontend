# Frontend to Backend Sync - Tenant Admin Profile QA 2026-05-12

Fecha: 2026-05-12

Objetivo: dejar asentado lo que frontend ya integró para el perfil operativo SaaS de cada tenant y el command center superadmin, sin crear una app paralela ni reemplazar legacy.

## 1. Frontend ya consume

### Tenant admin experience

Endpoints:

- `GET /api/v2/tenant/admin-experience`
- `GET /api/v2/tenants/{tenant_slug}/admin-experience`

Uso frontend:

- El home admin de un tenant ahora renderiza un panel tipo `tenant_admin_operating_system`.
- Header compacto con nombre, vertical/tipo, plan, health y readiness.
- Menu lateral desde `modules[]`; frontend usa `id`, `label`, `endpoint`, `route`, `widgets` cuando estén.
- Cards densas para readiness, operations freshness, marketplace, surveys/votings, leads y education.
- No se hardcodean labels por tenant/rubro; cuando falta dato se muestra estado neutro.

Campos que conviene mantener estables:

```json
{
  "contract_version": "tenant.admin_experience.v1",
  "tenant": {
    "slug": "colegio-demo",
    "tipo": "pyme",
    "vertical": "educacion",
    "subvertical": "colegio",
    "plan": "growth",
    "is_active": true
  },
  "profile": {
    "display_name": "Colegio Demo",
    "status": "active",
    "readiness": {
      "contract_version": "tenant.readiness.v1",
      "score": 87.5,
      "checks": {}
    }
  },
  "modules": [],
  "operations": {
    "dashboard": { "summary": {} },
    "freshness": { "status": "fresh", "summary": {} }
  },
  "lead_capture": { "items": [] },
  "surveys_votings": { "summary": {} },
  "marketplace": { "summary": {}, "media_capabilities": {} },
  "education": { "admin_menu": { "panel_sections": [] } },
  "frontend_contract": {
    "render_as": "tenant_admin_operating_system",
    "primary_refresh_seconds": 30
  },
  "request_id": "req_..."
}
```

### Superadmin command center

Endpoint:

- `GET /api/v2/superadmin/command-center`

Uso frontend:

- Se agregó bloque `Command center v2` dentro de `/superadmin` y `/admin/tenants`.
- KPIs globales desde `summary`.
- Lista de drilldowns desde `tenants.top_risky` o `tenants.items`.
- `tenant_creation.endpoint` se muestra como fuente para crear tenant.

Campos que conviene mantener estables:

```json
{
  "contract_version": "superadmin.command_center.v1",
  "summary": {
    "tenants": 12,
    "active_tenants": 10,
    "avg_health_score": 84.1,
    "open_tickets": 33,
    "overdue_tickets": 2,
    "open_leads": 18,
    "risky_tenants": 3
  },
  "tenants": {
    "items": [],
    "top_risky": []
  },
  "tenant_creation": {
    "endpoint": "/api/admin/tenants",
    "method": "POST",
    "required_fields": ["nombre", "tipo"],
    "supported_verticals": ["empresas", "gobierno", "educacion"]
  },
  "frontend_contract": {
    "render_as": "superadmin_command_center",
    "drilldown_endpoint_template": "/api/v2/tenants/{tenant_slug}/admin-experience"
  },
  "request_id": "req_..."
}
```

## 2. Ajustes que frontend necesita de backend

- `modules[]` debe traer `id`, `label`, `route`, `endpoint`, `secondary_endpoints` y `widgets` de forma consistente.
- `tenants.items[]` y `tenants.top_risky[]` deberían traer al menos `slug` o `tenant_slug`, `display_name` o `tenant_name`, `health_score`, `status` y `risk_reason`.
- `marketplace.summary` debería estabilizar `with_images`, `missing_images`, `products_without_image` y `bulk_import_status`.
- `lead_capture.items[]` debería traer `id`, `ticket_id`, `status`, `channel`, `created_at`, `contact`, `intent`, `next_action`.
- `education.admin_menu.panel_sections[]` debería mantener `id`, `label`, `endpoint`, `route`, `widgets` para render escolar.
- `operations.freshness.summary.can_render_heatmap` debe venir booleano para no mostrar mapa roto.
- En errores, seguir devolviendo `request_id` o header `X-Request-Id`.

## 3. Verificacion frontend

Ejecutado local:

- `vite build` OK.
- `vitest run src/features/chat/chatApi.test.ts src/api/market.test.ts --pool=threads` OK, 10 tests passed.

Nota: `tsc -p tsconfig.app.json --noEmit` sigue fallando por deuda global previa de tipado en la repo, especialmente `BadgeProps`, tests sin globals, imports viejos de analyticsService y algunos componentes legacy. Build productivo no queda bloqueado.

## 4. Pendientes frontend siguientes

- Drawer 360 para `lead_capture.items[]` conectado a `/api/v2/inbox/omnichannel`.
- Mapa operativo completo con layers desde `/api/v2/analytics/operations/heatmap`.
- Marketplace quality queue para productos sin imagen.
- Acciones rápidas superadmin: impersonate, health, crear admin y configurar WhatsApp desde `tenant_creation`/`actions` backend.
