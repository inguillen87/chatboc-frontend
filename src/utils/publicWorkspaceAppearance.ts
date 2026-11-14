/** Paleta pública de un organismo, tal como la proyecta `organization.workspace_appearance.v1`. */
export interface PublicWorkspaceAppearance { tenantSlug: string; version: number; primary: string; accent: string }

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const color = (value: unknown): string | null => {
  const pair = record(value);
  const background = pair?.background, foreground = pair?.foreground;
  return typeof background === 'string' && /^#[0-9A-Fa-f]{6}$/.test(background) &&
    (foreground === '#000000' || foreground === '#FFFFFF') ? background.toUpperCase() : null;
};

/**
 * Lectura cerrada: el contrato exacto, activo y emitido para la misma identidad pública (ID y slug). Cualquier otra
 * forma (ausente, de otro organismo, inactiva o mal formada) significa "sin apariencia propia".
 */
export function readPublicWorkspaceAppearance(payload: unknown, expectedSlug: string | null | undefined, expectedTenantId: number | null | undefined): PublicWorkspaceAppearance | null {
  const source = record(payload), tenant = record(source?.tenant), appearance = record(source?.appearance);
  const expected = typeof expectedSlug === 'string' ? expectedSlug.trim().toLowerCase() : '';
  if (!source || !tenant || !appearance || !expected || !Number.isSafeInteger(expectedTenantId) || (expectedTenantId as number) < 1) return null;
  if (source.contract_version !== 'organization.workspace_appearance.v1') return null;
  if (typeof tenant.slug !== 'string' || tenant.slug.toLowerCase() !== expected) return null;
  if (!Number.isSafeInteger(tenant.id) || (tenant.id as number) < 1 || tenant.id !== expectedTenantId) return null;
  if (!Number.isSafeInteger(source.version) || (source.version as number) < 0) return null;
  if (appearance.active !== true) return null;
  const primary = color(appearance.primary), accent = color(appearance.accent);
  return primary && accent ? { tenantSlug: expected, version: source.version as number, primary, accent } : null;
}
