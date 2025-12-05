export type Role = 'admin' | 'empleado' | 'user' | 'super_admin' | '';

export function normalizeRole(role?: string | null): Role {
  if (!role) return '';
  const r = role.toLowerCase();
  if (r.includes('super_admin') || r === 'super_admin') return 'super_admin';
  if (r.includes('admin')) return 'admin';
  if (r.includes('empleado')) return 'empleado';
  return 'user';
}
