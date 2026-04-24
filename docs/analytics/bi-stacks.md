# Integraciones BI y stacks sugeridos

Este documento resume las herramientas de analítica "no-code" y las pilas tecnológicas recomendadas para desplegar dashboards municipales o ciudadanos.

## Plataformas BI compatibles

- **Apache Superset**: dashboards embebibles, control granular de permisos por rol y fuerte integración SQL.
- **Metabase**: se integra con la autenticación existente, permite tableros embebidos y maneja permisos basados en colecciones y roles.
- **Grafana**: ideal para métricas en tiempo real y monitoreo de infraestructura; consume nativamente Prometheus, InfluxDB y Elasticsearch.

## Stacks sugeridos según complejidad

### 1. Prototipo rápido y ligero

- **Backend**: FastAPI con `pandas`/`geopandas` para ETL ligero, `scikit-learn` para modelos básicos y `folium` para exportar GeoJSON.
- **Frontend**: React con `react-leaflet` (incluye heatmaps), `recharts` y `react-query` para cache de datos.
- **BI embebido**: Metabase para exponer KPIs directos dentro del portal.

### 2. Operativo con mapas de alto rendimiento

- **Backend**: FastAPI con `geopandas`/`shapely` para geocálculos y `pydeck` para previews 3D.
- **Base de datos**: PostgreSQL + PostGIS para consultas espaciales y materialización de vistas.
- **Frontend**: `react-map-gl` + `deck.gl` (capas `HeatmapLayer` y `HexagonLayer`) para visualizaciones geoespaciales.
- **Analítica**: `echarts-for-react` para dashboards ricos, Prometheus + Grafana para observabilidad.
- **MLOps**: MLflow y Evidently para seguimiento de modelos.

### 3. IA/NLP para tickets y participación ciudadana

- **NLP**: `spaCy`, `transformers` y `sentence-transformers` para clasificación, embeddings y análisis de texto.
- **Orquestación**: Airflow o Dagster acompañados de Great Expectations para validación de datos.
- **Feature store**: Feast cuando el volumen de features lo requiera.
- **Dashboard ciudadano**: React con `deck.gl` y `ECharts` para visualizaciones interactivas.

## Componentes clave para gobiernos

### Scorecards y KPIs

- Incidentes por barrio y categoría.
- SLA y tiempos de resolución de reclamos.
- Volumen de tickets abiertos vs. cerrados.

### Mapas y heatmaps

- Basura, iluminación y seguridad con capas de densidad y hexbin.
- Indicadores de participación ciudadana o reportes por zona.

### Modelos y analítica avanzada

- Predicción de demanda con series de tiempo.
- Clustering de reclamos para descubrir patrones.
- Rutas óptimas (CVRP) usando OR-Tools o `networkx` + `osmnx`.

### Privacidad y cumplimiento

- Pseudoanonimización con hash + salt.
- Agregación espacial con hexágonos H3 para proteger la ubicación exacta.
- Políticas claras de consentimiento y retención de datos.

### Accesibilidad

- Cumplimiento de WCAG AA (contraste, tamaño de fuente y navegación por teclado).
- Uso consistente de atributos `aria-*`.
- Descripciones alternativas para mapas y visualizaciones.
