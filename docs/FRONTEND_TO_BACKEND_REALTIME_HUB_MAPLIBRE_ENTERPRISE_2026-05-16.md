# Frontend to Backend - Realtime Hub, MapLibre y Segmentacion Enterprise

Fecha: 2026-05-16

## Objetivo

El frontend ya puede renderizar Realtime Hub y mapas MapLibre desde contratos backend. Para completar la experiencia enterprise sin datos inventados, backend debe publicar contratos consistentes para analytics realtime, heatmaps generales y analytics de encuestas/votaciones.

## Regla principal

Frontend no inventa segmentos, categorias, puntos geograficos, colores, recomendaciones ni textos operativos. Si backend no publica el dato, frontend muestra estado vacio o lo oculta.

## 1. Realtime Hub

Endpoint:

```txt
GET /admin/analytics/realtime-hub?tenant_id=<id>&scope=<municipio|pyme>&window_minutes=30
```

Respuesta requerida:

```json
{
  "contract_version": "analytics.realtime_hub.v1",
  "request_id": "req_...",
  "totals": {
    "events": 120,
    "survey_responses": 34,
    "survey_comments": 18,
    "live_chat_comments": 22
  },
  "top_channels": [{ "channel": "voice", "count": 41 }],
  "top_events": [{ "event": "crear_reclamo", "count": 12 }],
  "sentiment": { "positive": 20, "neutral": 80, "negative": 20 },
  "comments": [
    {
      "channel": "voice",
      "text": "Comentario real del ciudadano o cliente",
      "created_at": "2026-05-16T12:00:00Z",
      "sentiment": "neutral"
    }
  ],
  "recommendations": ["Accion ejecutiva basada en datos reales"],
  "hotspots": [{ "label": "Centro", "count": 18 }],
  "geo_points": [
    { "lat": -34.6, "lng": -58.38, "count": 8, "channel": "voice" }
  ],
  "geo_layers": {
    "provider": "maplibre",
    "engine": "maplibre-gl-js",
    "contract_version": "2026.04-maplibre-v1",
    "style_url": "https://demotiles.maplibre.org/style.json",
    "source": { "type": "FeatureCollection", "features": [] },
    "source_options": { "cluster": true, "clusterMaxZoom": 14, "clusterRadius": 45 },
    "layers": {
      "heatmap": { "id": "events-heat", "type": "heatmap", "source": "events" },
      "clusters": { "id": "events-clusters", "type": "circle", "source": "events" },
      "points": { "id": "events-points", "type": "circle", "source": "events" }
    },
    "interactions": { "hover": true, "time_slider": { "enabled": true, "field": "ts" } },
    "telemetry": {
      "event_endpoint": "/api/analytics/event",
      "events": ["map_loaded", "layer_toggle", "time_slider_changed", "cluster_click"]
    },
    "categories": [
      {
        "categoria": "seguridad",
        "color": "#EF4444",
        "event_count": 12,
        "total_weight": 46,
        "intensity": 1.0,
        "points": [{ "lat": -34.6, "lng": -58.38, "weight": 8 }]
      }
    ],
    "legend": { "mode": "category_weight", "min_weight": 0, "max_weight": 46 }
  },
  "segments": {
    "categoria": [{ "label": "seguridad", "count": 12 }],
    "rango_edad": [{ "label": "25-34", "count": 5 }],
    "sexo": [{ "label": "f", "count": 7 }],
    "barrio": [{ "label": "Centro", "count": 9 }],
    "distrito": [{ "label": "Norte", "count": 4 }],
    "canal": [{ "label": "voice", "count": 41 }]
  },
  "segments_filters_applied": {
    "categoria": "seguridad",
    "canal": "voice"
  },
  "ui": {
    "labels": {
      "tabs_realtime_hub": "Realtime Hub",
      "sections_map": "Mapa en tiempo real",
      "sections_segments": "Segmentos",
      "empty": "Sin datos para este periodo",
      "empty_map": "Sin puntos geograficos publicados",
      "applied_filters": "Filtros aplicados"
    }
  }
}
```

