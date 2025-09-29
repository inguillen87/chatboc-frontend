const { getDataset } = require('./dataset.cjs');
const { formatDate, percentile, average, sum, groupBy, clamp } = require('./utils.cjs');

const CLOSED_STATES = new Set(['resuelto', 'cerrado']);

function normalizeRange(from, to) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function matchesFilter(value, selected) {
  if (!selected || selected.length === 0) return true;
  return selected.includes(value);
}

function matchesTags(ticketTags, selectedTags) {
  if (!selectedTags || selectedTags.length === 0) return true;
  if (!ticketTags || ticketTags.length === 0) return false;
  return ticketTags.some((tag) => selectedTags.includes(tag));
}

function matchesSearch(ticket, search) {
  if (!search) return true;
  const target = search.toLowerCase();
  return (
    String(ticket.id).toLowerCase().includes(target) ||
    (ticket.location?.barrio || '').toLowerCase().includes(target) ||
    (ticket.location?.zona || '').toLowerCase().includes(target)
  );
}

function withinBbox(location, bbox) {
  if (!bbox) return true;
  if (!location) return false;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return (
    location.lon >= minLon &&
    location.lon <= maxLon &&
    location.lat >= minLat &&
    location.lat <= maxLat
  );
}

function filterTickets(filters) {
  const dataset = getDataset();
  const { start, end } = normalizeRange(filters.from, filters.to);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const agentDirectory = new Map(dataset.agents.map((agent) => [agent.id, agent.name]));
  const tickets = dataset.tickets.filter((ticket) => {
    if (ticket.tenantId !== filters.tenantId) return false;
    const createdAt = new Date(ticket.createdAt).getTime();
    if (createdAt < startMs || createdAt > endMs) return false;
    if (!matchesFilter(ticket.canal, filters.canal)) return false;
    if (!matchesFilter(ticket.categoria, filters.categoria)) return false;
    if (!matchesFilter(ticket.estado, filters.estado)) return false;
    if (filters.agente && filters.agente.length) {
      const agentName = ticket.assignedTo ? agentDirectory.get(ticket.assignedTo) : 'Sin asignar';
      const matchesAgent = filters.agente.some((value) => {
        if (value === 'Sin asignar') {
          return !ticket.assignedTo;
        }
        if (!ticket.assignedTo) return false;
        return value === ticket.assignedTo || value === agentName;
      });
      if (!matchesAgent) return false;
    }
    if (!matchesFilter(ticket.location?.zona, filters.zona)) return false;
    if (!matchesTags(ticket.etiquetas, filters.etiquetas)) return false;
    if (!matchesSearch(ticket, filters.search)) return false;
    if (!withinBbox(ticket.location, filters.bbox)) return false;
    return true;
  });
  return { dataset, tickets, start, end };
}

function filterOrders(filters) {
  const dataset = getDataset();
  const { start, end } = normalizeRange(filters.from, filters.to);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const orders = dataset.orders.filter((order) => {
    if (order.tenantId !== filters.tenantId) return false;
    const createdAt = new Date(order.creadoEn).getTime();
    if (createdAt < startMs || createdAt > endMs) return false;
    if (!matchesFilter(order.canal, filters.canal)) return false;
    if (!matchesFilter(order.zona, filters.zona)) return false;
    if (!withinBbox({ lat: order.lat, lon: order.lon }, filters.bbox)) return false;
    return true;
  });
  return { dataset, orders, start, end };
}

function filterSurveys(filters) {
  const dataset = getDataset();
  const { start, end } = normalizeRange(filters.from, filters.to);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const surveys = dataset.surveys.filter((survey) => {
    if (survey.tenantId !== filters.tenantId) return false;
    const timestamp = new Date(survey.timestamp).getTime();
    if (timestamp < startMs || timestamp > endMs) return false;
    if (!matchesFilter(survey.type, filters.metric === 'nps' ? ['NPS'] : filters.metric === 'csat' ? ['CSAT'] : [])) {
      // Accept all if no specific metric requested
    }
    return true;
  });
  return { dataset, surveys };
}

