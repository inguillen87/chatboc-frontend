# Módulo de Analítica y CRM

Este módulo agrega endpoints backend (`/analytics`) y un panel frontend para dashboards de municipios, PyMEs y operaciones. El objetivo es ofrecer métricas listas para visualizar, mapas interactivos con filtros cruzados y tablas exportables.

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

## Backend

- Endpoints bajo `/analytics` (solo GET) con respuesta cacheada.
- Datos semilla generados en memoria (`analytics/dataGenerator.js`) con multitenancy y métricas derivadas.
- Agregados: percentiles SLA, eficiencia (primer contacto, re-aperturas), calidad (CSAT/NPS), geo heatmap, cohortes PyME, métricas WhatsApp.
- RBAC básico vía rol (`admin`, `operador`, `visor`) con sanitización para roles de lectura.
- Observabilidad: contador de requests, hits de cache y endpoint interno `/analytics/internal/health`.

### Extender o adaptar

1. **Fuentes de datos**: reemplazar el generador en `analytics/dataGenerator.js` por consultas SQL reales (manteniendo las estructuras de salida).
2. **Nuevos KPIs**: agregar funciones en `analytics/store.js` y exponerlas mediante un endpoint en `analytics/router.js` (respetar cache + filtros).
3. **Jobs nocturnos**: `generateDataset` simula pre-cómputos; reemplazar por jobs reales y cargar resultados en memoria o caché distribuido.
4. **RBAC / multitenancy**: ajustar `analytics/rbac.js` para leer datos reales de sesión/JWT.

## Frontend

- Nueva ruta `/analytics` que renderiza `AnalyticsPage` con tres pestañas.
- `AnalyticsFiltersContext` centraliza filtros y sincroniza con query params.
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

## Pruebas

`tests/analyticsModule.test.cjs` verifica cálculos clave (SLA, heatmap, operaciones, PyME). Ejecutar `npm test` para validar.

## Feature flag

El módulo se activa si `ANALYTICS_ENABLED` no es `false`. Ajustar TTL de cache vía `ANALYTICS_CACHE_TTL_MS`.
