# Frontend to Backend - Backoffice Operations CRM Requirements

Fecha: 2026-05-16

## Objetivo

Elevar el panel administrativo a una experiencia comparable con CRMs y mesas operativas maduras: una persona administrativa debe entrar y entender que atender primero, quien lo tiene asignado, que esta vencido, que se vendio, que usuario/contacto existe y que equipo esta cubriendo cada cola.

Frontend no debe inventar datos operativos. Backend debe publicar contratos compactos y trazables para tickets, reclamos, pedidos, usuarios y empleados.

## Tickets / Reclamos / Conversaciones

Endpoint recomendado:

`GET /api/v2/backoffice/operations/inbox-summary?tenant_slug=<slug>&scope=<municipio|pyme|colegio>`

Respuesta esperada:

```json
{
  "contract_version": "backoffice.inbox_summary.v1",
  "request_id": "req_...",
  "tenant_slug": "junin-1",
  "scope": "municipio",
  "summary": {
    "total": 128,
    "open": 42,
    "unread": 9,
    "sla_risk": 6,
    "resolved": 86,
    "unassigned": 4
  },
  "filters": {
    "channels": [],
    "statuses": [],
    "areas": [],
    "agents": [],
    "priorities": [],
    "sla_statuses": []
  },
  "recommended_views": [
    {
      "id": "sla_risk",
      "label": "Riesgo SLA",
      "description": "Casos vencidos o por vencer.",
      "query": { "sla": "risk" }
    }
  ]
}
```

Reglas:

- `label`, `description`, `statuses`, `areas`, `agents` y vistas recomendadas salen del backend.
- Frontend solo renderiza y aplica filtros.
- Cada ticket debe traer `request_id` cuando hubo una accion, `detail_endpoint`, `allowed_actions`, `sla_status`, `priority`, `assigned_agent` y `recommended_next_action` cuando existan.

## Pedidos

Endpoint recomendado:

`GET /api/v2/backoffice/orders/summary?tenant_slug=<slug>`

Debe publicar:

- totales por estado,
- pedidos activos,
- pedidos finalizados,
- ingresos confirmados,
- ingresos pendientes,
- pedidos sin responsable,
- acciones permitidas por estado.

No confirmar monto final si el backend no lo valido.

## Usuarios / Contactos

Endpoint recomendado:

`GET /api/v2/backoffice/contacts/summary?tenant_slug=<slug>`

Debe publicar:

- total de contactos,
- con telefono,
- con email,
- opt-in marketing,
- canales principales,
- segmentos disponibles,
- duplicados posibles,
- contactos sin datos minimos.

Frontend necesita `segments` para filtros, no reglas hardcodeadas.

## Empleados / Equipo

Endpoint recomendado:

`GET /api/v2/backoffice/team/coverage-summary?tenant_slug=<slug>`

Debe publicar:

- empleados activos,
- categorias cubiertas,
- categorias sin responsable,
- zonas cubiertas,
- canales cubiertos,
- workload por agente,
- recomendaciones de asignacion,
- permisos y scope editables.

## Exportaciones

Endpoint recomendado:

`POST /api/v2/backoffice/export`

Body:

```json
{
  "tenant_slug": "junin-1",
  "resource": "tickets|orders|contacts|team",
  "format": "pdf|csv|xlsx",
  "filters": {},
  "include_ai_summary": true
}
```

Respuesta:

```json
{
  "ok": true,
  "request_id": "req_...",
  "download_url": "https://...",
  "expires_at": "2026-05-16T23:59:59Z"
}
```

## IA Ejecutiva

Endpoint recomendado:

`POST /api/v2/backoffice/executive-summary`

Debe responder con:

- `headline`,
- `risks`,
- `opportunities`,
- `recommended_actions`,
- `confidence`,
- `data_quality_notes`,
- `source_endpoints`.

La IA debe explicar si la muestra es insuficiente. Frontend no debe presentar conclusiones fuertes cuando backend marque baja confianza.

## Criterios de Aceptacion

- Una bandeja operativa se entiende en menos de 30 segundos.
- Un administrativo sabe que caso/pedido/contacto atender primero.
- Un supervisor sabe que empleado o categoria esta sobrecargada.
- Un export PDF/CSV/XLSX se genera desde filtros reales.
- No hay datos inventados en frontend.
- Cada accion importante conserva `request_id`.