function computeSlaBuckets(tickets) {
  const ackMinutes = [];
  const resolveMinutes = [];
  tickets.forEach((ticket) => {
    const createdAt = new Date(ticket.createdAt).getTime();
    if (ticket.firstResponseAt) {
      ackMinutes.push((new Date(ticket.firstResponseAt).getTime() - createdAt) / (1000 * 60));
    }
    if (ticket.closedAt) {
      resolveMinutes.push((new Date(ticket.closedAt).getTime() - createdAt) / (1000 * 60));
    }
  });
  const build = (values) => ({
    p50: clamp(percentile(values, 50), 0, Infinity),
    p90: clamp(percentile(values, 90), 0, Infinity),
    p95: clamp(percentile(values, 95), 0, Infinity),
  });
  return {
    ack: build(ackMinutes),
    resolve: build(resolveMinutes),
  };
}

function computeVolumeSeries(tickets) {
  const perDay = new Map();
  tickets.forEach((ticket) => {
    const date = formatDate(new Date(ticket.createdAt));
    if (!perDay.has(date)) perDay.set(date, 0);
    perDay.set(date, perDay.get(date) + 1);
  });
  return Array.from(perDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
}

function computeBreakdown(tickets, key) {
  const map = new Map();
  tickets.forEach((ticket) => {
    const label = key(ticket);
    if (!label) return;
    if (!map.has(label)) map.set(label, 0);
    map.set(label, map.get(label) + 1);
  });
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));
}

function computeQuality(tickets, surveys, dataset) {
  const byType = new Map();
  surveys.forEach((survey) => {
    const label = survey.type;
    if (!byType.has(label)) {
      byType.set(label, { total: 0, count: 0 });
    }
    const record = byType.get(label);
    record.total += survey.score;
    record.count += 1;
  });

  const byAgent = new Map();
  const surveyByTicket = new Map();
  surveys.forEach((survey) => {
    if (survey.ticketId) {
      surveyByTicket.set(survey.ticketId, survey);
    }
  });

  tickets.forEach((ticket) => {
    if (!ticket.assignedTo) return;
    const survey = surveyByTicket.get(ticket.id);
    if (!survey) return;
    if (!byAgent.has(ticket.assignedTo)) {
      byAgent.set(ticket.assignedTo, { total: 0, count: 0 });
    }
    const record = byAgent.get(ticket.assignedTo);
    record.total += survey.score;
    record.count += 1;
  });

  const agentById = new Map(dataset.agents.map((agent) => [agent.id, agent.name]));

  return {
    byType: Array.from(byType.entries()).map(([label, record]) => ({
      label,
      average: record.count ? Number((record.total / record.count).toFixed(2)) : 0,
      responses: record.count,
    })),
    byAgent: Array.from(byAgent.entries()).map(([agentId, record]) => ({
      label: agentById.get(agentId) || agentId,
      average: record.count ? Number((record.total / record.count).toFixed(2)) : 0,
      responses: record.count,
    })),
  };
}

