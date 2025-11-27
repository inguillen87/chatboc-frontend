import type { AnalyticsContext } from '@/services/analyticsService';
import type { DashboardData } from '@/types/analyticsDashboard';

const baseCategories = ['Categoría A', 'Categoría B', 'Categoría C'];
const baseChannels = ['Web', 'Móvil', 'Presencial'];
const baseStates = ['Abierto', 'En proceso', 'Cerrado'];

function buildTimeseries(): DashboardData['timeseries'] {
  const today = new Date();
  const series = Array.from({ length: 14 }).map((_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - idx));
    const base = 10 + (idx % 5) * 3;
    return {
      date: date.toISOString().slice(0, 10),
      value: base,
      breakdown: baseCategories.reduce<Record<string, number>>((acc, label, categoryIdx) => {
        acc[label] = base - categoryIdx * 2;
        return acc;
      }, {}),
    };
  });

  return { metric: 'tickets_total', group: 'categoria', series };
}

function buildBreakdown(labels: string[]): DashboardData['breakdownCategoria'] {
  return {
    dimension: 'demo',
    items: labels.map((label, idx) => ({
      label,
      value: 25 - idx * 3,
    })),
  };
}

function buildHeatmap(): DashboardData['heatmap'] {
  const baseLat = -34.6;
  const baseLon = -58.4;
  const cells = Array.from({ length: 4 }).map((_, idx) => ({
    cellId: `demo-${idx}`,
    tenant_id: 'demo',
    count: 8 - idx,
    weight: 1 + idx * 0.2,
    centroid_lat: baseLat + idx * 0.02,
    centroid_lon: baseLon - idx * 0.02,
    breakdown: { [baseCategories[idx % baseCategories.length]]: 8 - idx },
  }));

  const hotspots = cells.map((cell) => ({
    cellId: cell.cellId,
    count: cell.count,
    weight: cell.weight,
    centroid: [cell.centroid_lat, cell.centroid_lon] as [number, number],
    breakdown: cell.breakdown,
  }));

  return { cells, hotspots, chronic: [] };
}

function buildPoints(): DashboardData['points'] {
  const baseLat = -34.61;
  const baseLon = -58.39;
  return {
    points: baseCategories.map((categoria, idx) => ({
      cellId: `demo-point-${idx}`,
      lat: baseLat + idx * 0.015,
      lon: baseLon - idx * 0.01,
      categoria,
      estado: baseStates[idx % baseStates.length],
    })),
  };
}

function buildTopZonas(): DashboardData['topZonas'] {
  return {
    subject: 'zonas',
    items: ['Zona Norte', 'Zona Centro', 'Zona Sur'].map((label, idx) => ({
      label,
      value: 18 - idx * 4,
    })),
  };
}

function buildSummary(): DashboardData['summary'] {
  return {
    generatedAt: new Date().toISOString(),
    tenantId: 'demo',
    totals: {
      tickets: 120,
      abiertos: 18,
      backlog: 6,
      adjuntos: 42,
    },
    sla: {
      ack: { p50: 2, p90: 4, p95: 6 },
      resolve: { p50: 12, p90: 24, p95: 36 },
    },
    efficiency: {
      firstContact: 87,
      reopenRate: 6,
      automationRate: 32,
    },
    volume: {
      perDay: [],
      byChannel: baseChannels.map((label, idx) => ({ label, value: 40 - idx * 10 })),
      byCategory: baseCategories.map((label, idx) => ({ label, value: 45 - idx * 8 })),
      byZone: ['Zona Norte', 'Zona Centro', 'Zona Sur'].map((label, idx) => ({ label, value: 38 - idx * 6 })),
    },
    quality: {
      byType: [
        { label: 'Satisfacción', average: 4.3, responses: 85 },
        { label: 'Resolución', average: 4.1, responses: 80 },
      ],
      byAgent: [
        { label: 'Equipo A', average: 4.5, responses: 50 },
        { label: 'Equipo B', average: 4.0, responses: 45 },
      ],
    },
    pyme: {
      totalOrders: 320,
      ticketMedio: 18000,
      ingresos: [],
      topProductos: [],
      conversion: 12,
      recurrencia: { d30: 32, d60: 18, d90: 12 },
      horasPico: [],
      canales: baseChannels.map((label, idx) => ({ label, value: 45 - idx * 8 })),
      modalidades: [
        { label: 'Compra', value: 210 },
        { label: 'Canje', value: 70 },
        { label: 'Donación', value: 40 },
      ],
      funnel: [
        { etapa: 'Visitas al catálogo', valor: 1200 },
        { etapa: 'Añadidos al carrito', valor: 480 },
        { etapa: 'Checkout iniciado', valor: 260 },
        { etapa: 'Pago confirmado', valor: 190 },
      ],
      plantillas: [],
    },
  };
}

