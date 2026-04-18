# Analytics events v1 (mínimo transversal)

Estado: **Draft congelable**  
Última actualización: 2026-04-14

## Envelope recomendado

```json
{
  "event_name": "ticket_created",
  "screen_name": "tickets_inbox",
  "tenant_id": "demo",
  "channel": "whatsapp",
  "contact_key": "contact_123",
  "metadata": {}
}
```

## Eventos mínimos obligatorios

- `message_received`
- `ticket_created`
- `ticket_assigned`
- `ticket_resolved`
- `survey_answered`
- `vote_submitted`
- `product_viewed`
- `cart_started`
- `checkout_created`
- `location_shared`
- `widget_session_opened`
- `portal_session_opened`
- `permission_denied`

## Campos de metadata recomendados

- `conversation_id`
- `sla_status`
- `priority`
- `required_capabilities` (cuando aplique)
- `from_route`
- `source` (`widget`, `portal`, `panel`, `whatsapp`)
