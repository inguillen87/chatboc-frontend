export type Role =
  | 'superadmin'
  | 'super_admin'
  | 'admin_super'
  | 'tenant_admin'
  | 'tenant-admin'
  | 'tenant_owner'
  | 'tenant-owner'
  | 'owner'
  | 'propietario'
  | 'administrador'
  | 'admin_tenant'
  | 'admin'
  | 'admin_pyme'
  | 'admin_municipio'
  | 'admin_municipal'
  | 'municipal_admin'
  | 'municipality_admin'
  | 'government_admin'
  | 'gobierno_admin'
  | 'school_admin'
  | 'colegio_admin'
  | 'pyme_admin'
  | 'municipio_admin'
  | 'employee'
  | 'empleado'
  | 'operator'
  | 'operador'
  | 'catalog_manager'
  | 'analytics_viewer'
  | 'end_user'
  | 'user'
  | 'usuario'
  | 'vecino'
  | 'ciudadano'
  | 'chat_user'
  | 'agent'
  | '';

const ROLE_EQUIVALENCE: Record<string, string[]> = {
  superadmin: ['superadmin', 'super_admin', 'admin_super'],
  tenant_admin: [
    'tenant_admin',
    'tenant-admin',
    'tenant_owner',
    'tenant-owner',
    'owner',
    'propietario',
    'administrador',
    'admin',
    'admin_tenant',
    'admin_pyme',
    'admin_municipio',
    'admin_municipal',
    'municipal_admin',
    'municipality_admin',
    'government_admin',
    'gobierno_admin',
    'school_admin',
    'colegio_admin',
    'pyme_admin',
    'municipio_admin',
  ],
  employee: ['employee', 'agent', 'empleado', 'operator', 'operador'],
  catalog_manager: ['catalog_manager'],
  analytics_viewer: ['analytics_viewer'],
  end_user: ['end_user', 'chat_user', 'user', 'usuario', 'vecino', 'ciudadano'],
};

const normalizeRoleToken = (role?: string | null): string => (role || '').trim().toLowerCase();

export const getRoleAliases = (role?: string | null): string[] => {
  const token = normalizeRoleToken(role);
  if (!token) return [];

  const canonical = Object.entries(ROLE_EQUIVALENCE).find(([, aliases]) => aliases.includes(token));
  if (!canonical) return [token];

  const [canonicalRole, aliases] = canonical;
  return Array.from(new Set([canonicalRole, ...aliases]));
};

export function normalizeRole(role?: string | null): Role {
  const token = normalizeRoleToken(role);
  if (!token) return '';

  const aliases = getRoleAliases(role);
  if (aliases.includes('superadmin')) return 'superadmin';
  if (aliases.includes('tenant_admin')) return 'tenant_admin';
  if (aliases.includes('employee')) return 'employee';
  if (aliases.includes('catalog_manager')) return 'catalog_manager';
  if (aliases.includes('analytics_viewer')) return 'analytics_viewer';
  if (aliases.includes('end_user')) return 'end_user';

  // Fallback for types
  return '' as Role;
}

export function hasRequiredRole(userRole: string | null | undefined, allowedRoles: string[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const userAliases = new Set(getRoleAliases(userRole));
  if (userAliases.size === 0) return false;

  return allowedRoles.some((allowedRole) => {
    const allowedAliases = getRoleAliases(allowedRole);
    return allowedAliases.some((alias) => userAliases.has(alias));
  });
}

export function isBackofficeRole(role: string | null | undefined): boolean {
  return hasRequiredRole(role, ['superadmin', 'tenant_admin', 'employee', 'catalog_manager', 'analytics_viewer']);
}
