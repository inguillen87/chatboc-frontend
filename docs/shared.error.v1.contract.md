# Contract · `shared.error.v1`

## Error envelope
Todos los endpoints deben respetar el siguiente envelope cuando hay error controlado:

```json
{
  "error": {
    "code": 400,
    "message": "detalle"
  }
}
```

## Campos
- `error.code` (`number`): status lógico/HTTP asociado.
- `error.message` (`string`): mensaje legible para operador/usuario.

## Recomendación frontend
- Parsear de forma defensiva (`error` puede no existir en errores no controlados).
- Priorizar `error.message` para UX controlada.
- Registrar telemetría `api_error` con `code`, `screen_name`, `tenant_id`, `channel`.
