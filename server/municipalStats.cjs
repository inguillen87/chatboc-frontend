function loadDb() {
  const path = require.resolve('./db.cjs');
  const mocker = globalThis.__vitest_mocker__;
  const mockKey = `mock:${path}`;
  const mockedModule = mocker?.executor?.moduleCache?.get?.(mockKey);
  if (mockedModule?.exports) {
    return mockedModule.exports;
  }
  delete require.cache[path];
  return require('./db.cjs');
}

const msToHours = (ms) => ms / (1000 * 60 * 60);

function getMunicipalStats(filters = {}) {
  let tickets = loadDb().getTickets();

  if (filters.rubro) {
    tickets = tickets.filter(t => t.category === filters.rubro);
  }
  if (filters.rango) {
    switch (filters.rango) {
      case 'Respondido < 4hs':
        tickets = tickets.filter(t => t.responseMs !== undefined && msToHours(t.responseMs) < 4);
        break;
      case 'Respondido > 24hs':
        tickets = tickets.filter(t => t.responseMs !== undefined && msToHours(t.responseMs) > 24);
        break;
      default:
        break;
    }
  }

  if (tickets.length === 0) {
    return { stats: [] };
  }

  const stats = [];
  let labelPrefix = 'Total Tickets';
  if (filters.rubro) labelPrefix = `Tickets de ${filters.rubro}`;
  if (filters.rango && filters.rango !== 'Todas') {
    labelPrefix = `${labelPrefix} (${filters.rango})`;
  }

  stats.push({ label: labelPrefix, value: tickets.length });

  const totalResponseMs = tickets.reduce((acc, t) => acc + (t.responseMs || 0), 0);
  const ticketsWithResponseTime = tickets.filter(t => t.responseMs !== undefined).length;

  if (ticketsWithResponseTime > 0) {
    const avgResponseHours = msToHours(totalResponseMs / ticketsWithResponseTime);
    stats.push({
      label: `Avg. Response Time (h) ${filters.rubro ? 'for ' + filters.rubro : ''} ${
        filters.rango && filters.rango !== 'Todas' ? '(' + filters.rango + ')' : ''
      }`.trim(),
      value: parseFloat(avgResponseHours.toFixed(2)),
    });
  }

  if (!filters.rubro && tickets.length > 0) {
    const byMunicipality = tickets.reduce((acc, t) => {
      acc[t.municipality] = (acc[t.municipality] || 0) + 1;
      return acc;
    }, {});
    for (const mun in byMunicipality) {
      stats.push({ label: `Tickets in ${mun}`, value: byMunicipality[mun] });
    }
  }

  if (!filters.rubro && tickets.length > 0) {
    const byCategory = tickets.reduce((acc, t) => {
      if (t.category) {
        acc[t.category] = (acc[t.category] || 0) + 1;
      }
      return acc;
    }, {});
    for (const cat in byCategory) {
      stats.push({ label: `Category: ${cat}`, value: byCategory[cat] });
    }
  }

  return { stats };
}

function getMunicipalStatsFiltersData() {
  const tickets = loadDb().getTickets();
  const rubros = [...new Set(tickets.map(t => t.category).filter(Boolean))];

  const barrios = ['Barrio Default 1', 'Barrio Default 2'];
  const tipos = ['Tipo Default A', 'Tipo Default B'];

  const rangos = [
    'Todas',
    'Últimas 24hs',
    'Últimos 7 días',
    'Últimos 30 días',
    'Respondido < 4hs',
    'Respondido > 24hs',
  ];

  return {
    rubros,
    barrios,
    tipos,
    rangos,
  };
}

module.exports = { getMunicipalStats, getMunicipalStatsFiltersData };
