/**
 * Contrato, validación hexadecimal y cálculo de contraste WCAG (luminancia
 * relativa sRGB) para «Paleta del espacio» (`organization_branding`).
 */

export interface OrganizationBrandingValues {
  enabled: boolean;
  primary_color: string;
  accent_color: string;
}

export interface OrganizationBrandingColorPair {
  background: string;
  foreground: '#000000' | '#FFFFFF';
  contrast: number;
}

export interface OrganizationBrandingAppearance {
  active: boolean;
  primary: OrganizationBrandingColorPair;
  accent: OrganizationBrandingColorPair;
}

export interface OrganizationBrandingPreset {
  id: string;
  label: string;
  primary_color: string;
  accent_color: string;
}

export interface OrganizationBrandingHistoryEntry {
  version: number;
  values: OrganizationBrandingValues;
}

export interface OrganizationBrandingSnapshot {
  contract_version: string;
  tenant: { id: number; slug: string };
  revision: string;
  version: number;
  values: OrganizationBrandingValues;
  history: OrganizationBrandingHistoryEntry[];
  can_edit: boolean;
  reason_code: string;
  message: string;
  appearance: OrganizationBrandingAppearance;
  presets: OrganizationBrandingPreset[];
  heading: string;
  scope_note: string;
  save_endpoint: string;
}

export interface OrganizationBrandingPublishPayload {
  organization_branding: {
    operation: 'publish';
    values: OrganizationBrandingValues;
  };
  expected_revision: string;
}

export interface OrganizationBrandingRestorePayload {
  organization_branding: {
    operation: 'restore';
    version: number;
  };
  expected_revision: string;
}

export type OrganizationBrandingErrorKind =
  | 'conflict'
  | 'precondition'
  | 'forbidden'
  | 'error';

export interface ResolvedBrandingError {
  kind: OrganizationBrandingErrorKind;
  reasonCode: string | null;
  message: string;
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isValidBrandingHex = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR_RE.test(value.trim());

export const normalizeBrandingHex = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toUpperCase() : null;
};

/** Luminancia relativa sRGB según WCAG 2.1 (idéntica a la fórmula del backend). */
export function relativeLuminanceSrgb(hex: string): number {
  const normalized = normalizeBrandingHex(hex);
  if (!normalized) {
    throw new Error('invalid_brand_color');
  }
  const [r, g, b] = [1, 3, 5]
    .map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

/** Calcula el foreground (#000000 o #FFFFFF) de mayor contraste y la relación exacta. */
export function calculateBrandingColorPair(hex: string): OrganizationBrandingColorPair {
  const normalized = normalizeBrandingHex(hex);
  if (!normalized) {
    throw new Error('invalid_brand_color');
  }
  const luminance = relativeLuminanceSrgb(normalized);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const foreground: '#000000' | '#FFFFFF' =
    blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
  const contrast = Math.round(Math.max(blackContrast, whiteContrast) * 1000) / 1000;
  return {
    background: normalized,
    foreground,
    contrast,
  };
}

export function contrastComplianceLevel(contrast: number): 'AAA' | 'AA' | 'Bajo' {
  if (contrast >= 7) return 'AAA';
  if (contrast >= 4.5) return 'AA';
  return 'Bajo';
}

export function formatContrastLabel(contrast: number): string {
  const rounded = contrast.toFixed(1).replace('.', ',');
  return `${rounded}:1 · ${contrastComplianceLevel(contrast)}`;
}

export function sameBrandingValues(
  left: OrganizationBrandingValues,
  right: OrganizationBrandingValues,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.primary_color.trim().toUpperCase() === right.primary_color.trim().toUpperCase() &&
    left.accent_color.trim().toUpperCase() === right.accent_color.trim().toUpperCase()
  );
}

export function buildPublishBrandingPayload(
  values: OrganizationBrandingValues,
  expectedRevision: string,
): OrganizationBrandingPublishPayload {
  const primary = normalizeBrandingHex(values.primary_color);
  const accent = normalizeBrandingHex(values.accent_color);
  if (!primary || !accent) {
    throw new Error('invalid_brand_color');
  }
  return {
    organization_branding: {
      operation: 'publish',
      values: {
        enabled: Boolean(values.enabled),
        primary_color: primary,
        accent_color: accent,
      },
    },
    expected_revision: expectedRevision,
  };
}

