export interface OrganizationTypePresentation {
  organization_type_label_contract?: unknown;
  organization_type_label?: unknown;
}

const legacyLabels: Record<string, string> = {
  municipio: 'Gobierno', gobierno: 'Gobierno', government: 'Gobierno',
  colegio: 'Educación', colegios: 'Educación', educacion: 'Educación', school: 'Educación',
  pyme: 'Empresa', empresa: 'Empresa', empresas: 'Empresa', commerce: 'Empresa', comercio: 'Empresa',
};
const publishedLabels = new Set(['Gobierno', 'Educación', 'Empresa']);

/** Descriptive metadata only; never use this label to select roles or grants. */
export function organizationTypeLabel(type: unknown, presentation?: OrganizationTypePresentation | null): string {
  const key = typeof type === 'string'
    ? type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';
  const fallback = Object.prototype.hasOwnProperty.call(legacyLabels, key) ? legacyLabels[key] : undefined;
  const label = presentation?.organization_type_label;
  if (presentation?.organization_type_label_contract === 'organization.type_label.v1'
    && typeof label === 'string' && publishedLabels.has(label) && (!fallback || label === fallback)) return label;
  return fallback || 'Organización';
}
