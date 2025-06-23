export function normalizeRole(role?: string | null): string {
  if (!role) return '';
  const r = role.toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('empleado')) return 'empleado';
  return role;
}