function computePymeMetrics(filters) {
  const { orders, dataset } = filterOrders(filters);
  if (!orders.length) {
    return {
      totalOrders: 0,
      ticketMedio: 0,
      ingresos: [],
      topProductos: [],
      conversion: 0,
      recurrencia: { d30: 0, d60: 0, d90: 0 },
      horasPico: [],
      canales: [],
      plantillas: [],
    };
  }

  const ingresos = new Map();
  const productos = new Map();
  const canales = new Map();
  const horas = new Map();
  const ordersByCustomer = new Map();

  orders.forEach((order) => {
    const date = formatDate(new Date(order.creadoEn));
    ingresos.set(date, (ingresos.get(date) || 0) + order.total);
    canales.set(order.canal, (canales.get(order.canal) || 0) + 1);
    const hour = new Date(order.creadoEn).getHours();
    horas.set(hour, (horas.get(hour) || 0) + 1);
    if (order.clienteId) {
      if (!ordersByCustomer.has(order.clienteId)) {
        ordersByCustomer.set(order.clienteId, []);
      }
      ordersByCustomer.get(order.clienteId).push(new Date(order.creadoEn));
    }
    order.items.forEach((item) => {
      productos.set(item.sku, (productos.get(item.sku) || 0) + item.qty);
    });
  });

  const recurrencia = { d30: 0, d60: 0, d90: 0 };
  ordersByCustomer.forEach((dates) => {
    dates.sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    const counts = dates.length;
    if (counts < 2) return;
    const windows = [30, 60, 90];
    windows.forEach((days) => {
      const limit = new Date(first.getTime() + days * 24 * 60 * 60 * 1000);
      const inWindow = dates.filter((date) => date <= limit).length;
      if (inWindow >= 2) {
        if (days === 30) recurrencia.d30 += 1;
        if (days === 60) recurrencia.d60 += 1;
        if (days === 90) recurrencia.d90 += 1;
      }
    });
  });

  const totalOrders = orders.length;
  const conversionBase = dataset.tickets.filter((ticket) => ticket.tenantId === filters.tenantId).length;
  const conversion = conversionBase ? Number(((totalOrders / conversionBase) * 100).toFixed(2)) : 0;
  const plantillaStats = dataset.templateStats
    .filter((item) => item.tenantId === filters.tenantId)
    .map((item) => ({
      plantilla: item.plantilla,
      envios: item.envios,
      respuestas: item.respuestas,
      bloqueos: item.bloqueos,
      ctr: item.envios ? Number(((item.respuestas / item.envios) * 100).toFixed(2)) : 0,
    }));

  return {
    totalOrders,
    ticketMedio: Number((sum(orders.map((order) => order.total)) / totalOrders).toFixed(2)),
    ingresos: Array.from(ingresos.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, value]) => ({ date, value: Number(value.toFixed(2)) })),
    topProductos: Array.from(productos.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([sku, value]) => ({ label: sku, value })),
    conversion,
    recurrencia,
    horasPico: Array.from(horas.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, value]) => ({ hour, value })),
    canales: Array.from(canales.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, value]) => ({ label, value })),
    plantillas: plantillaStats,
  };
}

function getSummary(filters) {
  const { dataset, tickets } = filterTickets(filters);
  const { surveys } = filterSurveys(filters);
  const sla = computeSlaBuckets(tickets);
  const openTickets = tickets.filter((ticket) => !CLOSED_STATES.has(ticket.estado));
  const backlogThreshold = Date.now() - 72 * 60 * 60 * 1000;
  const backlog = openTickets.filter((ticket) => new Date(ticket.createdAt).getTime() < backlogThreshold).length;
  const adjuntos = sum(tickets.map((ticket) => ticket.adjuntosCount || 0));

  const efficiency = {
    firstContact: tickets.length
      ? Number(((tickets.filter((ticket) => ticket.firstContactResolved).length / tickets.length) * 100).toFixed(2))
      : 0,
    reopenRate: tickets.length
      ? Number(((tickets.filter((ticket) => ticket.reopened).length / tickets.length) * 100).toFixed(2))
      : 0,
    automationRate: tickets.length
      ? Number(((tickets.filter((ticket) => ticket.automated).length / tickets.length) * 100).toFixed(2))
      : 0,
  };

  const volume = {
    perDay: computeVolumeSeries(tickets),
    byChannel: computeBreakdown(tickets, (ticket) => ticket.canal),
    byCategory: computeBreakdown(tickets, (ticket) => ticket.categoria),
    byZone: computeBreakdown(tickets, (ticket) => ticket.location?.zona || 'Sin zona'),
  };

  const quality = computeQuality(tickets, surveys, dataset);
  const pyme = dataset.tenants.find((tenant) => tenant.id === filters.tenantId && tenant.type === 'pyme')
    ? computePymeMetrics(filters)
    : {
        totalOrders: 0,
        ticketMedio: 0,
        ingresos: [],
        topProductos: [],
        conversion: 0,
        recurrencia: { d30: 0, d60: 0, d90: 0 },
        horasPico: [],
        canales: [],
        plantillas: [],
      };

  return {
    generatedAt: new Date().toISOString(),
    tenantId: filters.tenantId,
    totals: {
      tickets: tickets.length,
      abiertos: openTickets.length,
      backlog,
      adjuntos,
    },
    sla,
    efficiency,
    volume,
    quality,
    pyme,
  };
}

