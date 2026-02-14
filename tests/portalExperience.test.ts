import { describe, expect, it } from 'vitest';
import { mapHistoryToActivities, mapNetworkFeedToNews, mapSurveysHistory, mergePortalExperience } from '@/utils/portalExperience';
import { getDemoPortalContent } from '@/data/portalDemoContent';

describe('portalExperience utils', () => {
  it('maps history timeline to activities', () => {
    const activities = mapHistoryToActivities({
      timeline: [
        { id: 1, type: 'order', status: 'shipped', at: '2026-02-14T10:00:00Z', description: 'Pedido enviado' },
      ],
    });

    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe('order');
    expect(activities[0].status).toBe('shipped');
  });

  it('maps feed items to portal news', () => {
    const news = mapNetworkFeedToNews({
      items: [
        { id: 10, type: 'news', title: 'Nuevo servicio', date: '2026-02-14T08:00:00Z', tenant: { name: 'Tenant A' } },
      ],
    });

    expect(news).toHaveLength(1);
    expect(news[0].title).toBe('Nuevo servicio');
  });

  it('maps surveys history payload', () => {
    const surveys = mapSurveysHistory({ surveys: [{ id: 1, title: 'Encuesta de satisfacción' }] });
    expect(surveys).toHaveLength(1);
    expect(surveys[0].title).toBe('Encuesta de satisfacción');
  });

  it('merges backend responses into portal content', () => {
    const merged = mergePortalExperience(
      getDemoPortalContent(),
      {
        orders: [{ id: 1001, status: 'shipped', status_label: 'En camino', total: 1000, created_at: '2026-02-14T09:00:00Z' }],
        timeline: [{ id: 't1', type: 'points', status: 'earned', at: '2026-02-14T11:00:00Z' }],
        summary: { counts: { surveys: 3, suggestions: 2, claims: 1 } },
      },
      {
        items: [{ id: 20, type: 'news', title: 'Evento abierto', date: '2026-02-14T12:00:00Z', tenant: { name: 'Mi Ciudad' } }],
      },
      {
        current_points: 250,
        benefits: [{ id: 'b1', title: 'Descuento', points_cost: 120, eligible: true }],
      },
      {
        summary: { claims: 4, surveys: 5 },
      },
      {
        surveys: [{ id: 's1', title: 'Encuesta portal' }],
      },
    );

    expect(merged.loyaltySummary?.points).toBe(250);
    expect(merged.catalog[0].category).toBe('beneficios');
    expect(merged.news[0].title).toBe('Evento abierto');
    expect(merged.surveys[0].title).toBe('Encuesta portal');
  });
});
