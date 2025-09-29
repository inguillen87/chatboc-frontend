const { normalizeRole } = require('./rbac.cjs');

function parseDate(value, field) {
  if (!value) throw new Error(`Falta el parámetro obligatorio ${field}`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`El parámetro ${field} no tiene un formato de fecha válido`);
  }
  return date;
}

function parseStringArray(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBbox(value) {
  if (!value) return null;
  const parts = String(value)
    .split(',')
    .map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    throw new Error('El parámetro bbox debe incluir cuatro números (minLon,minLat,maxLon,maxLat)');
  }
  return parts;
}

function parseFilters(req) {
  const { query } = req;
  const tenantId = query.tenant_id || query.tenantId;
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('El parámetro tenant_id es obligatorio');
  }
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (to.getTime() < from.getTime()) {
    throw new Error('El rango de fechas es inválido: to debe ser mayor o igual a from');
  }

  return {
    tenantId,
    from,
    to,
    canal: parseStringArray(query.canal),
    categoria: parseStringArray(query.categoria),
    estado: parseStringArray(query.estado),
    agente: parseStringArray(query.agente),
    zona: parseStringArray(query.zona),
    etiquetas: parseStringArray(query.etiquetas),
    metric: query.metric ? String(query.metric) : 'tickets_total',
    group: query.group ? String(query.group) : null,
    dimension: query.dimension ? String(query.dimension) : 'categoria',
    subject: query.subject ? String(query.subject) : 'zonas',
    bbox: parseBbox(query.bbox),
    context: query.context ? String(query.context) : null,
    search: query.search ? String(query.search) : null,
    role: normalizeRole(req.analyticsRole),
  };
}

module.exports = {
  parseFilters,
};
