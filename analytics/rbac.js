const ROLE_ORDER = {
  admin: 3,
  operador: 2,
  operator: 2,
  visor: 1,
  viewer: 1,
};

function resolveRole(session, headerRole) {
  const rawSessionRole = session?.analyticsRole;
  const candidate = headerRole || rawSessionRole || 'admin';
  const normalized = candidate.toString().trim().toLowerCase();
  return ROLE_ORDER[normalized] ? normalized : 'admin';
}

function ensureContext(session) {
  if (!session.analyticsContext) {
    session.analyticsContext = {
      role: 'admin',
      teams: ['global'],
      tenantIds: ['tenant-municipio-1'],
    };
  }
  return session.analyticsContext;
}

function authorize(role, requiredRole) {
  const currentLevel = ROLE_ORDER[role] || 0;
  const requiredLevel = ROLE_ORDER[requiredRole] || 0;
  return currentLevel >= requiredLevel;
}

function sanitizeForRole(role, payload) {
  if (ROLE_ORDER[role] >= ROLE_ORDER.admin) {
    return payload;
  }
  if (!payload || typeof payload !== 'object') return payload;
  const clone = JSON.parse(JSON.stringify(payload));
  if (Array.isArray(clone.points)) {
    clone.points = clone.points.map((p) => ({
      lat: Number(p.lat?.toFixed?.(5) ?? p.lat),
      lon: Number(p.lon?.toFixed?.(5) ?? p.lon),
      count: p.count,
      cellId: p.cellId,
    }));
  }
  if (Array.isArray(clone.cells)) {
    clone.cells = clone.cells.map((cell) => ({
      cellId: cell.cellId,
      count: cell.count,
      centroid: cell.centroid,
      breakdown: cell.breakdown,
    }));
  }
  if (Array.isArray(clone.series)) {
    clone.series = clone.series.map((entry) => ({
      date: entry.date,
      value: entry.value,
      breakdown: entry.breakdown,
    }));
  }
  return clone;
}

export { resolveRole, ensureContext, authorize, sanitizeForRole };
