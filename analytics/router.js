import express from 'express';
import cache from './cache.js';
import {
  dataset,
  summary,
  filterTickets,
  filterInteractions,
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
} from './store.js';
import { parseFilters } from './filters.js';
import { resolveRole, ensureContext, authorize, sanitizeForRole } from './rbac.js';
import { trackRequest, trackError, getHealthSnapshot } from './observability.js';

const router = express.Router();

const FEATURE_ENABLED =
  process.env.ANALYTICS_ENABLED === undefined || process.env.ANALYTICS_ENABLED !== 'false';

router.use((req, res, next) => {
  if (!FEATURE_ENABLED) {
    res.status(503).json({ message: 'Analytics module disabled' });
    return;
  }
  next();
});

router.use((req, res, next) => {
  ensureContext(req.session);
  const headerRole = req.headers['x-analytics-role'];
  const role = resolveRole(req.session, headerRole);
  req.analyticsRole = role;
  req.analyticsContext = req.session.analyticsContext;
  req.session.analyticsRole = role;
  next();
});

function buildCacheKey(req, role) {
  const sortedEntries = Object.entries(req.query || {})
    .filter(([key]) => key !== '_')
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const queryString = sortedEntries.map(([key, value]) => `${key}=${value}`).join('&');
  return `${role}:${req.path}?${queryString}`;
}

function handleRequest({ requiredRole = 'visor', resolver }) {
  return async (req, res) => {
    const start = Date.now();
    let filters;
    try {
      filters = parseFilters(req);
    } catch (error) {
      trackError();
      res.status(400).json({ message: error.message });
      return;
    }

    const role = req.analyticsRole;
    if (!authorize(role, requiredRole)) {
      res.status(403).json({ message: 'Permiso insuficiente' });
      return;
    }

    const cacheKey = buildCacheKey(req, role);
    const cached = cache.get(cacheKey);
    if (cached) {
      trackRequest(Date.now() - start, { cacheHit: true });
      res.json(cached);
      return;
    }

    try {
      const payload = await resolver(filters, req);
      const sanitized = sanitizeForRole(role, payload);
      cache.set(cacheKey, sanitized);
      trackRequest(Date.now() - start, { cacheHit: false });
      res.json(sanitized);
    } catch (error) {
      trackError();
      res.status(500).json({ message: 'Error interno', details: error.message });
    }
  };
}

router.get(
  '/summary',
  handleRequest({
    requiredRole: 'visor',
    resolver: (filters) => summary(filters),
  }),
);

router.get(
  '/timeseries',
  handleRequest({
    requiredRole: 'visor',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      return {
        metric: filters.metric,
        group: filters.group,
        series: computeTimeseries(tickets, filters.metric, filters.group),
      };
    },
  }),
);

router.get(
  '/breakdown',
  handleRequest({
    requiredRole: 'visor',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      return {
        dimension: filters.dimension,
        items: computeBreakdown(tickets, filters.dimension),
      };
    },
  }),
);

router.get(
  '/geo/heatmap',
  handleRequest({
    requiredRole: 'visor',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      return {
        cells: computeHeatmap(tickets),
        hotspots: computeHotspots(tickets),
        chronic: computeChronic(tickets),
      };
    },
  }),
);

router.get(
  '/geo/points',
  handleRequest({
    requiredRole: 'operador',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      return {
        points: computePoints(tickets, 1000),
      };
    },
  }),
);

router.get(
  '/top',
  handleRequest({
    requiredRole: 'visor',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      return {
        subject: filters.subject,
        items: computeTop(tickets, filters.subject),
      };
    },
  }),
);

router.get(
  '/operations',
  handleRequest({
    requiredRole: 'operador',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      return computeOperations(tickets);
    },
  }),
);

router.get(
  '/cohorts',
  handleRequest({
    requiredRole: 'visor',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      const ticketIds = new Set(tickets.map((ticket) => ticket.id));
      const relevantOrders = dataset.orders.filter(
        (order) => order.tenant_id === filters.tenantId && ticketIds.has(order.ticket_id),
      );
      return {
        cohorts: computeCohorts(relevantOrders),
      };
    },
  }),
);

router.get(
  '/whatsapp/templates',
  handleRequest({
    requiredRole: 'operador',
    resolver: (filters) => {
      const tickets = filterTickets(filters);
      const interactions = filterInteractions(filters, tickets);
      const metrics = computePymeMetrics([], tickets, interactions);
      return { templates: metrics.plantillas };
    },
  }),
);

router.get(
  '/filters',
  handleRequest({
    requiredRole: 'visor',
    resolver: (filters) => getFiltersCatalog(filters.tenantId),
  }),
);

router.get('/internal/health', (req, res) => {
  const snapshot = getHealthSnapshot(cache.stats());
  res.json(snapshot);
});

export default router;
