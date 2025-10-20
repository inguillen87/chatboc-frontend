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

- **Entidad (tenant)**: selector de `tenant_id` (demo: `muni-centro`, `muni-sur`, `pyme-tienda`).
- **Rango de fechas**: selector con presets 7/30 días.
- **Canal, categoría, estado, agente, zona**: multiselección con búsqueda.
- **Selección en mapa**: arrastre para definir bounding box y filtrar todos los widgets.
- **Compartir vista**: copia la URL con filtros vigentes.

Los filtros se mantienen vía query params para soportar “Compartir vista”. Se usa cache HTTP de 10 min por combinación de filtros.

## Backend incluido en este repo

El repositorio ahora incorpora un microservicio Node bajo `server/app.cjs` que expone los endpoints `/analytics/*` consumidos por el frontend. No requiere dependencias externas (solo módulos built-in) y genera un dataset sintético de ~6.000 tickets, pedidos y encuestas por los tres tenants demo (`muni-centro`, `muni-sur`, `pyme-tienda`).

### Cómo levantarlo en desarrollo

```bash
npm run build   # opcional, solo si necesitás empaquetar el frontend
node server/app.cjs
```

Por defecto escucha en `http://localhost:4000`. Ajustá `VITE_BACKEND_URL` (por ejemplo `http://localhost:4000`) para que el frontend enrute las peticiones a este backend. El servidor soporta CORS básico (`GET` + `OPTIONS`).

### Seguridad y contexto

- Valida roles (`admin` > `operador` > `visor`) antes de resolver cada endpoint.
- Verifica que `tenant_id` pertenezca a la lista permitida (`X-Analytics-Tenant-Ids` / `X-Tenant-Ids`), salvo usuarios `admin`.
- Cachea cada combinación de filtros 10 minutos en memoria.
- Registra tiempos de respuesta y errores en consola (`[analytics] Request/Error`).

### Dataset y jobs simulados

- Tickets generados con severidad, canal, categoría, adjuntos, SLA y flags de automatización/reapertura.
- Pedidos PyME con items, totales, zonas, clientes y plantillas WhatsApp asociadas.
- Encuestas CSAT/NPS vinculadas a tickets y pedidos.
- Métricas derivadas para cohortes, geo heatmap, hotspots y detección de “problemas crónicos”.

Podés regenerar el dataset borrando `server/analytics/data/seed.json` o llamando a `refreshDataset()` (exportado en `server/analytics`).

## Endpoints disponibles

El frontend consulta estos endpoints (solo `GET`). Todos reciben `tenant_id`, `from`, `to` y filtros opcionales (`canal`, `categoria`, `estado`, `agente`, `zona`, `etiquetas`, `bbox`, `context`, `search`). Las respuestas incluyen únicamente datos agregados o anonimizados.

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

### Recomendaciones si migrás a un backend productivo

1. **Cache**: mantené TTL 5-15 minutos por combinación de filtros. Se puede reemplazar el cache in-memory por Redis/KeyDB.
2. **Multitenancy y seguridad**: replicar la validación de tenant basada en el token de sesión y tu sistema RBAC. Este módulo asume cabeceras `X-Analytics-Role` y `X-Analytics-Tenant-Ids`.
3. **Pre-cómputos**: migrá los agregados (SLA percentiles, cohortes, geo) a jobs nocturnos/materialized views para datasets reales.
4. **Geo**: `heatmap` debe enviar puntos `{ lat, lng, weight }` y, cuando esté disponible, metadatos asociados (`ticket`, `categoria`, `barrio`, `distrito`, `estado`, `severidad`, `tipo_ticket`, `last_ticket_at`). El frontend agrupa automáticamente por proximidad (MapLibre/Google) y usa esos campos para calcular breakdowns y popups enriquecidos. `points` devuelve una muestra anonimizada (máx. 250 puntos).

### Payload geo recomendado

- `lat`, `lng`: coordenadas en grados decimales (obligatorio).
- `weight`: intensidad del punto (tickets, respuestas, pedidos, etc.). Si no viene, se asume `1`.
- `ticket`/`id`: identificador para vincular popups con `/chat/:id`.
- `categoria`, `barrio`, `distrito`, `estado`, `tipo_ticket`, `severidad`: strings libres que la UI usa para rankings y leyendas.
- `last_ticket_at`: ISO8601 del evento más reciente en esa ubicación (para ordenar recencia).
- `sampleTickets`: lista opcional de IDs relacionados si ya agregaste en backend.

Con esa información, el frontend genera heatmaps densos, agrupa por barrio y arma tooltips con conteos, promedios, categorías principales y enlaces directos.
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

### Recursos complementarios

- [Integraciones BI y stacks sugeridos](../bi-no-code-integrations.md): resumen de herramientas “no-code”, combinaciones de backend/frontend y buenas prácticas de privacidad y accesibilidad para gobiernos.

## Feature flag

El frontend chequea `window.CHATBOC_CONFIG.analytics`. Si `enabled === false`, esconder la ruta en el enrutador o evitar montar la página. También se puede forzar el tenant o la vista inicial con `defaultTenantId` y `defaultContext`.
