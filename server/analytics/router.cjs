const { parseFilters } = require('./schema.cjs');
const { authorize } = require('./rbac.cjs');
const { cache } = require('./cache.cjs');
const {
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
} = require('./resolvers.cjs');

function trackRequest(durationMs, context = {}) {
  const payload = { durationMs, ...context };
  if (durationMs > 3000) {
    console.warn('[analytics] Request slow', payload);
  } else {
    console.log('[analytics] Request', payload);
  }
}

function trackError(error, context = {}) {
  console.error('[analytics] Error', { message: error.message, stack: error.stack, ...context });
}

function buildCacheKey(filters, role) {
  return JSON.stringify({ filters: { ...filters, from: filters.from.toISOString(), to: filters.to.toISOString() }, role });
}

function sanitizeForRole(role, payload) {
  if (role === 'admin') return payload;
  return payload;
}

function canAccessTenant(req, tenantId) {
  if (!tenantId) return false;
  if (req.analyticsRole === 'admin') return true;

  const allowedTenants = Array.isArray(req.allowedTenants) ? req.allowedTenants : [];
  if (allowedTenants.length > 0) {
    return allowedTenants.includes(tenantId);
  }

  if (req.defaultTenant) {
    return req.defaultTenant === tenantId;
  }

  return false;
}

function createHandler({ requiredRole = 'visor', resolver }) {
  return async (req) => {
    const start = Date.now();
    let filters;
    try {
      filters = parseFilters(req);
    } catch (error) {
      trackError(error, { stage: 'parseFilters', path: req.path });
      return { status: 400, body: { message: error.message } };
    }

    const role = req.analyticsRole;
    if (!authorize(role, requiredRole)) {
      return { status: 403, body: { message: 'Permiso insuficiente' } };
    }

    if (!canAccessTenant(req, filters.tenantId)) {
      return { status: 403, body: { message: 'El tenant solicitado no está autorizado para esta sesión' } };
    }

    const cacheKey = buildCacheKey(filters, role);
    const cached = cache.get(cacheKey);
    if (cached) {
      trackRequest(Date.now() - start, { cacheHit: true, endpoint: req.path });
      return { status: 200, body: cached };
    }

    try {
      const payload = await resolver(filters, req);
      const sanitized = sanitizeForRole(role, payload);
      cache.set(cacheKey, sanitized);
      trackRequest(Date.now() - start, { endpoint: req.path });
      return { status: 200, body: sanitized };
    } catch (error) {
      trackError(error, { endpoint: req.path });
      return { status: 500, body: { message: 'Error interno en el módulo de analítica' } };
    }
  };
}

const routes = new Map();

function register(path, options) {
  routes.set(path, createHandler(options));
}

register('/summary', { resolver: getSummary });
register('/timeseries', { resolver: getTimeseries });
register('/breakdown', { resolver: getBreakdown });
register('/geo/heatmap', { resolver: getHeatmap });
register('/geo/points', { resolver: getPoints });
register('/top', { resolver: getTop });
register('/operations', { requiredRole: 'operador', resolver: getOperations });
register('/cohorts', { requiredRole: 'operador', resolver: getCohorts });
register('/whatsapp/templates', { requiredRole: 'operador', resolver: getTemplates });
register('/filters', { resolver: getFilters });

async function dispatch(req) {
  const handler = routes.get(req.path);
  if (!handler) {
    if (req.path === '/health') {
      try {
        const payload = getHealth();
        return { status: 200, body: { status: 'ok', ...payload } };
      } catch (error) {
        trackError(error, { endpoint: '/analytics/health' });
        return { status: 500, body: { status: 'error', message: error.message } };
      }
    }
    return { status: 404, body: { message: 'No se encontró el recurso solicitado' } };
  }
  return handler(req);
}

module.exports = {
  dispatch,
  canAccessTenant,
  createHandler,
};
