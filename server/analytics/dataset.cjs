const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATASET_PATH = path.join(__dirname, 'data', 'seed.json');
fs.mkdirSync(path.dirname(DATASET_PATH), { recursive: true });

function mulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choice(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function weightedChoice(rng, entries) {
  const total = entries.reduce((acc, [, weight]) => acc + weight, 0);
  const target = rng() * total;
  let cursor = 0;
  for (const [value, weight] of entries) {
    cursor += weight;
    if (target <= cursor) return value;
  }
  return entries[entries.length - 1][0];
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function generateDataset() {
  const rng = mulberry32(42);

  const tenants = [
    {
      id: 'muni-centro',
      name: 'Municipio Centro',
      type: 'municipio',
      zones: ['Centro', 'Norte', 'Sur', 'Este', 'Oeste', 'Costanera', 'Industrial'],
      barrios: ['San Martín', 'Belgrano', 'Independencia', 'Mitre', 'Saavedra', 'Dorrego'],
    },
    {
      id: 'muni-sur',
      name: 'Municipio Sur',
      type: 'municipio',
      zones: ['Río', 'Colinas', 'Valle Verde', 'Puerto', 'Aeropuerto', 'Parque'],
      barrios: ['Amanecer', 'Bosques', 'Puente', 'Marítimo', 'Cordillera'],
    },
    {
      id: 'pyme-tienda',
      name: 'PyME Tienda Express',
      type: 'pyme',
      zones: ['Capital', 'Interior', 'Online', 'Noroeste', 'Litoral'],
      barrios: ['Comercial', 'Residencial', 'Oficinas', 'Mercado', 'Universidad'],
    },
  ];

  const agents = [
    { id: 'agente-1', name: 'Agente Norte', role: 'operador', team: 'General', tenantIds: ['muni-centro'] },
    { id: 'agente-2', name: 'Agente Sur', role: 'operador', team: 'General', tenantIds: ['muni-sur'] },
    { id: 'agente-3', name: 'Agente PyME', role: 'operador', team: 'Ventas', tenantIds: ['pyme-tienda'] },
    { id: 'agente-4', name: 'Super Admin', role: 'admin', team: 'Coordinación', tenantIds: tenants.map((t) => t.id) },
  ];

  const categories = [
    'Alumbrado',
    'Recolección',
    'Seguridad',
    'Transporte',
    'Salud',
    'Comercio',
    'Atención',
    'Pedidos',
    'Soporte',
  ];
  const states = ['abierto', 'en_progreso', 'derivado', 'resuelto', 'cerrado'];
  const channels = ['Whatsapp', 'Web', 'App', 'Presencial', 'Telefonico'];
  const severities = ['baja', 'media', 'alta'];
  const etiquetas = ['urgente', 'vip', 'reincidente', 'derivado_bot', 'prioridad'];

  const templateCatalog = [
    'whatsapp_aviso_envio',
    'whatsapp_confirmacion_pago',
    'whatsapp_recordatorio',
    'whatsapp_reengagement',
  ];

  const products = [
    { sku: 'sku-101', name: 'Kit PyME Básico', price: 23000 },
    { sku: 'sku-102', name: 'Kit PyME Premium', price: 43000 },
    { sku: 'sku-103', name: 'Servicio Mantenimiento', price: 12000 },
    { sku: 'sku-104', name: 'Consultoría Express', price: 16000 },
    { sku: 'sku-105', name: 'Licencia Chatbot', price: 8000 },
  ];

  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const tickets = [];
  const surveys = [];
  const orders = [];
  const templateStats = [];
  const customers = Array.from({ length: 180 }).map((_, index) => ({
    id: `cliente-${index + 1}`,
    segment: weightedChoice(rng, [
      ['nuevo', 1.6],
      ['recurrente', 1.2],
      ['premium', 0.6],
    ]),
    channelPreference: weightedChoice(rng, [
      ['Whatsapp', 2.5],
      ['Web', 1.5],
      ['App', 1],
    ]),
  }));

  const zoneCoordinates = new Map([
    ['Centro', { lat: -34.6037, lon: -58.3816 }],
    ['Norte', { lat: -34.5306, lon: -58.4799 }],
    ['Sur', { lat: -34.6815, lon: -58.3712 }],
    ['Este', { lat: -34.6032, lon: -58.3312 }],
    ['Oeste', { lat: -34.6045, lon: -58.4505 }],
    ['Costanera', { lat: -34.598, lon: -58.362 }],
    ['Industrial', { lat: -34.6905, lon: -58.4605 }],
    ['Río', { lat: -34.7001, lon: -58.3611 }],
    ['Colinas', { lat: -34.7204, lon: -58.4011 }],
    ['Valle Verde', { lat: -34.735, lon: -58.333 }],
    ['Puerto', { lat: -34.7033, lon: -58.3201 }],
    ['Aeropuerto', { lat: -34.8105, lon: -58.5315 }],
    ['Parque', { lat: -34.7502, lon: -58.4201 }],
    ['Capital', { lat: -34.6037, lon: -58.3816 }],
    ['Interior', { lat: -32.8895, lon: -68.8458 }],
    ['Online', { lat: -34.5201, lon: -58.7001 }],
    ['Noroeste', { lat: -24.7893, lon: -65.4106 }],
    ['Litoral', { lat: -27.4515, lon: -58.9865 }],
  ]);

  function randomDateWithin() {
    const offset = rng() * ninetyDaysMs;
    return new Date(now - offset);
  }

  function randomCellId(zone) {
    const coord = zoneCoordinates.get(zone) || { lat: -34.6, lon: -58.4 };
    const latBucket = Math.round(coord.lat * 100);
    const lonBucket = Math.round(coord.lon * 100);
    return `h3-${zone}-${latBucket}-${lonBucket}`;
  }

  for (let i = 0; i < 6000; i += 1) {
    const tenant = choice(rng, tenants);
    const createdAt = randomDateWithin();
    const responseMinutes = Math.floor(rng() * 360);
    const resolvedMinutes = responseMinutes + Math.floor(rng() * 720);
    const firstResponseAt = new Date(createdAt.getTime() + responseMinutes * 60 * 1000);
    const closedAt = new Date(createdAt.getTime() + resolvedMinutes * 60 * 1000);
    const zone = choice(rng, tenant.zones);
    const barrio = choice(rng, tenant.barrios);
    const coords = zoneCoordinates.get(zone) || { lat: -34.6 + rng() * 0.1, lon: -58.4 + rng() * 0.1 };
    const estado = weightedChoice(rng, [
      ['abierto', 1],
      ['en_progreso', 2],
      ['derivado', 1.5],
      ['resuelto', 3],
      ['cerrado', 2.5],
    ]);
    const isClosed = ['resuelto', 'cerrado'].includes(estado);
    const attachments = Math.floor(rng() * 4);
    const assigned = choice(rng, agents.filter((agent) => agent.tenantIds.includes(tenant.id)));
    const automated = rng() < (tenant.type === 'pyme' ? 0.35 : 0.25);
    const reopenedTimes = rng() < 0.12 ? Math.floor(rng() * 3) : 0;
    const firstContactResolved = rng() < 0.68;

    const ticket = {
      id: `ticket-${i}-${randomUUID().slice(0, 8)}`,
      tenantId: tenant.id,
      canal: choice(rng, channels),
      categoria: choice(rng, categories),
      subcategoria: choice(rng, categories),
      estado,
      severidad: choice(rng, severities),
      createdAt: createdAt.toISOString(),
      firstResponseAt: firstResponseAt.toISOString(),
      closedAt: isClosed ? closedAt.toISOString() : null,
      location: {
        lat: round(coords.lat + (rng() - 0.5) * 0.02, 6),
        lon: round(coords.lon + (rng() - 0.5) * 0.02, 6),
        barrio,
        zona: zone,
        cellId: randomCellId(zone),
      },
      source: automated ? 'bot' : 'humano',
      adjuntosCount: attachments,
      etiquetas: etiquetas.filter(() => rng() < 0.2),
      assignedTo: assigned?.id || null,
      pymeId: tenant.type === 'pyme' ? tenant.id : null,
      reopened: reopenedTimes > 0,
      reopenCount: reopenedTimes,
      automated,
      firstContactResolved,
    };

    tickets.push(ticket);

    const satisfactionType = tenant.type === 'pyme' ? 'NPS' : 'CSAT';
    const scoreBase = tenant.type === 'pyme' ? 6 + Math.floor(rng() * 5) : 3 + Math.floor(rng() * 3);
    if (rng() < 0.65) {
      surveys.push({
        id: `survey-${i}-${randomUUID().slice(0, 6)}`,
        tenantId: tenant.id,
        ticketId: ticket.id,
        type: satisfactionType,
        score: Math.min(satisfactionType === 'NPS' ? 10 : 5, Math.max(0, scoreBase + Math.floor(rng() * 3) - 1)),
        comentario: rng() < 0.2 ? 'Comentario generado automáticamente' : null,
        timestamp: new Date(createdAt.getTime() + (rng() * resolvedMinutes) * 60 * 1000).toISOString(),
      });
    }

    if (tenant.type === 'pyme') {
      const hasOrder = rng() < 0.7;
      if (hasOrder) {
        const orderItems = Array.from({ length: 1 + Math.floor(rng() * 3) }).map(() => {
          const product = choice(rng, products);
          const qty = 1 + Math.floor(rng() * 3);
          return { sku: product.sku, qty, price: product.price };
        });
        const total = orderItems.reduce((sum, item) => sum + item.qty * item.price, 0);
        const orderId = `order-${i}-${randomUUID().slice(0, 6)}`;
        const customer = choice(rng, customers);
        orders.push({
          id: orderId,
          tenantId: tenant.id,
          items: orderItems,
          total,
          estado: weightedChoice(rng, [
            ['nuevo', 1.5],
            ['en_proceso', 2],
            ['enviado', 1.8],
            ['entregado', 2.5],
            ['cancelado', 0.3],
          ]),
          canal: weightedChoice(rng, [
            ['Whatsapp', 2.8],
            ['Web', 1.5],
            ['App', 0.9],
            ['Presencial', 0.8],
          ]),
          creadoEn: createdAt.toISOString(),
          zona: zone,
          lat: ticket.location.lat,
          lon: ticket.location.lon,
          plantillaWhatsApp: choice(rng, templateCatalog),
          clienteId: customer.id,
          clienteSegmento: customer.segment,
        });
      }
    }
  }

  const templatesByTenant = new Map();
  orders.forEach((order) => {
    const key = `${order.tenantId}:${order.plantillaWhatsApp}`;
    if (!templatesByTenant.has(key)) {
      templatesByTenant.set(key, {
        tenantId: order.tenantId,
        plantilla: order.plantillaWhatsApp,
        envios: 0,
        entregas: 0,
        lecturas: 0,
        respuestas: 0,
        bloqueos: 0,
      });
    }
    const entry = templatesByTenant.get(key);
    entry.envios += 1;
    entry.entregas += 1;
    entry.lecturas += Math.floor(0.8 * entry.envios + rng() * 5);
    entry.respuestas += Math.floor(0.45 * entry.envios + rng() * 3);
    entry.bloqueos += rng() < 0.05 ? 1 : 0;
  });

  templateCatalog.forEach((tpl) => {
    tenants
      .filter((tenant) => tenant.type === 'pyme')
      .forEach((tenant) => {
        const key = `${tenant.id}:${tpl}`;
        if (!templatesByTenant.has(key)) {
          templatesByTenant.set(key, {
            tenantId: tenant.id,
            plantilla: tpl,
            envios: 5,
            entregas: 4,
            lecturas: 3,
            respuestas: 1,
            bloqueos: 0,
          });
        }
      });
  });

  templateStats.push(...templatesByTenant.values());

  const dataset = {
    generatedAt: new Date().toISOString(),
    tenants,
    agents,
    categories,
    states,
    channels,
    tickets,
    surveys,
    orders,
    templateStats,
    customers,
  };

  fs.writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2));
  return dataset;
}

function loadDataset() {
  if (fs.existsSync(DATASET_PATH)) {
    try {
      const raw = fs.readFileSync(DATASET_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.tickets && parsed.orders) {
        return parsed;
      }
    } catch (error) {
      console.warn('[analytics] No se pudo leer el dataset, regenerando', error);
    }
  }
  return generateDataset();
}

let dataset = loadDataset();

function refreshDataset() {
  dataset = generateDataset();
  return dataset;
}

function getDataset() {
  return dataset;
}

module.exports = {
  getDataset,
  refreshDataset,
  DATASET_PATH,
};
