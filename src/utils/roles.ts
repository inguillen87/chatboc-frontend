export type Role = 'super_admin' | 'admin' | 'empleado' | 'usuario' | 'user' | '';

export function normalizeRole(role?: string | null): Role {
  if (!role) return '';
  const r = role.toLowerCase().trim();
  if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
  if (r.includes('admin')) return 'admin';
  if (r.includes('empleado') || r.includes('agente')) return 'empleado';
  if (r === 'usuario' || r === 'ciudadano' || r === 'vecino') return 'usuario';
  return 'user';
}