export function buildRestoreBrandingPayload(
  version: number,
  expectedRevision: string,
): OrganizationBrandingRestorePayload {
  return {
    organization_branding: {
      operation: 'restore',
      version,
    },
    expected_revision: expectedRevision,
  };
}

const readBrandingValues = (raw: unknown): OrganizationBrandingValues | null => {
  if (!isRecord(raw) || typeof raw.enabled !== 'boolean') return null;
  const primary = normalizeBrandingHex(raw.primary_color);
  const accent = normalizeBrandingHex(raw.accent_color);
  if (!primary || !accent) return null;
  return {
    enabled: raw.enabled,
    primary_color: primary,
    accent_color: accent,
  };
};

const readColorPair = (
  raw: unknown,
  fallbackHex: string,
): OrganizationBrandingColorPair => {
  if (isRecord(raw)) {
    const background = normalizeBrandingHex(raw.background);
    if (
      background &&
      (raw.foreground === '#000000' || raw.foreground === '#FFFFFF') &&
      typeof raw.contrast === 'number' &&
      Number.isFinite(raw.contrast) &&
      raw.contrast >= 1
    ) {
      return {
        background,
        foreground: raw.foreground,
        contrast: raw.contrast,
      };
    }
  }
  return calculateBrandingColorPair(fallbackHex);
};

export function expectedBrandingSaveEndpoint(slug: string): string {
  return `/api/admin/tenants/${encodeURIComponent(slug)}/config`;
}

export function readOrganizationBranding(
  raw: unknown,
  expectedSlug: string,
  expectedTenantId?: number | null,
): OrganizationBrandingSnapshot | null {
  if (!isRecord(raw)) return null;
  const normalizedExpectedSlug = expectedSlug.trim().toLowerCase();
  if (!normalizedExpectedSlug) return null;

  const tenant = isRecord(raw.tenant) ? raw.tenant : null;
  if (!tenant) return null;
  const tenantSlug =
    typeof tenant.slug === 'string' ? tenant.slug.trim().toLowerCase() : '';
  const tenantId = typeof tenant.id === 'number' ? tenant.id : NaN;
  if (
    !tenantSlug ||
    tenantSlug !== normalizedExpectedSlug ||
    !Number.isInteger(tenantId) ||
    tenantId < 1
  ) {
    return null;
  }
  if (
    expectedTenantId != null &&
    Number.isInteger(expectedTenantId) &&
    tenantId !== expectedTenantId
  ) {
    return null;
  }

  const revision = typeof raw.revision === 'string' ? raw.revision.trim() : '';
  const version = typeof raw.version === 'number' ? raw.version : NaN;
  const values = readBrandingValues(raw.values);
  if (!revision || !Number.isInteger(version) || version < 0 || !values) {
    return null;
  }
  if (typeof raw.can_edit !== 'boolean') return null;

  const history: OrganizationBrandingHistoryEntry[] = [];
  if (Array.isArray(raw.history)) {
    const seenVersions = new Set<number>();
    for (const item of raw.history) {
      if (!isRecord(item)) continue;
      const entryVersion = typeof item.version === 'number' ? item.version : NaN;
      const entryValues = readBrandingValues(item.values);
      if (
        !Number.isInteger(entryVersion) ||
        entryVersion < 0 ||
        !entryValues ||
        seenVersions.has(entryVersion)
      ) {
        continue;
      }
      seenVersions.add(entryVersion);
      history.push({ version: entryVersion, values: entryValues });
    }
  }

  const presets: OrganizationBrandingPreset[] = [];
  if (Array.isArray(raw.presets)) {
    for (const item of raw.presets) {
      if (!isRecord(item)) continue;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      const primary = normalizeBrandingHex(item.primary_color);
      const accent = normalizeBrandingHex(item.accent_color);
      if (!id || !label || !primary || !accent) continue;
      presets.push({
        id,
        label,
        primary_color: primary,
        accent_color: accent,
      });
    }
  }

  const rawAppearance = isRecord(raw.appearance) ? raw.appearance : null;
  const appearance: OrganizationBrandingAppearance = {
    active:
      typeof rawAppearance?.active === 'boolean'
        ? rawAppearance.active
        : values.enabled,
    primary: readColorPair(rawAppearance?.primary, values.primary_color),
    accent: readColorPair(rawAppearance?.accent, values.accent_color),
  };

  const canonicalEndpoint = expectedBrandingSaveEndpoint(tenantSlug);
  const saveEndpoint =
    typeof raw.save_endpoint === 'string' && raw.save_endpoint.trim() === canonicalEndpoint
      ? canonicalEndpoint
      : canonicalEndpoint;

  return {
    contract_version:
      typeof raw.contract_version === 'string' && raw.contract_version.trim()
        ? raw.contract_version.trim()
        : 'organization.branding.v1',
    tenant: { id: tenantId, slug: tenantSlug },
    revision,
    version,
    values,
    history,
    can_edit: raw.can_edit,
    reason_code: typeof raw.reason_code === 'string' ? raw.reason_code.trim() : '',
    message: typeof raw.message === 'string' ? raw.message.trim() : '',
    appearance,
    presets,
    heading:
      typeof raw.heading === 'string' && raw.heading.trim()
        ? raw.heading.trim()
        : 'Paleta del espacio',
    scope_note:
      typeof raw.scope_note === 'string' && raw.scope_note.trim()
        ? raw.scope_note.trim()
        : 'Se aplica a los botones y pestañas del portal público de esta organización.',
    save_endpoint: saveEndpoint,
  };
}