function buildOperations(): DashboardData['operations'] {
  return {
    abiertos: 22,
    slaBreaches: 3,
    automated: 41,
    agingBuckets: { '<24h': 10, '24-48h': 7, '48-72h': 3, '>72h': 2 },
    agents: [
      { agente: 'Agente 1', abiertos: 6, tiempoMedio: 4.5, satisfaccion: 4.6 },
      { agente: 'Agente 2', abiertos: 5, tiempoMedio: 5.2, satisfaccion: 4.3 },
    ],
  };
}

function buildCohorts(): DashboardData['cohorts'] {
  return {
    cohorts: [
      { cohort: 'Semana 1', pedidos: 120, ingresos: 540000 },
      { cohort: 'Semana 2', pedidos: 95, ingresos: 410000 },
      { cohort: 'Semana 3', pedidos: 80, ingresos: 360000 },
    ],
  };
}

function buildTemplates(): DashboardData['templates'] {
  return {
    templates: [
      { plantilla: 'Recordatorio', envios: 120, respuestas: 80, bloqueos: 2, ctr: 24 },
      { plantilla: 'Novedades', envios: 90, respuestas: 45, bloqueos: 1, ctr: 18 },
    ],
  };
}

export function buildAnalyticsDemoDataset(view: AnalyticsContext): {
  data: DashboardData;
  message: string;
} {
  const base: DashboardData = {
    summary: buildSummary(),
    timeseries: buildTimeseries(),
    breakdownCategoria: buildBreakdown(baseCategories),
    breakdownCanal: buildBreakdown(baseChannels),
    breakdownEstado: buildBreakdown(baseStates),
    breakdownZona: buildBreakdown(['Centro', 'Norte', 'Sur']),
    breakdownModalidad: buildBreakdown(['Compra', 'Canje', 'Donación']),
    heatmap: buildHeatmap(),
    points: buildPoints(),
    topZonas: buildTopZonas(),
    operations: null,
    cohorts: null,
    templates: null,
  };

  if (view === 'operaciones' || view === 'municipio') {
    base.operations = buildOperations();
  }

  if (view === 'pyme') {
    base.cohorts = buildCohorts();
    base.templates = buildTemplates();
  }

  return {
    data: base,
    message:
      'Mostrando datos de ejemplo mientras se conecta el backend de métricas. Verificá los endpoints de analytics para ver datos reales.',
  };
}

export function hasDashboardData(data: DashboardData): boolean {
  if (!data) return false;

  const summary = data.summary;
  if (summary) {
    const totals = summary.totals ?? {};
    const hasTotals = Object.values(totals).some((value) => typeof value === 'number' && value > 0);
    const hasVolume = Boolean(
      summary.volume?.perDay?.length ||
        summary.volume?.byChannel?.length ||
        summary.volume?.byCategory?.length ||
        summary.volume?.byZone?.length,
    );
    const hasQuality = Boolean(summary.quality?.byAgent?.length || summary.quality?.byType?.length);
    if (hasTotals || hasVolume || hasQuality) return true;
  }

  const collections = [
    data.timeseries?.series,
    data.breakdownCategoria?.items,
    data.breakdownCanal?.items,
    data.breakdownEstado?.items,
    data.breakdownZona?.items,
    data.breakdownModalidad?.items,
    data.heatmap?.cells,
    data.points?.points,
    data.topZonas?.items,
    data.operations?.agents,
    data.cohorts?.cohorts,
    data.templates?.templates,
  ];

  if (collections.some((entry) => Array.isArray(entry) && entry.length > 0)) {
    return true;
  }

  const operationTotals = data.operations;
  if (operationTotals) {
    const numbers = [operationTotals.abiertos, operationTotals.slaBreaches, operationTotals.automated];
    if (numbers.some((value) => typeof value === 'number' && value > 0)) return true;
    const agingValues = operationTotals.agingBuckets ? Object.values(operationTotals.agingBuckets) : [];
    if (agingValues.some((value) => typeof value === 'number' && value > 0)) return true;
  }

  return false;
}
