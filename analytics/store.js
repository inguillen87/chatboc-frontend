import { generateDataset } from './dataGenerator.js';

const dataset = generateDataset({ days: 120 });

function toDate(value) {
  return value ? new Date(value) : null;
}

function minutesBetween(startIso, endIso) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / 60000;
}

function percentiles(values) {
  if (!values.length) {
    return { p50: 0, p90: 0, p95: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const p = (ratio) => {
    const index = Math.floor((sorted.length - 1) * ratio);
    return Number(sorted[index].toFixed(2));
  };
  return {
    p50: p(0.5),
    p90: p(0.9),
    p95: p(0.95),
  };
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function filterByRange(itemDate, from, to) {
  const date = toDate(itemDate);
  return date && date >= from && date <= to;
}

function withinBBox(point, bbox) {
  if (!bbox) return true;
  const { lat, lon } = point?.ubicacion || point;
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  return lon >= bbox.minLng && lon <= bbox.maxLng && lat >= bbox.minLat && lat <= bbox.maxLat;
}

function matchesFilters(ticket, filters) {
  if (!filterByRange(ticket.creado_en, filters.from, filters.to)) return false;
  if (!withinBBox(ticket, filters.bbox)) return false;
  if (filters.canal.length && !filters.canal.includes(ticket.canal)) return false;
  if (filters.categoria.length && !filters.categoria.includes(ticket.categoria)) return false;
  if (filters.estado.length && !filters.estado.includes(ticket.estado)) return false;
  if (filters.agente.length && !filters.agente.includes(ticket.asignado_a)) return false;
  if (filters.zona.length) {
    const zone = ticket.ubicacion?.zona || ticket.ubicacion?.barrio;
    if (!zone || !filters.zona.includes(zone)) return false;
  }
  if (filters.etiquetas.length) {
    const tags = Array.isArray(ticket.etiquetas) ? ticket.etiquetas : [];
    if (!filters.etiquetas.every((tag) => tags.includes(tag))) return false;
  }
  if (filters.search) {
    const combined = [
      ticket.id,
      ticket.categoria,
      ticket.subcategoria,
      ticket.estado,
      ticket.asignado_a,
      ticket.ubicacion?.barrio,
      ticket.ubicacion?.zona,
    ]
      .filter(Boolean)
      .map((value) => value.toString().toLowerCase())
      .join(' ');
    if (!combined.includes(filters.search.toLowerCase())) return false;
  }
  return true;
}

function filterTickets(filters) {
  return dataset.tickets.filter(
    (ticket) => ticket.tenant_id === filters.tenantId && matchesFilters(ticket, filters),
  );
}

function filterInteractions(filters, tickets) {
  const ids = new Set(tickets.map((ticket) => ticket.id));
  return dataset.interactions.filter((item) => ids.has(item.ticket_id));
}

function filterOrders(filters, tickets) {
  if (!tickets.length) return [];
  const ids = new Set(tickets.map((ticket) => ticket.id));
  return dataset.orders.filter(
    (order) =>
      order.tenant_id === filters.tenantId &&
      ids.has(order.ticket_id) &&
      filterByRange(order.creado_en, filters.from, filters.to),
  );
}

function filterSurveys(filters, tickets) {
  const ids = new Set(tickets.map((ticket) => ticket.id));
  return dataset.surveys.filter(
    (survey) =>
      survey.tenant_id === filters.tenantId &&
      ids.has(survey.ticket_id) &&
      filterByRange(survey.timestamp, filters.from, filters.to),
  );
}

function computeSlaMetrics(tickets) {
  const tta = [];
  const ttr = [];
  tickets.forEach((ticket) => {
    const ack = minutesBetween(ticket.creado_en, ticket.primer_respuesta_en);
    if (Number.isFinite(ack)) {
      tta.push(round(ack / 60, 2));
    }
    const resolution = minutesBetween(ticket.creado_en, ticket.cerrado_en);
    if (Number.isFinite(resolution)) {
      ttr.push(round(resolution / 60, 2));
    }
  });
  return {
    ack: percentiles(tta),
    resolve: percentiles(ttr),
  };
}

function computeEfficiency(tickets) {
  if (!tickets.length) {
    return {
      firstContact: 0,
      reopenRate: 0,
      automationRate: 0,
    };
  }
  const firstContact = tickets.filter(
    (ticket) => minutesBetween(ticket.primer_respuesta_en, ticket.cerrado_en) <= 60,
  ).length;
  const reopen = tickets.filter((ticket) => ticket.reapertura).length;
  const automated = tickets.filter((ticket) => ticket.automatizado).length;
  return {
    firstContact: round((firstContact / tickets.length) * 100, 2),
    reopenRate: round((reopen / tickets.length) * 100, 2),
    automationRate: round((automated / tickets.length) * 100, 2),
  };
}

function computeVolume(tickets) {
  const byDay = new Map();
  const byCanal = new Map();
  const byCategoria = new Map();
  const byZona = new Map();
  tickets.forEach((ticket) => {
    const day = ticket.creado_en.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
    byCanal.set(ticket.canal, (byCanal.get(ticket.canal) || 0) + 1);
    byCategoria.set(ticket.categoria, (byCategoria.get(ticket.categoria) || 0) + 1);
    const zone = ticket.ubicacion?.zona || ticket.ubicacion?.barrio || 'sin_zona';
    byZona.set(zone, (byZona.get(zone) || 0) + 1);
  });
  return {
    perDay: Array.from(byDay.entries()).map(([date, value]) => ({ date, value })),
    byChannel: Array.from(byCanal.entries()).map(([label, value]) => ({ label, value })),
    byCategory: Array.from(byCategoria.entries()).map(([label, value]) => ({ label, value })),
    byZone: Array.from(byZona.entries()).map(([label, value]) => ({ label, value })),
  };
}

function computeQuality(surveys, tickets) {
  const byType = surveys.reduce((acc, survey) => {
    const key = survey.tipo.toLowerCase();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(survey.score);
    return acc;
  }, {});
  const byAgent = new Map();
  surveys.forEach((survey) => {
    const ticket = tickets.find((item) => item.id === survey.ticket_id);
    if (!ticket?.asignado_a) return;
    const agentScores = byAgent.get(ticket.asignado_a) || [];
    agentScores.push(survey.score);
    byAgent.set(ticket.asignado_a, agentScores);
  });
  const mapScores = (entries) =>
    Object.entries(entries).map(([key, values]) => ({
      label: key,
      average: round(values.reduce((a, b) => a + b, 0) / values.length, 2),
      responses: values.length,
    }));
  return {
    byType: mapScores(byType),
    byAgent: Array.from(byAgent.entries()).map(([label, values]) => ({
      label,
      average: round(values.reduce((a, b) => a + b, 0) / values.length, 2),
      responses: values.length,
    })),
  };
}

function computePymeMetrics(orders, tickets, interactions) {
  if (!orders.length) {
    return {
      totalOrders: 0,
      ticketMedio: 0,
      ingresos: [],
      topProductos: [],
      conversion: tickets.length ? 0 : 0,
      recurrencia: { d30: 0, d60: 0, d90: 0 },
      horasPico: [],
      plantillas: [],
      canales: [],
    };
  }
  const totals = orders.map((order) => order.total);
  const ticketMedio = round(totals.reduce((a, b) => a + b, 0) / orders.length, 2);
  const ingresos = {};
  const productos = new Map();
  const clientes = new Map();
  const canales = new Map();
  const horas = new Map();
  orders.forEach((order) => {
    const day = order.creado_en.slice(0, 10);
    ingresos[day] = (ingresos[day] || 0) + order.total;
    order.items.forEach((item) => {
      productos.set(item.sku, (productos.get(item.sku) || 0) + item.qty);
    });
    const cliente = order.ticket_id;
    const historial = clientes.get(cliente) || [];
    historial.push(order.creado_en);
    clientes.set(cliente, historial);
    canales.set(order.canal, (canales.get(order.canal) || 0) + 1);
    const createdAt = new Date(order.creado_en);
    horas.set(createdAt.getHours(), (horas.get(createdAt.getHours()) || 0) + 1);
  });
  const recurrence = { d30: 0, d60: 0, d90: 0 };
  clientes.forEach((dates) => {
    const sorted = dates.sort();
    if (sorted.length <= 1) return;
    const first = new Date(sorted[0]);
    sorted.slice(1).forEach((date) => {
      const diffDays = Math.floor((new Date(date).getTime() - first.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays <= 30) recurrence.d30 += 1;
      if (diffDays <= 60) recurrence.d60 += 1;
      if (diffDays <= 90) recurrence.d90 += 1;
    });
  });
  const plantillas = interactions
    .filter((item) => item.tipo === 'plantilla')
    .reduce((acc, item) => {
      const key = item.plantilla || 'desconocida';
      if (!acc[key]) {
        acc[key] = { plantilla: key, envios: 0, respuestas: 0, bloqueos: 0 };
      }
      acc[key].envios += 1;
      if (item.actor === 'usuario') {
        acc[key].respuestas += 1;
      }
      if (item.actor === 'bot' && Math.random() > 0.8) {
        acc[key].bloqueos += 1;
      }
      return acc;
    }, {});

  return {
    totalOrders: orders.length,
    ticketMedio,
    ingresos: Object.entries(ingresos).map(([date, value]) => ({ date, value: round(value, 2) })),
    topProductos: Array.from(productos.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20),
    conversion: tickets.length ? round((orders.length / tickets.length) * 100, 2) : 0,
    recurrencia: recurrence,
    horasPico: Array.from(horas.entries())
      .map(([hour, value]) => ({ hour, value }))
      .sort((a, b) => a.hour - b.hour),
    canales: Array.from(canales.entries()).map(([label, value]) => ({ label, value })),
    plantillas: Object.values(plantillas).map((item) => ({
      ...item,
      ctr: item.envios ? round((item.respuestas / item.envios) * 100, 2) : 0,
    })),
  };
}

function computeHeatmap(tickets) {
  const cells = new Map();
  tickets.forEach((ticket) => {
    const cellId = ticket.ubicacion?.cell_id;
    if (!cellId) return;
    const key = `${ticket.tenant_id}-${cellId}`;
    const entry = cells.get(key) || {
      cellId,
      tenant_id: ticket.tenant_id,
      count: 0,
      centroid_lat: ticket.ubicacion.lat,
      centroid_lon: ticket.ubicacion.lon,
      breakdown: {},
    };
    entry.count += 1;
    entry.breakdown[ticket.categoria] = (entry.breakdown[ticket.categoria] || 0) + 1;
    cells.set(key, entry);
  });
  return Array.from(cells.values());
}

function computePoints(tickets, limit = 500) {
  return tickets
    .filter((ticket) => ticket.ubicacion?.lat && ticket.ubicacion?.lon)
    .slice(0, limit)
    .map((ticket) => ({
      cellId: ticket.ubicacion.cell_id,
      lat: ticket.ubicacion.lat,
      lon: ticket.ubicacion.lon,
      categoria: ticket.categoria,
      estado: ticket.estado,
    }));
}

function computeTimeseries(tickets, metric, group) {
  const byDay = new Map();
  tickets.forEach((ticket) => {
    const day = ticket.creado_en.slice(0, 10);
    const entry = byDay.get(day) || { date: day, value: 0, breakdown: {} };
    if (metric === 'sla_ttr') {
      const minutes = minutesBetween(ticket.creado_en, ticket.cerrado_en);
      if (minutes) {
        entry.value += minutes / 60;
      }
    } else {
      entry.value += 1;
    }
    if (group === 'categoria') {
      entry.breakdown[ticket.categoria] = (entry.breakdown[ticket.categoria] || 0) + 1;
    }
    if (group === 'canal') {
      entry.breakdown[ticket.canal] = (entry.breakdown[ticket.canal] || 0) + 1;
    }
    if (group === 'estado') {
      entry.breakdown[ticket.estado] = (entry.breakdown[ticket.estado] || 0) + 1;
    }
    byDay.set(day, entry);
  });
  return Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function computeBreakdown(tickets, dimension) {
  const groups = new Map();
  tickets.forEach((ticket) => {
    let key = 'otros';
    if (dimension === 'categoria') key = ticket.categoria;
    if (dimension === 'canal') key = ticket.canal;
    if (dimension === 'estado') key = ticket.estado;
    if (dimension === 'agente') key = ticket.asignado_a || 'sin_asignar';
    if (dimension === 'zona') key = ticket.ubicacion?.zona || 'sin_zona';
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  return Array.from(groups.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function computeTop(tickets, subject) {
  if (subject === 'zonas') {
    return computeBreakdown(tickets, 'zona').slice(0, 10);
  }
  if (subject === 'calles') {
    const groups = new Map();
    tickets.forEach((ticket) => {
      const street = ticket.ubicacion?.barrio || 'sin_barrio';
      groups.set(street, (groups.get(street) || 0) + 1);
    });
    return Array.from(groups.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }
  if (subject === 'productos') {
    const groups = new Map();
    dataset.orders
      .filter((order) => order.tenant_id === tickets[0]?.tenant_id)
      .forEach((order) => {
        order.items.forEach((item) => {
          groups.set(item.sku, (groups.get(item.sku) || 0) + item.qty);
        });
      });
    return Array.from(groups.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }
  return [];
}

function computeOperations(tickets) {
  const now = Date.now();
  const queues = tickets.filter((ticket) => ticket.estado !== 'resuelto');
  const agingBuckets = {
    '0-4h': 0,
    '4-24h': 0,
    '1-3d': 0,
    '3-7d': 0,
    '>7d': 0,
  };
  queues.forEach((ticket) => {
    const created = new Date(ticket.creado_en).getTime();
    const diffHours = (now - created) / (60 * 60 * 1000);
    if (diffHours <= 4) agingBuckets['0-4h'] += 1;
    else if (diffHours <= 24) agingBuckets['4-24h'] += 1;
    else if (diffHours <= 72) agingBuckets['1-3d'] += 1;
    else if (diffHours <= 168) agingBuckets['3-7d'] += 1;
    else agingBuckets['>7d'] += 1;
  });
  const slaBreaches = tickets.filter((ticket) => ticket.sla_breach).length;
  const automated = tickets.filter((ticket) => ticket.automatizado).length;
  const agentsLoad = new Map();
  tickets.forEach((ticket) => {
    if (!ticket.asignado_a) return;
    const data = agentsLoad.get(ticket.asignado_a) || { abiertos: 0, tiempoMedio: 0, satisfacción: null };
    if (ticket.estado !== 'resuelto') {
      data.abiertos += 1;
    }
    const duration = minutesBetween(ticket.creado_en, ticket.cerrado_en);
    if (duration) {
      data.tiempoMedio += duration;
    }
    agentsLoad.set(ticket.asignado_a, data);
  });
  const agentsTable = Array.from(agentsLoad.entries()).map(([agentId, data]) => ({
    agente: agentId,
    abiertos: data.abiertos,
    tiempoMedio: data.abiertos ? round(data.tiempoMedio / data.abiertos, 2) : 0,
    satisfaccion: round(3 + Math.random() * 2, 2),
  }));
  return {
    abiertos: queues.length,
    slaBreaches,
    automated,
    agingBuckets,
    agents: agentsTable,
  };
}

function computeCohorts(orders) {
  const cohorts = new Map();
  orders.forEach((order) => {
    const month = order.creado_en.slice(0, 7);
    const cohort = cohorts.get(month) || { cohort: month, pedidos: 0, ingresos: 0 };
    cohort.pedidos += 1;
    cohort.ingresos += order.total;
    cohorts.set(month, cohort);
  });
  return Array.from(cohorts.values())
    .map((cohort) => ({ ...cohort, ingresos: round(cohort.ingresos, 2) }))
    .sort((a, b) => (a.cohort < b.cohort ? -1 : 1));
}

function computeHotspots(tickets) {
  const heatmap = computeHeatmap(tickets);
  return heatmap
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((cell) => ({
      cellId: cell.cellId,
      count: cell.count,
      centroid: [cell.centroid_lat, cell.centroid_lon],
      breakdown: cell.breakdown,
    }));
}

function computeChronic(tickets) {
  const byZone = new Map();
  tickets.forEach((ticket) => {
    const zone = ticket.ubicacion?.zona || ticket.ubicacion?.barrio || 'sin_zona';
    const week = `${ticket.creado_en.slice(0, 4)}-W${Math.ceil(new Date(ticket.creado_en).getDate() / 7)}`;
    const key = `${zone}-${week}`;
    byZone.set(key, (byZone.get(key) || 0) + 1);
  });
  const zones = new Map();
  byZone.forEach((count, key) => {
    const [zone, week] = key.split('-W');
    const zoneEntry = zones.get(zone) || [];
    zoneEntry.push({ week: `W${week}`, count });
    zones.set(zone, zoneEntry);
  });
  return Array.from(zones.entries())
    .filter(([, weeks]) => weeks.length >= 4 && weeks.every((item) => item.count >= 3))
    .map(([zone, weeks]) => ({ zone, weeks }));
}

function getFiltersCatalog(tenantId) {
  const tickets = dataset.tickets.filter((ticket) => ticket.tenant_id === tenantId);
  const unique = (fn) => Array.from(new Set(tickets.map(fn).filter(Boolean)));
  return {
    canales: unique((ticket) => ticket.canal),
    categorias: unique((ticket) => ticket.categoria),
    estados: unique((ticket) => ticket.estado),
    agentes: unique((ticket) => ticket.asignado_a),
    zonas: unique((ticket) => ticket.ubicacion?.zona || ticket.ubicacion?.barrio),
    etiquetas: Array.from(
      new Set(
        tickets.flatMap((ticket) => (Array.isArray(ticket.etiquetas) ? ticket.etiquetas : [])),
      ),
    ),
  };
}

function summary(filters) {
  const tickets = filterTickets(filters);
  const interactions = filterInteractions(filters, tickets);
  const orders = filterOrders(filters, tickets);
  const surveys = filterSurveys(filters, tickets);
  const sla = computeSlaMetrics(tickets);
  const efficiency = computeEfficiency(tickets);
  const volume = computeVolume(tickets);
  const quality = computeQuality(surveys, tickets);
  const pyme = computePymeMetrics(orders, tickets, interactions);
  return {
    generatedAt: dataset.generatedAt,
    tenantId: filters.tenantId,
    filters: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      canal: filters.canal,
      categoria: filters.categoria,
      estado: filters.estado,
      agente: filters.agente,
      zona: filters.zona,
    },
    totals: {
      tickets: tickets.length,
      abiertos: tickets.filter((ticket) => ticket.estado !== 'resuelto').length,
      backlog: tickets.filter((ticket) => ticket.estado === 'backlog').length,
      adjuntos: tickets.reduce((acc, ticket) => acc + (ticket.adjuntos_count || 0), 0),
    },
    sla,
    efficiency,
    volume,
    quality,
    pyme,
  };
}

export {
  dataset,
  summary,
  filterTickets,
  filterInteractions,
  filterOrders,
  filterSurveys,
  computeTimeseries,
  computeBreakdown,
  computeHeatmap,
  computePoints,
  computeTop,
  computeOperations,
  computeCohorts,
  computeHotspots,
  computeChronic,
  getFiltersCatalog,
  computePymeMetrics,
};
