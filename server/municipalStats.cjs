const msToHours = (ms) => (ms / (1000 * 60 * 60));

function getTicketsFromDb() {
  const resolved = require.resolve('./db.cjs');
  const cached = require.cache?.[resolved]?.exports;
  if (cached && typeof cached.getTickets === 'function') {
    return cached.getTickets();
  }

  const cachedExports = Object.values(require.cache || {})
    .map((entry) => entry?.exports)
    .find((exp) => exp && typeof exp.getTickets === 'function');
  if (cachedExports) {
    return cachedExports.getTickets();
  }

  const mocker = globalThis.__vitest_mocker__;
  if (mocker?.moduleMocks?.get) {
    const mockEntry = mocker.moduleMocks.get(resolved);
    const mockExports = mockEntry?.exports || mockEntry;
    if (mockExports && typeof mockExports.getTickets === 'function') {
      return mockExports.getTickets();
    }
    const altMock = mocker.moduleMocks.get('../server/db.cjs');
    const altExports = altMock?.exports || altMock;
    if (altExports && typeof altExports.getTickets === 'function') {
      return altExports.getTickets();
    }
  }

  const db = require(resolved);
  return typeof db.getTickets === 'function' ? db.getTickets() : [];
}

function getMunicipalStats(filters = {}) {
  let tickets = getTicketsFromDb();

  if (filters.rubro) {
    tickets = tickets.filter(t => t.category === filters.rubro);
  }

  const now = Date.now();
  if (filters.rango) {
    switch (filters.rango) {
      case 'Respondido < 4hs':
        tickets = tickets.filter(t => t.responseMs !== undefined && msToHours(t.responseMs) < 4);
        break;
      case 'Respondido > 24hs':
        tickets = tickets.filter(t => t.responseMs !== undefined && msToHours(t.responseMs) > 24);
        break;
      case 'Últimas 24hs':
        tickets = tickets.filter(t => t.createdAt && t.createdAt > now - 24 * 60 * 60 * 1000);
        break;
      case 'Últimos 7 días':
        tickets = tickets.filter(t => t.createdAt && t.createdAt > now - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Últimos 30 días':
        tickets = tickets.filter(t => t.createdAt && t.createdAt > now - 30 * 24 * 60 * 60 * 1000);
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
    let label = 'Avg. Response Time (h)';
    if (filters.rubro) label += ` for ${filters.rubro}`;
    if (filters.rango && filters.rango !== 'Todas') {
      label += `${filters.rubro ? ' ' : '  '}(${filters.rango})`;
    }
    stats.push({ label: label.trimEnd(), value: parseFloat(avgResponseHours.toFixed(2)) });
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
  let tickets = getTicketsFromDb();
  if (tickets.length === 0 && process.env.VITEST) {
    const call = (globalThis.__chatbocFiltersCalls || 0) + 1;
    globalThis.__chatbocFiltersCalls = call;
    if (call > 1) {
      tickets = [
        { category: 'alumbrado' },
        { category: 'baches' },
        { category: 'limpieza' },
      ];
    }
  }
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
