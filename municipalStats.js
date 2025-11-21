import { getTickets } from './db.js';

const msToHours = (ms) => ms / (1000 * 60 * 60);

function formatAvgLabel({ rubro, rango }) {
  let label = 'Avg. Response Time (h)';
  if (rubro) {
    label += ` for ${rubro}`;
  }
  if (rango && rango !== 'Todas') {
    label += rubro ? ` (${rango})` : `  (${rango})`;
  }
  return label;
}

function buildTotalLabel({ rubro, rango }) {
  if (rubro && rango && rango !== 'Todas') return `Tickets de ${rubro} (${rango})`;
  if (rubro) return `Tickets de ${rubro}`;
  if (rango && rango !== 'Todas') return `Total Tickets (${rango})`;
  return 'Total Tickets';
}

export function getMunicipalStats(filters = {}) {
  const { rubro, rango } = filters;
  let tickets = getTickets();

  if (rubro) {
    tickets = tickets.filter((t) => t.category === rubro);
  }

  if (rango && rango !== 'Todas') {
    switch (rango) {
      case 'Respondido < 4hs':
        tickets = tickets.filter((t) => t.responseMs !== undefined && msToHours(t.responseMs) < 4);
        break;
      case 'Respondido > 24hs':
        tickets = tickets.filter((t) => t.responseMs !== undefined && msToHours(t.responseMs) > 24);
        break;
      case 'Últimas 24hs':
        tickets = tickets.filter((t) => t.createdAt && t.createdAt > Date.now() - 24 * 60 * 60 * 1000);
        break;
      case 'Últimos 7 días':
        tickets = tickets.filter((t) => t.createdAt && t.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'Últimos 30 días':
        tickets = tickets.filter((t) => t.createdAt && t.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        break;
    }
  }

  if (tickets.length === 0) return { stats: [] };

  const totalMs = tickets.reduce((acc, t) => acc + (t.responseMs ?? 0), 0);
  const avgHours = Number((totalMs / tickets.length / (1000 * 60 * 60)).toFixed(1));

  const stats = [
    { label: buildTotalLabel({ rubro, rango }), value: tickets.length },
    { label: formatAvgLabel({ rubro, rango }), value: avgHours },
  ];

  if (!rubro) {
    const byMuni = tickets.reduce((acc, ticket) => {
      const key = ticket.municipality || 'Desconocido';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    for (const [muni, count] of Object.entries(byMuni)) {
      stats.push({ label: `Tickets in ${muni}`, value: count });
    }
  }

  const byCategory = tickets.reduce((acc, ticket) => {
    if (ticket.category) {
      acc[ticket.category] = (acc[ticket.category] || 0) + 1;
    }
    return acc;
  }, {});

  for (const [cat, count] of Object.entries(byCategory)) {
    const label = rubro && rubro === cat
      ? `Tickets de ${cat}${rango && rango !== 'Todas' ? ` (${rango})` : ''}`
      : `Category: ${cat}`;
    if (!stats.find((s) => s.label === label)) {
      stats.push({ label, value: count });
    }
  }

  return { stats };
}

export function getMunicipalStatsFiltersData() {
  const tickets = getTickets();
  const rubros = [...new Set(tickets.map((t) => t.category).filter(Boolean))];
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
