import { describe, it, expect } from 'vitest';
import {
  dataset,
  summary,
  filterTickets,
  filterInteractions,
  computeTimeseries,
  computeBreakdown,
  computeHeatmap,
  computeOperations,
  computePymeMetrics,
} from '../analytics/store.js';

function baseFilters(tenantId) {
  const now = new Date();
  return {
    tenantId,
    from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    to: now,
    context: null,
    canal: [],
    categoria: [],
    estado: [],
    agente: [],
    zona: [],
    etiquetas: [],
    rubro: [],
    pyme: [],
    bbox: null,
    search: null,
    metric: 'tickets_total',
    group: null,
    dimension: 'categoria',
    subject: 'zonas',
  };
}

describe('Analytics store', () => {
  it('should build a summary with SLA and efficiency metrics', () => {
    const filters = baseFilters('tenant-municipio-1');
    const report = summary(filters);
    expect(report.totals.tickets).toBeGreaterThan(0);
    expect(report.sla.ack.p50).toBeGreaterThan(0);
    expect(report.efficiency.automationRate).toBeGreaterThanOrEqual(0);
  });

  it('should compute timeseries grouped by category', () => {
    const filters = baseFilters('tenant-municipio-1');
    const tickets = filterTickets(filters);
    const series = computeTimeseries(tickets, 'tickets_total', 'categoria');
    expect(series.length).toBeGreaterThan(0);
    expect(series[0]).toHaveProperty('breakdown');
  });

  it('should compute breakdown data for channels', () => {
    const filters = baseFilters('tenant-municipio-1');
    const tickets = filterTickets(filters);
    const breakdown = computeBreakdown(tickets, 'canal');
    expect(breakdown.length).toBeGreaterThan(0);
    expect(breakdown[0].value).toBeGreaterThan(0);
  });

  it('should produce geo heatmap cells', () => {
    const filters = baseFilters('tenant-municipio-1');
    const tickets = filterTickets(filters);
    const cells = computeHeatmap(tickets);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0]).toHaveProperty('cellId');
  });

  it('should calculate operations aging buckets', () => {
    const filters = baseFilters('tenant-municipio-1');
    const tickets = filterTickets(filters);
    const operations = computeOperations(tickets);
    const totalQueues = Object.values(operations.agingBuckets).reduce((acc, value) => acc + value, 0);
    expect(totalQueues).toBeGreaterThanOrEqual(0);
  });

  it('should compute pyme metrics with templates CTR', () => {
    const filters = baseFilters('tenant-pyme-1');
    const tickets = filterTickets(filters);
    const interactions = filterInteractions(filters, tickets);
    const orders = dataset.orders.filter(
      (order) => order.tenant_id === filters.tenantId && new Date(order.creado_en) >= filters.from,
    );
    const metrics = computePymeMetrics(orders, tickets, interactions);
    expect(metrics.totalOrders).toBeGreaterThan(0);
    expect(metrics.plantillas.length).toBeGreaterThan(0);
  });
});
