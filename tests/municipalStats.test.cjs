import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getMunicipalStats } from '../server/municipalStats.js';
import * as db from '../server/db.js';

describe('Municipal Stats - getMunicipalStats', () => {
  const originalTickets = db.getTickets();

  beforeEach(() => {
    db.__setTickets([
      { municipality: 'Alpha', category: 'baches', responseMs: 1 * 60 * 60 * 1000 },
      { municipality: 'Alpha', category: 'limpieza', responseMs: 3 * 60 * 60 * 1000 },
      { municipality: 'Alpha', category: 'baches', responseMs: 5 * 60 * 60 * 1000 },
      { municipality: 'Beta', category: 'limpieza', responseMs: 2 * 60 * 60 * 1000 },
      { municipality: 'Beta', category: 'arbolado', responseMs: 10 * 60 * 60 * 1000 },
      { municipality: 'Gamma', category: 'baches', responseMs: 30 * 60 * 60 * 1000 },
    ]);
  });

  afterAll(() => {
    db.__setTickets(originalTickets);
  });

  it('should return stats for all tickets when no filters are applied', () => {
    const result = getMunicipalStats({});
    expect(Array.isArray(result.stats)).toBe(true);

    const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets');
    expect(totalTicketsStat.value).toBe(6);

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h)'));
    expect(avgResponseStat.value).toBe(8.5);

    expect(result.stats.find(s => s.label === 'Tickets in Alpha' && s.value === 3)).toBeDefined();
    expect(result.stats.find(s => s.label === 'Tickets in Beta' && s.value === 2)).toBeDefined();
    expect(result.stats.find(s => s.label === 'Tickets in Gamma' && s.value === 1)).toBeDefined();

    expect(result.stats.find(s => s.label === 'Category: baches' && s.value === 3)).toBeDefined();
    expect(result.stats.find(s => s.label === 'Category: limpieza' && s.value === 2)).toBeDefined();
    expect(result.stats.find(s => s.label === 'Category: arbolado' && s.value === 1)).toBeDefined();
  });

  it('should filter by rubro (category)', () => {
    const result = getMunicipalStats({ rubro: 'baches' });

    const totalTicketsStat = result.stats.find(s => s.label === 'Tickets de baches');
    expect(totalTicketsStat.value).toBe(3);

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h) for baches'));
    expect(avgResponseStat.value).toBe(12);

    expect(result.stats.find(s => s.label.startsWith('Tickets in'))).toBeUndefined();
  });

  it('should filter by rango (Respondido < 4hs)', () => {
    const result = getMunicipalStats({ rango: 'Respondido < 4hs' });
    const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets (Respondido < 4hs)');
    expect(totalTicketsStat.value).toBe(3);

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h)  (Respondido < 4hs)'));
    expect(avgResponseStat.value).toBe(2);
  });

  it('should filter by rango (Respondido > 24hs)', () => {
    const result = getMunicipalStats({ rango: 'Respondido > 24hs' });
    const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets (Respondido > 24hs)');
    expect(totalTicketsStat.value).toBe(1);

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h)  (Respondido > 24hs)'));
    expect(avgResponseStat.value).toBe(30);
  });

  it('should combine rubro and rango filters', () => {
    const result = getMunicipalStats({ rubro: 'baches', rango: 'Respondido < 4hs' });
    const totalTicketsStat = result.stats.find(s => s.label === 'Tickets de baches (Respondido < 4hs)');
    expect(totalTicketsStat.value).toBe(1);

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h) for baches (Respondido < 4hs)'));
    expect(avgResponseStat.value).toBe(1);
  });

  it('should return empty stats array if no tickets match filters', () => {
    const result = getMunicipalStats({ rubro: 'nonexistent' });
    expect(result).toEqual({ stats: [] });
  });

  it('should handle rango filter "Todas" correctly (no time filtering)', () => {
    const result = getMunicipalStats({ rango: 'Todas' });
    const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets');
    expect(totalTicketsStat.value).toBe(6);
  });
});
