export interface BiPlatform {
  id: string;
  name: string;
  focus: string;
  highlights: string[];
  integrationNotes: string;
  connectors?: string[];
  embedding?: {
    supportsEmbedding: boolean;
    notes?: string;
  };
}

export interface StackComponent {
  label: string;
  description?: string;
}

export interface StackOption {
  id: string;
  title: string;
  scenario: string;
  summary: string;
  backend: StackComponent[];
  dataLayer?: StackComponent[];
  frontend: StackComponent[];
  analytics: StackComponent[];
  observability?: StackComponent[];
  mlops?: StackComponent[];
  notes?: string[];
}

export interface ReusableModule {
  id: string;
  name: string;
  description: string;
  outcomes: string[];
  tags: string[];
}

export interface GovernanceChecklist {
  id: string;
  title: string;
  category: 'privacy' | 'accessibility' | 'data';
  items: string[];
}

export interface MunicipalPlaybookContent {
  updatedAt: string;
  intro: string;
  callToAction: string;
  platforms: BiPlatform[];
  stacks: StackOption[];
  reusableModules: ReusableModule[];
  governance: GovernanceChecklist[];
}

const component = (label: string, description?: string): StackComponent => ({
  label,
  description,
});

export const municipalPlaybookFallback: MunicipalPlaybookContent = {
  updatedAt: '2025-01-15',
  intro:
    'Esta guía organiza las piezas tecnológicas sugeridas para desplegar analítica municipal: desde tableros rápidos hasta operaciones con IA y NLP.',
  callToAction:
    'Seleccioná el stack que mejor se adapte a tu madurez digital y combiná los módulos reutilizables para entregar valor ciudadano en semanas.',
  platforms: [
    {
      id: 'superset',
      name: 'Apache Superset',
      focus: 'Exploración ad-hoc y tableros interactivos',
      highlights: [
        'Permite construir dashboards sin escribir código',
        'Soporta permisos granulares por rol',
        'Ideal para equipos de datos municipales con SQL',
      ],
      integrationNotes:
        'Se conecta a PostgreSQL/PostGIS, motores OLAP y data warehouses; ofrece SDK para incrustar dashboards en portales ciudadanos.',
      connectors: ['PostgreSQL', 'PostGIS', 'BigQuery', 'Trino', 'CSV/Excel'],
      embedding: {
        supportsEmbedding: true,
        notes: 'Utilizar JWT y controles de row-level security para limitar el acceso a cada dependencia.',
      },
    },
    {
      id: 'metabase',
      name: 'Metabase',
      focus: 'KPIs operativos y tableros ejecutivos',
      highlights: [
        'Curva de aprendizaje baja para equipos no técnicos',
        'Filtros dinámicos, dashboards embebibles y alertas programadas',
        'Consultas rápidas sobre bases relacionales o datasets sin modelado complejo',
      ],
      integrationNotes:
        'Ideal para exponer KPIs básicos dentro del portal interno. Configurar permisos por grupo y parámetros para aislar municipios.',
      connectors: ['PostgreSQL', 'MySQL', 'Google Sheets', 'BigQuery'],
      embedding: {
        supportsEmbedding: true,
        notes: 'Generar claves firmadas para cada sesión y aplicar timeouts cortos.',
      },
    },
    {
      id: 'grafana',
      name: 'Grafana',
      focus: 'Monitoreo en tiempo real e infraestructura',
      highlights: [
        'Dashboards en vivo sobre Prometheus, InfluxDB y ElasticSearch',
        'Alertas configurables por canal (correo, Slack, webhook)',
        'Plugins para visualizar sensores IoT y tableros de seguridad urbana',
      ],
      integrationNotes:
        'Usar para telemetría de servicios críticos y visualizar capas en tiempo real (ej. tránsito, luminarias). Integrar con Prometheus o Loki.',
      connectors: ['Prometheus', 'InfluxDB', 'ElasticSearch', 'Loki', 'PostgreSQL'],
      embedding: {
        supportsEmbedding: true,
        notes: 'Para portales públicos, emplear proxies autenticados y dashboards dedicados de solo lectura.',
      },
    },
  ],
  stacks: [
    {
      id: 'rapid-prototype',
      title: 'Prototipo rápido',
      scenario: 'Ideal para validar una iniciativa municipal en semanas.',
      summary:
        'Entrega tableros iniciales de KPIs y mapas ligeros con datasets existentes o planillas heredadas.',
      backend: [
        component('FastAPI'),
        component('pandas / geopandas', 'Limpieza y unión de capas geográficas simples'),
        component('scikit-learn', 'Modelos base para segmentaciones o regresiones ligeras'),
        component('folium', 'Exportar capas GeoJSON para el frontend'),
      ],
      frontend: [
        component('React'),
        component('react-leaflet', 'Mapa ligero con capas de calor'),
        component('recharts', 'Visualizaciones de barras y tortas'),
        component('@tanstack/react-query', 'Cacheo y sincronización de datos'),
      ],
      analytics: [
        component('Metabase embebido', 'Tableros de KPIs sin depender de desarrolladores'),
      ],
      notes: [
        'Priorizar datasets abiertos o planillas internas ya disponibles.',
        'Configurar pipelines manuales o cron jobs simples para refrescar datos.',
      ],
    },
    {
      id: 'operational-maps',
      title: 'Operativo con mapas de alto rendimiento',
      scenario: 'Para áreas que gestionan reclamos diarios y requieren seguimiento de SLA.',
      summary:
        'Integra consultas espaciales optimizadas y tableros temáticos para gestionar miles de tickets.',
      backend: [
        component('FastAPI'),
        component('geopandas / shapely', 'Procesamiento espacial avanzado'),
        component('pydeck', 'Previews 3D y densidad por hexágonos'),
      ],
      dataLayer: [
        component('PostgreSQL + PostGIS', 'Consultas espaciales y materialización de vistas operativas'),
      ],
      frontend: [
        component('react-map-gl', 'Renderiza mapas vectoriales y tiles vectoriales'),
        component('deck.gl', 'Capas HexagonLayer / HeatmapLayer para densidad'),
        component('echarts-for-react', 'Analítica avanzada y comparativas'),
      ],
      analytics: [
        component('Superset', 'Dashboards operativos con filtros jerárquicos'),
        component('Metabase', 'KPIs ejecutivos reutilizables'),
      ],
      observability: [
        component('Prometheus + Grafana', 'Monitoreo de pipelines y SLAs'),
      ],
      mlops: [
        component('MLflow', 'Versionado de modelos predictivos'),
        component('Evidently', 'Monitoreo de deriva de datos y modelos'),
      ],
      notes: [
        'Organizar el catálogo de fuentes y políticas de refresco en un data dictionary.',
        'Definir niveles de servicio (SLA) por categoría y alertas en Grafana.',
      ],
    },
    {
      id: 'ai-nlp',
      title: 'IA / NLP para tickets y participación',
      scenario: 'Pensado para gestionar volúmenes altos de textos, reclamos y participación digital.',
      summary:
        'Aprovecha embeddings y workflows orquestados para priorizar reclamos y abrir canales ciudadanos.',
      backend: [
        component('FastAPI'),
        component('spaCy', 'Procesamiento de entidades y clasificación base'),
        component('transformers / sentence-transformers', 'Embeddings y modelos BERT/LLM ligeros'),
      ],
      dataLayer: [
        component('Feature store (Feast)', 'Orquestar features reutilizables si el volumen crece'),
      ],
      frontend: [
        component('React + deck.gl', 'Explorar clusters, rutas y mapas temáticos'),
        component('ECharts', 'Comparativas de sentimientos y top temas'),
      ],
      analytics: [
        component('Superset o Metabase', 'Dashboards de participación ciudadana y sentimiento'),
      ],
      observability: [
        component('Prometheus + Grafana', 'Seguimiento de pipelines NLP y colas de procesamiento'),
      ],
      mlops: [
        component('Airflow / Dagster', 'Orquestación de ETL y tareas de NLP'),
        component('Great Expectations', 'Validación de datasets y anotaciones'),
        component('MLflow + Evidently', 'Versionado y monitoreo de modelos NLP'),
      ],
      notes: [
        'Planificar ciclos de re-entrenamiento y etiquetado colaborativo.',
        'Incluir pruebas de sesgo y explicabilidad en modelos de participación.',
      ],
    },
  ],
  reusableModules: [
    {
      id: 'scorecards',
      name: 'Scorecards ejecutivos',
      description:
        'Paneles con KPIs clave: incidentes por barrio, SLA de reclamos, tiempos promedio de resolución y backlog.',
      outcomes: [
        'Visibilidad diaria del cumplimiento de objetivos',
        'Priorización de cuadrillas y equipos territoriales',
      ],
      tags: ['KPIs', 'Gestión operativa'],
    },
    {
      id: 'heatmaps',
      name: 'Heatmaps multicapas',
      description:
        'Capas de calor para basura, iluminación, seguridad y mantenimiento; soportan densidad y hexágonos H3.',
      outcomes: [
        'Detección rápida de hotspots territoriales',
        'Planificación de operativos en territorio',
      ],
      tags: ['Mapas', 'Territorio'],
    },
    {
      id: 'demand-forecast',
      name: 'Predicción de demanda',
      description:
        'Modelos de series de tiempo para anticipar picos de reclamos o servicios.',
      outcomes: [
        'Asignación proactiva de recursos',
        'Alertas de saturación temprana',
      ],
      tags: ['IA', 'Series de tiempo'],
    },
    {
      id: 'ticket-clusters',
      name: 'Clustering de reclamos',
      description:
        'Agrupa tickets similares para acelerar respuestas y detectar problemas repetitivos.',
      outcomes: [
        'Automatiza plantillas de respuesta',
        'Reduce tiempos de clasificación manual',
      ],
      tags: ['IA', 'Automatización'],
    },
    {
      id: 'optimal-routes',
      name: 'Rutas óptimas para cuadrillas',
      description:
        'Optimización CVRP con OR-Tools o networkx + osmnx para recorridos eficientes.',
      outcomes: [
        'Menor costo operativo y tiempos de traslado',
        'Seguimiento en campo con rutas compartibles',
      ],
      tags: ['Logística', 'Operaciones'],
    },
    {
      id: 'participation-dashboard',
      name: 'Dashboard de participación ciudadana',
      description:
        'Analiza ideas, tickets y sugerencias por canal. Incluye sentimiento y participación por barrio.',
      outcomes: [
        'Mayor transparencia y comunicación',
        'Detección de temáticas emergentes',
      ],
      tags: ['Participación', 'Comunicación'],
    },
  ],
  governance: [
    {
      id: 'privacy',
      title: 'Checklist de privacidad y protección de datos',
      category: 'privacy',
      items: [
        'Pseudoanonimizar identificadores sensibles con hash + salt.',
        'Agregar agregación espacial (hexágonos H3) antes de publicar datasets abiertos.',
        'Definir políticas de retención y consentimiento según normativa local.',
        'Registrar accesos y auditorías en cada dashboard embebido.',
      ],
    },
    {
      id: 'accessibility',
      title: 'Checklist de accesibilidad (WCAG AA)',
      category: 'accessibility',
      items: [
        'Verificar contrastes y escalas de color compatibles con daltonismo.',
        'Agregar labels `aria-*` y soporte de teclado en tabs, filtros y mapas.',
        'Incluir descripciones alternativas para capas geográficas.',
        'Probar la navegación con lectores de pantalla en componentes críticos.',
      ],
    },
    {
      id: 'data-governance',
      title: 'Checklist de gobierno de datos',
      category: 'data',
      items: [
        'Mantener un inventario de datasets y responsables funcionales.',
        'Versionar pipelines ETL y documentar políticas de actualización.',
        'Definir métricas de calidad (completitud, frescura, consistencia) y alertas.',
        'Compartir manuales de uso y definiciones de KPIs con cada dependencia.',
      ],
    },
  ],
};

export default municipalPlaybookFallback;