function getTimeseries(filters) {
  const { tickets } = filterTickets(filters);
  const seriesMap = new Map();
  tickets.forEach((ticket) => {
    const date = formatDate(new Date(ticket.createdAt));
    if (!seriesMap.has(date)) {
      seriesMap.set(date, { value: 0, breakdown: {} });
    }
    const record = seriesMap.get(date);
    record.value += 1;
    if (filters.group) {
      const key = String(ticket[filters.group]) || 'Sin dato';
      record.breakdown[key] = (record.breakdown[key] || 0) + 1;
    }
  });
  return {
    metric: filters.metric,
    group: filters.group,
    series: Array.from(seriesMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, record]) => ({ date, value: record.value, breakdown: record.breakdown })),
  };
}

function getBreakdown(filters) {
  const { tickets, dataset } = filterTickets(filters);
  let dimensionGetter;
  switch (filters.dimension) {
    case 'categoria':
      dimensionGetter = (ticket) => ticket.categoria;
      break;
    case 'canal':
      dimensionGetter = (ticket) => ticket.canal;
      break;
    case 'estado':
      dimensionGetter = (ticket) => ticket.estado;
      break;
    case 'agente':
      dimensionGetter = (ticket) => dataset.agents.find((agent) => agent.id === ticket.assignedTo)?.name || 'Sin asignar';
      break;
    case 'zona':
      dimensionGetter = (ticket) => ticket.location?.zona || 'Sin zona';
      break;
    default:
      dimensionGetter = (ticket) => ticket[filters.dimension] || 'Sin dato';
  }
  return {
    dimension: filters.dimension,
    items: computeBreakdown(tickets, dimensionGetter),
  };
}

