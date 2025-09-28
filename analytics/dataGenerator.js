import { trackJobRun } from './observability.js';

function createRandom(seed = 42) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function pick(rand, array) {
  return array[Math.floor(rand() * array.length)];
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildGeoCell(lat, lon, resolution = 0.02) {
  const row = Math.round(lat / resolution);
  const col = Math.round(lon / resolution);
  return `cell-${resolution}-${row}-${col}`;
}

function generateDataset({ tenants, days = 180, seed = 42 } = {}) {
  const start = Date.now();
  const rand = createRandom(seed);
  const tenantDefinitions =
    tenants && tenants.length
      ? tenants
      : [
          { id: 'tenant-municipio-1', type: 'municipio' },
          { id: 'tenant-municipio-2', type: 'municipio' },
          { id: 'tenant-pyme-1', type: 'pyme' },
          { id: 'tenant-pyme-2', type: 'pyme' },
        ];

  const categoriesMunicipio = ['iluminacion', 'limpieza', 'calles', 'seguridad', 'espacio-publico'];
  const categoriesPyme = ['soporte', 'ventas', 'logistica', 'posventa'];
  const canales = ['whatsapp', 'web', 'email', 'presencial'];
  const estados = ['abierto', 'en_proceso', 'resuelto', 'backlog'];
  const severidades = ['baja', 'media', 'alta'];
  const zonas = ['zona-norte', 'zona-sur', 'zona-centro', 'zona-oeste'];
  const etiquetas = ['prioritario', 'seguimiento', 'automatizado', 'manual'];
  const productos = Array.from({ length: 30 }, (_, i) => `producto-${i + 1}`);
  const servicios = Array.from({ length: 10 }, (_, i) => `servicio-${i + 1}`);
  const plantillas = ['bienvenida', 'seguimiento', 'recordatorio', 'promocion'];

  const tickets = [];
  const interactions = [];
  const orders = [];
  const surveys = [];
  const agents = [];
  const geoCells = new Map();

  tenantDefinitions.forEach((tenant, tenantIdx) => {
    const agentCount = tenant.type === 'municipio' ? 15 : 10;
    for (let a = 0; a < agentCount; a += 1) {
      const id = `${tenant.id}-agent-${a + 1}`;
      agents.push({
        id,
        tenant_id: tenant.id,
        nombre: `Agente ${tenantIdx + 1}-${a + 1}`,
        rol: a === 0 ? 'admin' : a < 5 ? 'operador' : 'visor',
        equipo: a % 3 === 0 ? 'equipo-a' : a % 3 === 1 ? 'equipo-b' : 'equipo-c',
      });
    }
  });

  const now = Date.now();
  const startDay = now - days * 24 * 60 * 60 * 1000;

  let ticketAutoId = 1;
  let interactionAutoId = 1;
  let orderAutoId = 1;
  let surveyAutoId = 1;

  tenantDefinitions.forEach((tenant) => {
    const dailyBase = tenant.type === 'municipio' ? 180 : 120;
    for (let day = 0; day < days; day += 1) {
      const dayStart = startDay + day * 24 * 60 * 60 * 1000;
      const volumeMultiplier = 0.6 + rand() * 0.8;
      const ticketCount = Math.floor(dailyBase * volumeMultiplier);
      for (let i = 0; i < ticketCount; i += 1) {
        const createdAt = new Date(dayStart + rand() * 24 * 60 * 60 * 1000);
        const categoria =
          tenant.type === 'municipio'
            ? pick(rand, categoriesMunicipio)
            : pick(rand, categoriesPyme);
        const estado = pick(rand, estados);
        const canal = pick(rand, canales);
        const assignedAgent = pick(rand, agents.filter((agent) => agent.tenant_id === tenant.id));
        const latBase = tenant.type === 'municipio' ? -34.6 : -34.45;
        const lonBase = tenant.type === 'municipio' ? -58.45 : -58.55;
        const lat = round(latBase + (rand() - 0.5) * 0.3, 6);
        const lon = round(lonBase + (rand() - 0.5) * 0.3, 6);
        const barrio = pick(rand, zonas);
        const zona = pick(rand, zonas);
        const cellId = buildGeoCell(lat, lon, 0.015 + rand() * 0.01);
        const origin = rand() > 0.4 ? 'bot' : 'humano';
        const firstResponseMinutes = Math.floor(rand() * 8 * 60);
        const resolutionMinutes = Math.floor(firstResponseMinutes + rand() * 48 * 60);
        const primerRespuesta = new Date(createdAt.getTime() + firstResponseMinutes * 60 * 1000);
        const cerradoEn =
          estado === 'resuelto'
            ? new Date(createdAt.getTime() + resolutionMinutes * 60 * 1000)
            : null;
        const ticketId = `T-${tenant.id}-${ticketAutoId}`;

        const ticket = {
          id: ticketId,
          tenant_id: tenant.id,
          canal,
          categoria,
          subcategoria: `${categoria}-sub-${Math.ceil(rand() * 3)}`,
          estado,
          severidad: pick(rand, severidades),
          creado_en: createdAt.toISOString(),
          primer_respuesta_en: primerRespuesta.toISOString(),
          cerrado_en: cerradoEn ? cerradoEn.toISOString() : null,
          ubicacion: {
            lat,
            lon,
            barrio,
            zona,
            cell_id: cellId,
          },
          origen: origin,
          adjuntos_count: Math.floor(rand() * 4),
          etiquetas: etiquetas.filter(() => rand() > 0.6),
          asignado_a: assignedAgent?.id || null,
          pyme_id: tenant.type === 'pyme' ? `${tenant.id}-cliente-${Math.ceil(rand() * 200)}` : null,
          canal_origen: origin,
          sla_breach: rand() > 0.82,
          reapertura: rand() > 0.88,
          automatizado: origin === 'bot' && rand() > 0.3,
        };
        tickets.push(ticket);
        ticketAutoId += 1;

        const geoKey = `${tenant.id}-${ticket.ubicacion.cell_id}`;
        const geoEntry = geoCells.get(geoKey) || {
          tenant_id: tenant.id,
          cell_id: ticket.ubicacion.cell_id,
          lat,
          lon,
          count: 0,
          categories: {},
        };
        geoEntry.count += 1;
        geoEntry.categories[categoria] = (geoEntry.categories[categoria] || 0) + 1;
        geoCells.set(geoKey, geoEntry);

        const interactionCount = 2 + Math.floor(rand() * 4);
        for (let j = 0; j < interactionCount; j += 1) {
          const timestamp = new Date(createdAt.getTime() + j * 30 * 60 * 1000 + rand() * 10 * 60 * 1000);
          const tipo = j === 0 ? 'mensaje' : rand() > 0.7 ? 'plantilla' : 'mensaje';
          const canalInteraccion = canal;
          const actor = j === 0 ? 'usuario' : rand() > 0.5 ? 'agente' : 'bot';
          const plantilla = tipo === 'plantilla' ? pick(rand, plantillas) : null;
          interactions.push({
            id: interactionAutoId,
            ticket_id: ticket.id,
            tipo,
            canal: canalInteraccion,
            timestamp: timestamp.toISOString(),
            actor,
            plantilla,
            tenant_id: tenant.id,
          });
          interactionAutoId += 1;
        }

        if (tenant.type === 'pyme') {
          const includeOrder = rand() > 0.35;
          if (includeOrder) {
            const itemCount = 1 + Math.floor(rand() * 4);
            const items = Array.from({ length: itemCount }, () => {
              const sku = pick(rand, productos.concat(servicios));
              const qty = 1 + Math.floor(rand() * 5);
              const price = 5000 + rand() * 45000;
              return { sku, qty, precio: round(price, 2) };
            });
            const total = round(items.reduce((acc, item) => acc + item.qty * item.precio, 0), 2);
            orders.push({
              id: `O-${tenant.id}-${orderAutoId}`,
              tenant_id: tenant.id,
              items,
              total,
              estado: pick(rand, ['nuevo', 'pagado', 'cancelado', 'en_proceso']),
              canal,
              creado_en: createdAt.toISOString(),
              ubicacion: { lat, lon, barrio, zona },
              ticket_id: ticket.id,
            });
            orderAutoId += 1;
          }
        }

        if (rand() > 0.6) {
          const tipoEncuesta = rand() > 0.5 ? 'CSAT' : 'NPS';
          const score = tipoEncuesta === 'CSAT' ? 1 + Math.floor(rand() * 5) : Math.floor(rand() * 11) - 1;
          surveys.push({
            id: `S-${surveyAutoId}`,
            tenant_id: tenant.id,
            ticket_id: ticket.id,
            tipo: tipoEncuesta,
            score,
            comentario: rand() > 0.7 ? `retro-${Math.floor(rand() * 1000)}` : null,
            timestamp: new Date(createdAt.getTime() + rand() * 3 * 24 * 60 * 60 * 1000).toISOString(),
          });
          surveyAutoId += 1;
        }
      }
    }
  });

  const duration = Date.now() - start;
  trackJobRun('analytics-seed', duration);
  return {
    generatedAt: new Date().toISOString(),
    tickets,
    interactions,
    orders,
    surveys,
    agents,
    geoCells: Array.from(geoCells.values()),
    tenants: tenantDefinitions,
  };
}

export { generateDataset };
