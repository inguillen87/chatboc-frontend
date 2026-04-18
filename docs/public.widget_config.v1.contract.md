# Contract — `public.widget_config.v1`

## Endpoint
- `GET /api/public/widget-config` (o endpoint público equivalente de bootstrap widget)

## Respuesta esperada (shape mínimo)

```json
{
  "contract_version": "public.widget_config.v1",
  "tenant": { "slug": "mi-tenant", "tipo": "municipio" },
  "widget": {},
  "builder_config": {},
  "quick_menu": [],
  "suppress_global_widget": false,
  "integration_preview": false
}
```

## Reglas FE
- Validar `contract_version`.
- Si contrato inválido/incompleto, degradar a config default segura.
- Cuando quick menu educativo exista, priorizar labels/intents provistos por backend.

