const { getTickets } = require('./db');

function getMunicipalStats() {
  const tickets = getTickets();
  const statsMap = new Map();
  for (const t of tickets) {
    const key = t.municipality;
    if (!statsMap.has(key)) {
      statsMap.set(key, { name: key, totalTickets: 0, categories: {}, totalResponseMs: 0 });
    }
    const s = statsMap.get(key);
    s.totalTickets += 1;
    s.categories[t.category] = (s.categories[t.category] || 0) + 1;
    s.totalResponseMs += t.responseMs || 0;
  }
  const result = [];
  for (const s of statsMap.values()) {
    const avgMs = s.totalTickets ? s.totalResponseMs / s.totalTickets : 0;
    result.push({
      name: s.name,
      totalTickets: s.totalTickets,
      categories: s.categories,
      averageResponseHours: +(avgMs / 3600000).toFixed(2),
    });
  }
  return { municipalities: result };
}

module.exports = { getMunicipalStats };
