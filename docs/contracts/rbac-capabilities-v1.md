# RBAC + Capabilities v1

Estado: **Draft congelable**  
Última actualización: 2026-04-14

## Roles base

- `superadmin`
- `tenant_admin`
- `employee` / `agent`
- `catalog_manager`
- `analytics_viewer`
- `end_user` / `chat_user`

## Matriz mínima por dominio

| Dominio | Capabilities ejemplo | Roles objetivo |
| --- | --- | --- |
| Tickets/Reclamos | `tickets.read`, `tickets.assign`, `tickets.update_status` | `tenant_admin`, `employee`, `agent` |
| Encuestas | `surveys.read`, `surveys.manage`, `surveys.export` | `tenant_admin`, `analytics_viewer` |
| Catálogo/Market | `catalog.read`, `catalog.manage`, `orders.read` | `catalog_manager`, `tenant_admin` |
| Analytics | `analytics.read`, `analytics.export` | `analytics_viewer`, `tenant_admin`, `superadmin` |
| Superadmin | `platform.admin`, `tenants.manage` | `superadmin` |

## Reglas frontend

1. Menús y rutas protegidas deben evaluar `requiredCapabilities`/rol.
2. Si backend niega acceso:
   - mostrar `/403`,
   - CTA de solicitud de acceso,
   - evento `permission_denied` con contexto.

## Reglas backend

1. Sesión debe devolver capabilities normalizadas.
2. Rechazo uniforme con envelope:

```json
{
  "error": {
    "code": 403,
    "message": "No autorizado para capability tickets.assign"
  }
}
```
