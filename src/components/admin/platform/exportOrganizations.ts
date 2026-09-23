import type { Tenant } from '@/types/superAdmin';

const cell = (value: unknown): string => {
  const text = value == null ? '' : String(value);
  // Spreadsheet programs may execute formulas even when a CSV cell is quoted.
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function buildOrganizationsCsv(organizations: Tenant[]): string {
  const rows: unknown[][] = [['Organización', 'Identificador', 'Tipo', 'Plan', 'Estado', 'Responsable']];
  for (const org of organizations) {
    rows.push([
      org.nombre, org.slug,
      ({ municipio: 'Gobierno', colegio: 'Educación', pyme: 'Empresa' })[org.tipo] || org.tipo,
      org.plan,
      org.is_active === true ? 'Activa' : org.is_active === false ? 'Inactiva' : 'Sin informar',
      org.owner_email,
    ]);
  }
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}

export function exportOrganizationsCsv(organizations: Tenant[]): void {
  const url = URL.createObjectURL(new Blob([buildOrganizationsCsv(organizations)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `chatboc-organizaciones-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
