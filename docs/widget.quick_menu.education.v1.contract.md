# Contract — `widget.quick_menu.education.v1`

## Contexto
Cuando el tenant pertenece al rubro educación (colegio/escuela), el backend puede priorizar quick menu educativo en bootstrap/widget-config.

## Shape sugerido

```json
{
  "contract_version": "widget.quick_menu.education.v1",
  "quick_menu": [
    { "id": "asistencia", "label": "Asistencia", "intent": "education.attendance" },
    { "id": "comunicados", "label": "Comunicados", "intent": "education.announcements" },
    { "id": "agenda", "label": "Agenda", "intent": "education.schedule" },
    { "id": "tramites", "label": "Trámites", "intent": "education.procedures" }
  ]
}
```

## Reglas de FE
- Si `contract_version` no coincide, degradar a menú genérico.
- No hardcodear textos por institución: respetar `label` provisto por backend.
- Loggear telemetry de fallback cuando contrato sea inválido/incompleto.

