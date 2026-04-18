# Contract · `analytics.identity_coverage.v1`

## Endpoint
- `GET /api/analytics/identity/coverage`

## Query params
- `target_pct` (`number`, optional): objetivo global de cobertura.
- `target_by_channel` (`string`, optional): puede enviarse como JSON (`{"whatsapp":95,"widget":90}`) o formato compacto (`canal:valor,canal2:valor2`).
- `emit_alert_events` (`0 | 1`, optional): cuando es `1`, backend puede emitir `identity_coverage_alert`.

## Response shape (200)
```json
{
  "contact_key_coverage_pct": 96.4,
  "conversation_id_coverage_pct": 92.1,
  "combined_coverage_pct": 90.8,
  "target_pct": 95,
  "slo_status": "below_target",
  "alert_count": 2,
  "summary_message": "Cobertura por debajo de objetivo en canales críticos.",
  "alerts": [
    {
      "channel": "whatsapp",
      "message": "WhatsApp por debajo de objetivo",
      "current_pct": 89.2,
      "target_pct": 95
    }
  ]
}
```

## Notes for frontend
- Tipar `target_by_channel` para soportar `Record<string, number>` y serializar a JSON.
- Mostrar mensajes de `summary_message` y `alerts[].message` como fuente principal de copy operativo.
- No asumir presencia de todos los campos; todos son opcionales.
