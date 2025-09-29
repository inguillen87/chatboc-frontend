const ROLE_HIERARCHY = ['visor', 'operador', 'admin'];

function normalizeRole(role) {
  if (!role) return 'visor';
  const normalized = String(role).toLowerCase();
  if (ROLE_HIERARCHY.includes(normalized)) return normalized;
  return 'visor';
}

function authorize(role, requiredRole) {
  const normalizedRole = normalizeRole(role);
  const normalizedRequired = normalizeRole(requiredRole);
  return ROLE_HIERARCHY.indexOf(normalizedRole) >= ROLE_HIERARCHY.indexOf(normalizedRequired);
}

module.exports = {
  ROLE_HIERARCHY,
  normalizeRole,
  authorize,
};
