export type Role = 'admin' | 'empleado' | 'user' | '';

export function normalizeRole(role?: string | null): Role {
  if (!role) return '';
  const r = role.toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('empleado')) return 'empleado';
  return 'user';
}
