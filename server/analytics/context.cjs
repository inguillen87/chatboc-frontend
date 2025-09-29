const { normalizeRole } = require('./rbac.cjs');

function parseAllowedTenants(headerValue) {
  if (!headerValue) return [];
  return String(headerValue)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildContextFromHeaders(headers) {
  const roleHeader = headers['x-analytics-role'] || headers['x-role'];
  const allowedTenantsHeader =
    headers['x-analytics-tenant-ids'] || headers['x-tenant-ids'] || headers['x-allowed-tenants'];
  const defaultTenantHeader = headers['x-default-tenant'];

  const analyticsRole = normalizeRole(roleHeader);
  const allowedTenants = parseAllowedTenants(allowedTenantsHeader);
  const defaultTenant =
    defaultTenantHeader && typeof defaultTenantHeader === 'string'
      ? defaultTenantHeader
      : allowedTenants[0] || null;

  return { analyticsRole, allowedTenants, defaultTenant };
}

function ensureContext(req, res, next) {
  const context = buildContextFromHeaders(req.headers);
  req.analyticsRole = context.analyticsRole;
  req.allowedTenants = context.allowedTenants;
  req.defaultTenant = context.defaultTenant;
  next();
}

module.exports = {
  ensureContext,
  buildContextFromHeaders,
};
