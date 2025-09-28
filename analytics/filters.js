import { parse } from 'url';

function parseDate(value, fallback) {
  if (!value) return fallback;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp);
}

function parseArrayParam(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBBox(value) {
  if (!value) return null;
  const parts = value.split(',').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  return {
    minLng: Math.min(parts[0], parts[2]),
    minLat: Math.min(parts[1], parts[3]),
    maxLng: Math.max(parts[0], parts[2]),
    maxLat: Math.max(parts[1], parts[3]),
  };
}

function parseFilters(req) {
  const url = parse(req.url, true);
  const query = url.query || {};
  const now = new Date();
  const from = parseDate(query.from, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  const to = parseDate(query.to, now);
  const tenantId = (query.tenant_id || '').toString().trim();
  const context = (query.context || query.view || '').toString().trim() || null;

  const filters = {
    tenantId,
    from,
    to,
    context,
    canal: parseArrayParam(query.canal),
    categoria: parseArrayParam(query.categoria || query.rubro),
    estado: parseArrayParam(query.estado),
    agente: parseArrayParam(query.agente),
    zona: parseArrayParam(query.zona || query.barrio),
    etiquetas: parseArrayParam(query.etiquetas),
    rubro: parseArrayParam(query.rubro),
    pyme: parseArrayParam(query.pyme),
    bbox: parseBBox(query.bbox),
    search: (query.search || '').toString().trim() || null,
    metric: (query.metric || '').toString().trim() || 'tickets_total',
    group: (query.group || '').toString().trim() || null,
    dimension: (query.dimension || '').toString().trim() || 'categoria',
    subject: (query.subject || '').toString().trim() || 'zonas',
  };

  if (!filters.tenantId) {
    throw new Error('tenant_id es obligatorio');
  }

  return filters;
}

export { parseFilters };