function getHeatmap(filters) {
  const { tickets } = filterTickets(filters);
  const cells = new Map();
  const breakdownByZone = new Map();
  const weeklyByZone = new Map();

  tickets.forEach((ticket) => {
    const cellId = ticket.location?.cellId || 'cell-desconocido';
    if (!cells.has(cellId)) {
      cells.set(cellId, {
        cellId,
        tenant_id: ticket.tenantId,
        count: 0,
        centroid_lat: ticket.location?.lat || 0,
        centroid_lon: ticket.location?.lon || 0,
        breakdown: {},
      });
    }
    const cell = cells.get(cellId);
    cell.count += 1;
    const category = ticket.categoria || 'Sin categoria';
    cell.breakdown[category] = (cell.breakdown[category] || 0) + 1;

    const zone = ticket.location?.zona || 'Sin zona';
    breakdownByZone.set(zone, (breakdownByZone.get(zone) || 0) + 1);

    const weekKey = `${zone}-${formatDate(new Date(ticket.createdAt))}`;
    weeklyByZone.set(weekKey, (weeklyByZone.get(weekKey) || 0) + 1);
  });

  const hotspots = Array.from(cells.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((cell) => ({
      cellId: cell.cellId,
      count: cell.count,
      centroid: [cell.centroid_lat, cell.centroid_lon],
      breakdown: cell.breakdown,
    }));

  const chronic = [];
  const zoneWeeks = groupBy(Array.from(weeklyByZone.entries()), ([key]) => key.split('-')[0]);
  zoneWeeks.forEach((entries, zone) => {
    const weeks = entries
      .map(([key, count]) => ({ week: key.split('-').slice(1).join('-'), count }))
      .sort((a, b) => (a.week < b.week ? -1 : 1));
    const chronicWeeks = weeks.filter((week) => week.count >= 3);
    if (chronicWeeks.length >= 4) {
      chronic.push({ zone, weeks: chronicWeeks });
    }
  });

  return {
    cells: Array.from(cells.values()),
    hotspots,
    chronic,
  };
}

function getPoints(filters) {
  const { tickets } = filterTickets(filters);
  const sample = tickets.slice(0, 250);
  return {
    points: sample.map((ticket) => ({
      cellId: ticket.location?.cellId || 'cell-desconocido',
      lat: ticket.location?.lat || 0,
      lon: ticket.location?.lon || 0,
      categoria: ticket.categoria,
      estado: ticket.estado,
    })),
  };
}

function getTop(filters) {
  const { tickets } = filterTickets(filters);
  if (filters.subject === 'zonas') {
    return {
      subject: 'zonas',
      items: computeBreakdown(tickets, (ticket) => ticket.location?.zona || 'Sin zona').slice(0, 20),
    };
  }
  if (filters.subject === 'barrios') {
    return {
      subject: 'barrios',
      items: computeBreakdown(tickets, (ticket) => ticket.location?.barrio || 'Sin barrio').slice(0, 20),
    };
  }
  return {
    subject: filters.subject,
    items: computeBreakdown(tickets, (ticket) => ticket[filters.subject] || 'Sin dato').slice(0, 20),
  };
}

function getOperations(filters) {
  const { dataset, tickets } = filterTickets(filters);
  const openTickets = tickets.filter((ticket) => !CLOSED_STATES.has(ticket.estado));
  const slaBreaches = openTickets.filter((ticket) => {
    const createdAt = new Date(ticket.createdAt).getTime();
    const firstResponse = ticket.firstResponseAt ? new Date(ticket.firstResponseAt).getTime() : null;
    const now = Date.now();
    const ackExceeded = firstResponse ? firstResponse - createdAt > 4 * 60 * 60 * 1000 : now - createdAt > 4 * 60 * 60 * 1000;
    const resolveExceeded = now - createdAt > 48 * 60 * 60 * 1000;
    return ackExceeded || resolveExceeded;
  }).length;

  const automated = openTickets.filter((ticket) => ticket.automated).length;
  const automationRate = openTickets.length ? Number(((automated / openTickets.length) * 100).toFixed(2)) : 0;

  const agingBuckets = {
    '0-4h': 0,
    '4-24h': 0,
    '1-3d': 0,
    '3-7d': 0,
    '+7d': 0,
  };
  const now = Date.now();
  openTickets.forEach((ticket) => {
    const ageHours = (now - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours <= 4) agingBuckets['0-4h'] += 1;
    else if (ageHours <= 24) agingBuckets['4-24h'] += 1;
    else if (ageHours <= 72) agingBuckets['1-3d'] += 1;
    else if (ageHours <= 168) agingBuckets['3-7d'] += 1;
    else agingBuckets['+7d'] += 1;
  });

  const agentStats = new Map();
  openTickets.forEach((ticket) => {
    const agentId = ticket.assignedTo || 'sin_asignar';
    if (!agentStats.has(agentId)) {
      agentStats.set(agentId, { abiertos: 0, tiempoTotal: 0, satisfaccion: [] });
    }
    const record = agentStats.get(agentId);
    record.abiertos += 1;
    record.tiempoTotal += now - new Date(ticket.createdAt).getTime();
  });

  const surveys = getDataset().surveys.filter((survey) => survey.tenantId === filters.tenantId);
  surveys.forEach((survey) => {
    const ticket = tickets.find((item) => item.id === survey.ticketId);
    if (!ticket || !ticket.assignedTo) return;
    const agentId = ticket.assignedTo;
    if (!agentStats.has(agentId)) {
      agentStats.set(agentId, { abiertos: 0, tiempoTotal: 0, satisfaccion: [] });
    }
    agentStats.get(agentId).satisfaccion.push(survey.score);
  });

  const agentDirectory = new Map(dataset.agents.map((agent) => [agent.id, agent.name]));

  const agents = Array.from(agentStats.entries()).map(([agentId, record]) => ({
    agente: agentDirectory.get(agentId) || agentId,
    abiertos: record.abiertos,
    tiempoMedio: record.abiertos
      ? Number((record.tiempoTotal / record.abiertos / (1000 * 60 * 60)).toFixed(2))
      : 0,
    satisfaccion: record.satisfaccion.length
      ? Number((average(record.satisfaccion)).toFixed(2))
      : 0,
  }));

  return {
    abiertos: openTickets.length,
    slaBreaches,
    automated,
    automationRate,
    agingBuckets,
    agents,
  };
}

function getCohorts(filters) {
  const { orders } = filterOrders(filters);
  const cohorts = new Map();
  const customers = new Map();
  orders.forEach((order) => {
    const month = formatDate(new Date(order.creadoEn)).slice(0, 7);
    if (!customers.has(order.clienteId)) {
      customers.set(order.clienteId, month);
    }
    const cohort = customers.get(order.clienteId);
    if (!cohorts.has(cohort)) {
      cohorts.set(cohort, { pedidos: 0, ingresos: 0 });
    }
    const record = cohorts.get(cohort);
    record.pedidos += 1;
    record.ingresos += order.total;
  });
  return {
    cohorts: Array.from(cohorts.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([cohort, data]) => ({ cohort, pedidos: data.pedidos, ingresos: Number(data.ingresos.toFixed(2)) })),
  };
}

function getTemplates(filters) {
  const dataset = getDataset();
  const templates = dataset.templateStats
    .filter((template) => template.tenantId === filters.tenantId)
    .map((template) => ({
      plantilla: template.plantilla,
      envios: template.envios,
      respuestas: template.respuestas,
      bloqueos: template.bloqueos,
      ctr: template.envios ? Number(((template.respuestas / template.envios) * 100).toFixed(2)) : 0,
    }));
  return { templates };
}

function getFilters(filters, req) {
  const dataset = getDataset();
  const tenant = dataset.tenants.find((item) => item.id === filters.tenantId);
  const tenantTickets = dataset.tickets.filter((ticket) => ticket.tenantId === filters.tenantId);
  return {
    canales: Array.from(new Set(tenantTickets.map((ticket) => ticket.canal))).sort(),
    categorias: Array.from(new Set(tenantTickets.map((ticket) => ticket.categoria))).sort(),
    estados: Array.from(new Set(tenantTickets.map((ticket) => ticket.estado))).sort(),
    agentes: (() => {
      const set = new Set(
        tenantTickets
          .map((ticket) => ticket.assignedTo)
          .filter(Boolean)
          .map((agentId) => dataset.agents.find((agent) => agent.id === agentId)?.name || agentId),
      );
      if (tenantTickets.some((ticket) => !ticket.assignedTo)) {
        set.add('Sin asignar');
      }
      return Array.from(set).sort();
    })(),
    zonas: Array.from(new Set(tenantTickets.map((ticket) => ticket.location?.zona).filter(Boolean))).sort(),
    etiquetas: Array.from(new Set(tenantTickets.flatMap((ticket) => ticket.etiquetas || []))).sort(),
    tenants: req.allowedTenants && req.allowedTenants.length ? req.allowedTenants : dataset.tenants.map((item) => item.id),
    defaultTenantId: req.defaultTenant || (tenant ? tenant.id : null),
    defaultContext: tenant?.type === 'pyme' ? 'pyme' : 'municipio',
    contexts: ['municipio', 'pyme', 'operaciones'],
  };
}

function getHealth() {
  const dataset = getDataset();
  return {
    generatedAt: dataset.generatedAt,
    totals: {
      tenants: dataset.tenants.length,
      tickets: dataset.tickets.length,
      orders: dataset.orders.length,
      surveys: dataset.surveys.length,
    },
  };
}

module.exports = {
  getSummary,
  getTimeseries,
  getBreakdown,
  getHeatmap,
  getPoints,
  getTop,
  getOperations,
  getCohorts,
  getTemplates,
  getFilters,
  getHealth,
};
