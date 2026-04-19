export type Role =
  | 'superadmin'
  | 'super_admin'
  | 'tenant_admin'
  | 'admin'
  | 'employee'
  | 'agent'
  | 'empleado'
  | 'catalog_manager'
  | 'analytics_viewer'
  | 'end_user'
  | 'chat_user'
  | 'user'
  | '';

const ROLE_EQUIVALENCE: Record<string, string[]> = {
  superadmin: ['superadmin', 'super_admin'],
  tenant_admin: ['tenant_admin', 'admin', 'admin_pyme'],
  employee: ['employee', 'agent', 'empleado'],
  catalog_manager: ['catalog_manager'],
  analytics_viewer: ['analytics_viewer'],
  end_user: ['end_user', 'chat_user', 'user', 'usuario'],
};

const normalizeRoleToken = (role?: string | null): string => (role || '').trim().toLowerCase();

const getRoleAliases = (role?: string | null): string[] => {
  const token = normalizeRoleToken(role);
  if (!token) return [];

  const canonical = Object.entries(ROLE_EQUIVALENCE).find(([, aliases]) => aliases.includes(token));
  if (!canonical) return [token];

  const [canonicalRole, aliases] = canonical;
  return Array.from(new Set([canonicalRole, ...aliases]));
};

export function normalizeRole(role?: string | null): Role {
  const token = normalizeRoleToken(role);
  if (token === 'admin') return 'admin';
  if (token === 'empleado') return 'empleado';

  const aliases = getRoleAliases(role);
  // Preserve legacy outputs expected by existing UI filters/components.
  if (aliases.includes('superadmin')) return 'super_admin';
  if (aliases.includes('tenant_admin')) return 'tenant_admin';
  if (aliases.includes('employee')) return 'empleado';
  if (aliases.includes('catalog_manager')) return 'catalog_manager';
  if (aliases.includes('analytics_viewer')) return 'analytics_viewer';
  if (aliases.includes('end_user')) return 'end_user';
  return '' as Role;
}

export function hasRequiredRole(userRole: string | null | undefined, allowedRoles: string[]): boolean {
  const userAliases = new Set(getRoleAliases(userRole));
  if (userAliases.size === 0) return false;

  return allowedRoles.some((allowedRole) => {
    const allowedAliases = getRoleAliases(allowedRole);
    return allowedAliases.some((alias) => userAliases.has(alias));
  });
}

export function isBackofficeRole(role: string | null | undefined): boolean {
  return hasRequiredRole(role, ['superadmin', 'tenant_admin', 'employee']);
}
