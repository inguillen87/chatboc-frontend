# Contrato compartido omnicanal v1 (Frontend + Backend)

Estado: **Draft congelable**  
Última actualización: 2026-04-14

## 1) Headers estándar

| Header | Requerido | Uso |
| --- | --- | --- |
| `X-Tenant-Slug` | Condicional | Scope del tenant en panel/portal. |
| `X-Contact-Key` | Sí (flujos de usuario) | Identidad omnicanal unificada del contacto. |
| `X-Conversation-Id` | Recomendado | Continuidad entre WhatsApp/widget/web. |
| `X-Chat-Session-Id` | Sí (chat/widget) | Continuidad de sesión de chat. |
| `X-Anon-Id` | Sí (público/widget) | Identidad anónima persistente. |
| `X-Entity-Token` | Condicional | Contexto firmado de embed/widget. |

## 2) Error envelope

```json
{
  "error": {
    "code": 400,
    "message": "detalle"
  }
}
```

## 3) Eventos realtime mínimos

- `conversation.message.created`
- `conversation.message.read`
- `ticket.status.changed`
- `ticket.assignment.changed`
- `ticket.unread.changed`

Payload mínimo recomendado:

```json
{
  "ticket_id": 123,
  "tenant_slug": "demo",
  "event_name": "ticket.status.changed",
  "updated_at": "2026-04-14T10:00:00Z"
}
```

## 4) Endpoints críticos (v1)

- `GET /api/public/encuestas`
- `GET /api/public/encuestas/:slug`
- `POST /api/public/encuestas/:slug/respuestas`
- `GET /api/analytics/identity/coverage`
- `GET /api/admin/analytics/whatsapp-funnel`
- `GET /api/tickets/:tipo/:id/timeline`

## 5) Deep links canónicos

- Tenant-facing: `/t/:tenantSlug/*`
- Prefijos legacy (`/market`, `/tenant`, `/municipio`, `/pyme`, `/m`) solo via redirect client-side.

## 6) Changelog de contrato

- **v1.0.0**: headers omnicanal, envelope de error, eventos realtime base, rutas canónicas por tenant.
