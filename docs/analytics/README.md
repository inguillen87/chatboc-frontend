# Módulo de Analítica y CRM (frontend)

El panel de analítica vive en el frontend y consume un backend externo bajo `/analytics`. Este documento resume los datos que espera recibir, cómo se organizan las vistas y qué consideraciones debe tener el equipo de backend para integrarse.

## KPIs y vistas principales

### Dashboard Municipio
- **KPIs**: tickets totales, abiertos, backlog, % automatización.
- **SLA**: percentiles P50/P90/P95 para Time To Acknowledge y Time To Resolution.
- **Series**: tickets diarios apilados por categoría.
- **Breakdowns**: categorías, canales y estados.
- **Mapa**: calor y puntos con selección de área que filtra el resto de widgets.
- **Calidad**: CSAT/NPS por tipo y agente.

### Dashboard PyME
- **KPIs**: pedidos, ticket medio, conversión, recurrencia 30 días.
- **Series**: pedidos diarios e ingresos.
- **Breakdowns**: categorías, canales, estados de pedido.
- **Mapa**: calor de pedidos y puntos.
- **Tablas**: top productos, plantillas WhatsApp (envíos, respuestas, CTR), cohortes de compra.

### Dashboard Operaciones
- **KPIs**: abiertos, violaciones de SLA, automatizados, volumen total.
- **Serie**: tickets diarios.
- **Aging**: distribución por buckets (0-4h, 4-24h, etc.).
- **Mapa**: incidencias activas.
- **Tabla**: carga de agentes con abiertos, tiempo medio y satisfacción estimada.

## Filtros globales

- **Entidad (tenant)**: selector de `tenant_id` (demo: `tenant-municipio-1`, `tenant-municipio-2`, `tenant-pyme-1`, `tenant-pyme-2`).
- **Rango de fechas**: selector con presets 7/30 días.
- **Canal, categoría, estado, agente, zona**: multiselección con búsqueda.
- **Selección en mapa**: arrastre para definir bounding box y filtrar todos los widgets.
- **Compartir vista**: copia la URL con filtros vigentes.

Los filtros se mantienen vía query params para soportar “Compartir vista”. Se usa cache HTTP de 10 min por combinación de filtros.

## Backend esperado

El frontend consulta estos endpoints (solo `GET`). Todos reciben `tenant_id`, `from`, `to` y filtros opcionales (`canal`, `categoria`, `estado`, `agente`, `zona`, `etiquetas`, `bbox`, `context`, `search`). Las respuestas deben incluir únicamente datos agregados o anonimizados.

- `GET /analytics/summary`
- `GET /analytics/timeseries`
- `GET /analytics/breakdown`
- `GET /analytics/geo/heatmap`
- `GET /analytics/geo/points`
- `GET /analytics/top`
- `GET /analytics/operations`
- `GET /analytics/cohorts`
- `GET /analytics/whatsapp/templates`
- `GET /analytics/filters` → catálogo para llenar selects (canales, categorías, estados, agentes, zonas, etiquetas, tenants, contextos disponibles).

### Recomendaciones para backend

1. **Cache**: TTL sugerido 5-15 minutos por combinación de filtros. El frontend envía cabeceras estándar; pueden aprovechar ETag/Last-Modified.
2. **Multitenancy y seguridad**: resolver `tenant_id` a partir del token y validar que el usuario tenga permisos (admin, operador, visor). No devolver datos sensibles.
3. **Pre-cómputos**: materiales diarios/semanales para percentiles SLA, cohortes PyME y agregados geo. El frontend asume que los endpoints responden en <3 s (1.5 s si cacheado).
4. **Geo**: `heatmap` espera celdas `{ cellId, count, centroid_lat, centroid_lon, breakdown }`. `points` puede devolver una muestra anonimizada para zoom alto.
5. **Filtros globales**: `GET /analytics/filters` debe devolver listas de valores válidos y opcionalmente la lista de `tenants` disponibles para el usuario.

## Frontend

- Ruta `/analytics` que renderiza `AnalyticsPage` con tres pestañas.
- `AnalyticsFiltersContext` centraliza filtros, sincroniza query params y espera recibir opciones desde `/analytics/filters`.
- Componentes reutilizables (`WidgetFrame`, `MapWidget`, `KpiTile`, gráficos con `recharts`).
- Exportaciones por widget a CSV/PNG (`utils/exportUtils.ts`).
- Mapas usan `MapLibreMap` con soporte para selección de bounding box.

### Añadir widgets
1. Crear componente (ej. `WidgetFrame`) y consumir servicio desde `useAnalyticsDashboard` o un hook propio.
2. Exponer datos desde backend si aún no existen (endpoint o campo nuevo).
3. Agregar el widget a la pestaña correspondiente dentro del layout responsivo (`grid gap-4`).

### Performance
- Tablas con máximo 20 filas (top-N) y scroll.
- Mapas y gráficas se actualizan al cambiar filtros con memoización básica.
- Para datasets grandes se recomienda sustituir el store in-memory por API paginada + React Query.

## Feature flag

El frontend chequea `window.CHATBOC_CONFIG.analytics`. Si `enabled === false`, esconder la ruta en el enrutador o evitar montar la página. También se puede forzar el tenant o la vista inicial con `defaultTenantId` y `defaultContext`.
