import { describe, expect, it } from 'vitest';

import type { DemoAdminPreviewResponse } from './demoTypes';
import { buildExecutiveOverviewModel } from './buildExecutiveOverviewModel';

describe('buildExecutiveOverviewModel', () => {
  it('builds a source-backed executive model from metrics, channels and timeline', () => {
    const preview: DemoAdminPreviewResponse = {
      contract_version: 'demo.admin_preview.v1',
      title: 'Centro de comando ciudadano',
      description: 'Monitoreo ejecutivo del escenario visible.',
      data_provenance: {
        mode: 'synthetic_demo_scenario',
        synthetic: true,
        partial: true,
        suitable_for_government_decisions: false,
        label: 'Snapshot ilustrativo aislado.',
      },
      cards: [{ id: 'legacy', label: 'Tarjeta heredada', value: 999 }],
      metrics: [
        {
          id: 'claims',
          label: 'Reclamos ingresados',
          value: 184,
          unit: 'casos',
          period: 'Últimos 30 días',
          denominator: { label: 'Casos del corte', value: 184 },
        },
        {
          id: 'sla',
          label: 'Cumplimiento de SLA',
          value: 87,
          unit: '%',
          detail: 'Calculado sobre 168 expedientes.',
        },
      ],
      channel_summary: {
        contract_version: 'demo.channel_summary.v1',
        total_interactions: 426,
        label: 'Canales del escenario',
        channels: [
          { id: 'whatsapp', label: 'WhatsApp', value: 298, share_pct: 70 },
          { id: 'web', label: 'Web', value: 128, share_pct: 30 },
        ],
      },
      timeline: [
        {
          id: 'intake',
          label: 'Ingreso del reclamo',
          detail: 'La IA clasificó y derivó el caso.',
          time: '08:42',
          channel: 'whatsapp',
          status: 'in_target',
        },
      ],
      labels: {
        timeline_title: 'Circuito de atención',
        timeline_badge: '1 hito',
        summary_title: 'Lectura para gabinete',
        summary_description: 'Priorizar capacidad en los canales de mayor volumen.',
      },
    };

    const model = buildExecutiveOverviewModel(preview);

    expect(model.source).toEqual({
      label: 'demo.admin_preview.v1',
      mode: 'synthetic_demo_scenario',
      synthetic: true,
      partial: true,
      suitableForDecisions: false,
      note: 'Snapshot ilustrativo aislado.',
    });
    expect(model.scorecards.map((item) => item.id)).toEqual(['claims', 'sla']);
    expect(model.scorecards[0].evidence).toMatchObject({
      sourceLabel: 'demo.admin_preview.v1',
      basis: { label: 'Casos del corte', value: 184 },
      period: 'Últimos 30 días',
      dataMode: 'synthetic_demo_scenario',
    });
    expect(model.scorecards[1].evidence.basis).toBeNull();
    expect(model.ranking).toMatchObject({
      title: 'Canales del escenario',
      scale: 'share',
      sourceLabel: 'demo.channel_summary.v1',
      basis: { label: 'Interacciones', value: 426 },
      measureLabel: 'Participación del total',
    });
    expect(model.journey).toMatchObject({
      title: 'Circuito de atención',
      badge: '1 hito',
      steps: [{
        id: 'intake',
        title: 'Ingreso del reclamo',
        channel: 'WhatsApp',
        status: 'Dentro de SLA',
      }],
    });
    expect(model.callout).toEqual({
      title: 'Lectura para gabinete',
      description: 'Priorizar capacidad en los canales de mayor volumen.',
    });
  });

  it('uses cards only when metrics is empty and keeps relative rankings honest', () => {
    const preview: DemoAdminPreviewResponse = {
      contract_version: 'demo.admin_preview.v2',
      data_provenance: {
        mode: 'session_generated_events',
        synthetic: false,
        suitable_for_government_decisions: true,
      },
      metrics: [],
      cards: [
        {
          id: 'tickets',
          label: 'Tickets de la sesión',
          value: 12,
          detail: 'No usar el 999 de este texto como base.',
          denominator_label: 'Eventos recibidos',
          denominator_value: 12,
        },
        {
          id: 'status',
          label: 'Estado del circuito',
          status: 'ready',
          detail: 'Muestra 500 elementos en texto libre.',
        },
      ],
      channel_summary: {
        total_interactions: '426 interacciones',
        total_cases: 12,
        channels: [
          { id: 'whatsapp', label: 'WhatsApp', value: 8, share_pct: 66.7 },
          { id: 'web', label: 'Web', value: 4, share_pct: 140 },
        ],
      },
    };

    const model = buildExecutiveOverviewModel(preview);

    expect(model.scorecards.map((item) => item.id)).toEqual(['tickets', 'status']);
    expect(model.scorecards[0].evidence.basis).toEqual({ label: 'Eventos recibidos', value: 12 });
    expect(model.scorecards[1].evidence.basis).toBeNull();
    expect(model.ranking).toMatchObject({
      scale: 'relative',
      basis: { label: 'Casos', value: 12 },
      measureLabel: 'Casos',
    });
    expect(model.ranking?.items[1].sharePercent).toBeNull();
    expect(model.callout).toBeNull();
    expect(model.journey).toBeNull();
  });

  it('does not fall back to cards when a non-empty metrics contract is invalid', () => {
    const preview: DemoAdminPreviewResponse = {
      contract_version: 'demo.admin_preview.v1',
      metrics: [{ id: 'broken', label: 'Métrica sin valor', value: null }],
      cards: [{ id: 'legacy', label: 'No debe aparecer', value: 25 }],
      data_provenance: {
        mode: 'verified_operational',
        synthetic: false,
      },
    };

    const model = buildExecutiveOverviewModel(preview);

    expect(model.scorecards).toEqual([]);
    expect(model.source.label).toBe('demo.admin_preview.v1');
    expect(model.source.synthetic).toBe(false);
  });
});