## 2. Heatmap general analytics

Endpoint:

```txt
GET /admin/analytics/heatmap
```

Debe mantener:

- `points[]` para compatibilidad legacy.
- `geo_layers` como contrato principal MapLibre.
- `segments` con `categoria`, `rango_edad`, `sexo`, `barrio`, `distrito`, `canal`.
- `segments_filters_applied` como eco de filtros aplicados.

Filtros que backend debe aceptar:

- `categoria` o `categorias`
- `sexo` o `genero`
- `rango_edad`
- `barrio`
- `distrito`
- `canal`
- `geo_limit`
- `bbox=minLng,minLat,maxLng,maxLat`

## 3. Encuestas, votaciones y sondeos

Endpoints:

```txt
GET /admin/encuestas/{encuesta_id}/analytics/dashboard
GET /admin/encuestas/{encuesta_id}/analytics/heatmap
GET /admin/encuestas/{encuesta_id}/analytics/export.pdf
```

Para heatmap, backend debe publicar:

```json
{
  "points": [],
  "cells": [],
  "metadata": {
    "category_layers": {
      "provider": "maplibre",
      "engine": "maplibre-gl-js",
      "style_url": "https://demotiles.maplibre.org/style.json",
      "source": { "type": "FeatureCollection", "features": [] },
      "source_options": { "cluster": true, "clusterMaxZoom": 14, "clusterRadius": 45 },
      "layers": {
        "heatmap": { "id": "encuestas-heat", "type": "heatmap", "source": "encuestas" },
        "clusters": { "id": "encuestas-clusters", "type": "circle", "source": "encuestas" },
        "points": { "id": "encuestas-points", "type": "circle", "source": "encuestas" }
      },
      "interactions": { "hover": true, "time_slider": { "enabled": true, "field": "ts" } },
      "telemetry": {
        "event_endpoint": "/api/analytics/event",
        "events": ["map_loaded", "layer_toggle", "time_slider_changed", "cluster_click"]
      },
      "categories": [
        {
          "categoria": "seguridad",
          "color": "#EF4444",
          "event_count": 120,
          "total_weight": 350,
          "intensity": 1.0,
          "points": [{ "lat": -34.6, "lng": -58.38, "weight": 8 }]
        }
      ],
      "legend": { "mode": "category_weight", "min_weight": 0, "max_weight": 350 }
    }
  }
}
```

Para dashboard, backend debe publicar sin hardcode frontend:

- `sections.mapas.heatmap.points`
- `sections.mapas.heatmap.cells`
- `sections.mapas.heatmap.hotspots`
- `sections.mapas.heatmap.category_layers`
- `sections.estadisticas.resumen`
- `sections.estadisticas.categorias`
- `sections.estadisticas.demografia.genero`
- `sections.estadisticas.demografia.rango_etario`
- `sections.ia.headline`
- `sections.ia.insights[]`

## 4. Telemetria esperada

Si `geo_layers.telemetry.event_endpoint` existe, frontend emite:

- `map_loaded`
- `layer_toggle`
- `time_slider_changed`
- `cluster_click`

Backend debe responder JSON estable, incluso si descarta el evento:

```json
{
  "ok": true,
  "request_id": "req_..."
}
```

## 5. QA compartida

1. `/analytics` abre tab `Realtime Hub`.
2. `Realtime Hub` muestra cards, comentarios, sentimiento y recomendaciones desde backend.
3. Si `geo_layers.source.features.length > 0`, renderiza MapLibre aunque `geo_points` venga vacio.
4. Si `geo_points` existe y `geo_layers` no, renderiza mapa fallback con esos puntos.
5. Los segmentos `categoria`, `rango_edad`, `sexo`, `barrio`, `distrito`, `canal` aparecen solo si backend los manda.
6. Encuestas renderiza `metadata.category_layers` y respeta colores por categoria.
7. No se inventan colores, categorias, puntos, recomendaciones ni labels cuando backend no los publica.
8. Export PDF de encuestas devuelve archivo valido y JSON de error con `request_id` si falla.