export function readReadOnlyMessage(snapshot: OrganizationBrandingSnapshot): string {
  if (snapshot.message) return snapshot.message;
  if (
    snapshot.reason_code === 'branding_full_required' ||
    snapshot.reason_code === 'full_plan_required'
  ) {
    return 'La paleta del espacio requiere un plan Full activo.';
  }
  if (
    snapshot.reason_code === 'branding_forbidden' ||
    snapshot.reason_code === 'tenant_admin_required'
  ) {
    return 'No tenés permisos para modificar la paleta de esta organización.';
  }
  return 'Esta paleta está en modo solo lectura.';
}

export function resolveBrandingError(error: unknown): ResolvedBrandingError {
  const status =
    error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : null;
  const body =
    error && typeof error === 'object' && 'body' in error && isRecord((error as { body?: unknown }).body)
      ? ((error as { body: Record<string, unknown> }).body)
      : null;
  const reasonCode =
    typeof body?.reason_code === 'string'
      ? body.reason_code.trim()
      : typeof body?.error === 'string'
        ? body.error.trim()
        : null;
  const bodyMessage =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message.trim()
      : null;

  if (status === 412 || reasonCode === 'branding_revision_conflict') {
    return {
      kind: 'conflict',
      reasonCode: reasonCode ?? 'branding_revision_conflict',
      message:
        'Otra persona cambió la marca. Recargamos la versión vigente y conservamos tu borrador.',
    };
  }

  if (status === 428) {
    return {
      kind: 'precondition',
      reasonCode,
      message:
        bodyMessage ||
        'Falta confirmar la revisión actual de la marca. Recargamos la configuración y conservamos tu borrador.',
    };
  }

  if (status === 403) {
    if (reasonCode === 'branding_full_required' || reasonCode === 'full_plan_required') {
      return {
        kind: 'forbidden',
        reasonCode,
        message: bodyMessage || 'La paleta del espacio requiere un plan Full activo.',
      };
    }
    return {
      kind: 'forbidden',
      reasonCode: reasonCode ?? 'branding_forbidden',
      message:
        bodyMessage ||
        'No tenés permisos para modificar la paleta de esta organización.',
    };
  }

  return {
    kind: 'error',
    reasonCode,
    message:
      bodyMessage ||
      (error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'No pudimos actualizar la paleta del espacio. Intentá nuevamente.'),
  };
}
