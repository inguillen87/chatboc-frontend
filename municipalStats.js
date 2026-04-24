import { getTickets } from './db.js';

const RANGOS = ['Todas', 'Últimas 24hs', 'Últimos 7 días', 'Últimos 30 días', 'Respondido < 4hs', 'Respondido > 24hs'];

function filterByRango(ticket, rango, now) {
  if (!rango || rango === 'Todas') {
    return true;
  }

  const ticketTime = new Date(ticket.createdAt || 0).getTime();
  const fourHours = 4 * 60 * 60 * 1000;
  const twentyFourHours = 24 * 60 * 60 * 1000;

  if (rango === 'Respondido < 4hs') {
    return typeof ticket.responseMs === 'number' && ticket.responseMs < fourHours;
  }

  if (rango === 'Respondido > 24hs') {
    return typeof ticket.responseMs === 'number' && ticket.responseMs > twentyFourHours;
  }

  if (rango === 'Últimas 24hs') {
    return ticketTime > now - 24 * 60 * 60 * 1000;
  }

  if (rango === 'Últimos 7 días') {
    return ticketTime > now - 7 * 24 * 60 * 60 * 1000;
  }

  if (rango === 'Últimos 30 días') {
    return ticketTime > now - 30 * 24 * 60 * 60 * 1000;
  }

  return true;
}

export function getMunicipalStats(filters = {}) {
  const tickets = getTickets(filters);
  const rubro = filters?.rubro;
  const rango = filters?.rango;
  const now = Date.now();

  const filtered = tickets.filter((ticket) => {
    if (rubro && ticket.category !== rubro) {
      return false;
    }

    return filterByRango(ticket, rango, now);
  });

  if (filtered.length === 0) {
    return { stats: [] };
  }

  const avgResponseHours =
    Math.round(
      (filtered.reduce((acc, ticket) => acc + (Number(ticket.responseMs) || 0), 0) /
        filtered.length /
        3600000) *
        10,
    ) / 10;

  const rangeSuffix = rango && rango !== 'Todas' ? ` (${rango})` : '';

  if (rubro) {
    return {
      stats: [
        { label: `Tickets de ${rubro}${rangeSuffix}`, value: filtered.length },
        {
          label: `Avg. Response Time (h) for ${rubro}${rangeSuffix}`,
          value: avgResponseHours,
        },
      ],
    };
  }

  const byMunicipality = new Map();
  const byCategory = new Map();

  filtered.forEach((ticket) => {
    if (ticket.municipality) {
      byMunicipality.set(ticket.municipality, (byMunicipality.get(ticket.municipality) || 0) + 1);
    }

    if (ticket.category) {
      byCategory.set(ticket.category, (byCategory.get(ticket.category) || 0) + 1);
    }
  });

  const stats = [
    { label: `Total Tickets${rangeSuffix}`, value: filtered.length },
    {
      label: `Avg. Response Time (h)${rango && rango !== 'Todas' ? `  (${rango})` : ''}`,
      value: avgResponseHours,
    },
    ...Array.from(byMunicipality.entries()).map(([municipality, count]) => ({
      label: `Tickets in ${municipality}`,
      value: count,
    })),
    ...Array.from(byCategory.entries()).map(([category, count]) => ({
      label: `Category: ${category}`,
      value: count,
    })),
  ];

  return { stats };
}

export function getMunicipalStatsFiltersData() {
  const tickets = getTickets({});

  const rubros = [...new Set(tickets.map((ticket) => ticket?.category).filter(Boolean))];

  return {
    rubros,
    barrios: ['Barrio Default 1', 'Barrio Default 2'],
    tipos: ['Tipo Default A', 'Tipo Default B'],
    rangos: RANGOS,
  };
}
