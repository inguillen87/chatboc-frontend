import { getTickets } from './db.js';

export function getMunicipalStats(filters) {
  const tickets = getTickets(filters);
  let filtered = tickets;
  const { rubro, rango } = filters;

  // Optimized: Single pass filtering
  if (rubro || (rango && rango !== 'Todas')) {
      const now = Date.now();
      const oneDayAgo = now - 86400000;
      const sevenDaysAgo = now - (7 * 86400000);
      const thirtyDaysAgo = now - (30 * 86400000);
      const fourHours = 4 * 60 * 60 * 1000;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      filtered = tickets.filter(t => {
          // 1. Check Category (rubro)
          if (rubro && t.category !== rubro) {
              return false;
          }

          // 2. Check Range (rango)
          if (rango && rango !== 'Todas') {
             const tTime = new Date(t.createdAt).getTime();

             if (rango === 'Respondido < 4hs') {
                 return t.responseMs !== undefined && t.responseMs < fourHours;
             }
             if (rango === 'Respondido > 24hs') {
                 return t.responseMs !== undefined && t.responseMs > twentyFourHours;
             }
             if (rango === 'Últimas 24hs') return tTime > oneDayAgo;
             if (rango === 'Últimos 7 días') return tTime > sevenDaysAgo;
             if (rango === 'Últimos 30 días') return tTime > thirtyDaysAgo;
          }

          return true;
      });
  }

  // Aggregation Logic (Preserving Original Functionality)
  const statsMap = {};

  for (const t of filtered) {
      const key = `${t.municipality || 'Desconocido'}-${t.category}`;

      if (!statsMap[key]) {
          statsMap[key] = {
              municipality: t.municipality,
              category: t.category,
              total: 0,
              responseMsSum: 0,
              responseCount: 0
          };
      }

      statsMap[key].total++;

      if (t.responseMs !== undefined) {
          statsMap[key].responseMsSum += t.responseMs;
          statsMap[key].responseCount++;
      }
  }

  const aggregatedStats = Object.values(statsMap).map(group => ({
      ...group,
      averageResponseMs: group.responseCount > 0 ? group.responseMsSum / group.responseCount : 0
  }));

  return {
      count: filtered.length,
      tickets: filtered,
      stats: aggregatedStats
  };
}

export function getMunicipalStatsFiltersData() {
    const tickets = getTickets({});
    const barrios = [...new Set(tickets.map(t => t.municipality || ''))].filter(Boolean);
    const tipos = [...new Set(tickets.map(t => t.category))];

    return {
        barrios,
        tipos,
        rangos: ['Todas', 'Respondido < 4hs', 'Respondido > 24hs', 'Últimas 24hs', 'Últimos 7 días', 'Últimos 30 días']
    };
}
