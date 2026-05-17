# Frontend to Backend - Backoffice UX Reorganization

Fecha: 2026-05-16

## Objetivo

Convertir `/perfil` en un panel de control administrativo claro para municipios, empresas, colegios y otros rubros. El usuario no tecnico debe entender:

- que paso,
- que tiene que resolver,
- donde estan personas/accesos,
- donde estan encuestas/votaciones,
- que diferencia hay entre estadisticas y analitica avanzada,
- como exportar o pedir resumen IA.

## Decisiones de UX aplicadas en frontend

- `/perfil` ahora abre con un centro de control, no solo con configuracion.
- Se exponen accesos principales: operacion, reportes, encuestas, personas, mapas y analitica IA.
- `Estadisticas` queda como tablero operativo simple.
- `Analitica IA` queda como capa avanzada: segmentos, resumen ejecutivo, mapas y exportaciones.
- El diccionario de KPIs en Analytics queda plegado para no ocupar el primer foco visual.

## Requerimientos backend para completar bien

### 1. Contrato de navegacion del backoffice

Endpoint recomendado:

`GET /api/app/backoffice/navigation?tenant_slug=<slug>`

Debe devolver modulos disponibles por tenant/rol:

```json
{
  "contract_version": "backoffice.navigation.v1",
  "tenant_slug": "junin-1",
  "role": "admin",
  "modules": [
    {
      "id": "operations",
      "label": "Operar reclamos",
      "description": "Reclamos, estados, ubicaciones y seguimiento diario.",
      "route": "/perfil?tab=tickets",
      "enabled": true,
      "priority": 1
    },
    {
      "id": "reports",
      "label": "Reportes claros",
      "description": "Resumen operativo, mapas de calor y prioridades.",
      "route": "/perfil?tab=estadisticas",
      "enabled": true,
      "priority": 2
    },
    {
      "id": "surveys",
      "label": "Encuestas y sondeos",
      "description": "Participacion, votaciones, comentarios y resultados en vivo.",
      "route": "/admin/encuestas",
      "enabled": true,
      "priority": 3
    }
  ],
  "request_id": "req_..."
}
```

Frontend no debe hardcodear modulos finales cuando exista este contrato.

### 2. Contrato de resumen administrativo

Endpoint recomendado:

`GET /api/app/backoffice/summary?tenant_slug=<slug>&window=7d`

Debe devolver una lectura humana:

```json
{
  "contract_version": "backoffice.summary.v1",
  "title": "Resumen de los ultimos 7 dias",
  "cards": [
    { "id": "pending_cases", "label": "Pendientes", "value": 18, "tone": "warning" },
    { "id": "resolved_cases", "label": "Resueltos", "value": 42, "tone": "success" }
  ],
  "priorities": [
    {
      "id": "zone_oeste",
      "label": "Zona Oeste requiere atencion",
      "description": "Subieron reclamos de luminarias.",
      "action": { "label": "Ver mapa", "route": "/perfil?tab=estadisticas" }
    }
  ],
  "ai_summary_available": true,
  "request_id": "req_..."
}
```

### 3. Unificar Estadisticas vs Analytics

Backend debe publicar definicion y permisos:

```json
{
  "analytics_modes": {
    "statistics": {
      "label": "Estadisticas",
      "description": "Tablero operativo simple para administracion diaria.",
      "enabled": true
    },
    "advanced_analytics": {
      "label": "Analitica IA",
      "description": "Investigacion, segmentos, resumen ejecutivo y exportaciones.",
      "enabled": true
    }
  }
}
```

Regla: si un tenant no tiene analitica avanzada, frontend debe ocultar la opcion, no mostrar botones rotos.

### 4. Encuestas como pilar principal

Backend debe publicar el estado de encuestas/votaciones/sondeos:

```json
{
  "surveys_overview": {
    "active_surveys": 2,
    "live_votes": 128,
    "comments_pending_review": 7,
    "heatmap_available": true,
    "route": "/admin/encuestas"
  }
}
```

### 5. Mapas de calor entendibles

Para mapas, cada endpoint debe entregar:

- `headline`: lectura humana.
- `legend`: leyenda simple.
- `empty_state`: texto cuando no hay datos.
- `recommended_action`: accion sugerida.
- `geo_layers`: contrato MapLibre ya existente.

Frontend renderiza capas y accion. No inventa interpretaciones sociologicas si backend no las publica.

### 6. Exportaciones e investigacion avanzada

Backend debe mantener:

- PDF ejecutivo,
- CSV/XLSX,
- resumen IA,
- trazabilidad `request_id`,
- filtros aplicados en el payload exportado.

Los PDF deben incluir:

- resumen ejecutivo,
- filtros usados,
- principales hallazgos,
- mapas/capas si existen,
- notas de muestra insuficiente o privacidad cuando aplique.

## QA esperado

- Persona administrativa entiende en menos de 10 segundos donde operar.
- Usuarios, empleados y encuestas aparecen como accesos principales, no escondidos.
- Estadisticas y Analitica IA tienen proposito separado.
- Un municipio, una pyme y un colegio ven modulos adecuados a su rubro.
- No aparecen mapas, encuestas o exportaciones si backend no los habilita.
