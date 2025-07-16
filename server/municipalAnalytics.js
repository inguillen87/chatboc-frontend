import { getTickets } from './db.js';

export function getMunicipalAnalytics() {
  const tickets = getTickets();
  const statsMap = new Map();
  for (const t of tickets) {
    const key = t.municipality;
    if (!statsMap.has(key)) {
      statsMap.set(key, { total: 0, categories: {}, totalResponseMs: 0 });
    }
    const s = statsMap.get(key);
    s.total += 1;
    s.categories[t.category] = (s.categories[t.category] || 0) + 1;
    s.totalResponseMs += t.responseMs || 0;
  }
  const result = [];
  for (const [name, s] of statsMap.entries()) {
    const avgMs = s.total ? s.totalResponseMs / s.total : 0;
    result.push({
      name,
      totalTickets: s.total,
      categories: s.categories,
      averageResponseHours: +(avgMs / 3600000).toFixed(2),
    });
  }
  return { municipalities: result };
}
