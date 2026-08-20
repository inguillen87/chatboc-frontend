interface SurveySyntheticSeedGateOptions {
  mode?: string;
  explicitFlag?: string;
  allowedTenantIds?: string;
  tenantId?: unknown;
}

const normalizeTenantId = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseTenantAllowlist = (value: string | undefined): Set<number> =>
  new Set(
    (value ?? '')
      .split(',')
      .map((item) => normalizeTenantId(item))
      .filter((item): item is number => item !== null),
  );

/**
 * Synthetic response generation is a tenant-scoped QA capability. It requires both
 * an enabled environment and an explicit allowlist containing the survey's durable
 * tenant_id; slugs and client-selected tenant context are deliberately insufficient.
 */
export const isSurveySyntheticSeedQaEnabled = ({
  mode = import.meta.env.MODE,
  explicitFlag = import.meta.env.VITE_ENABLE_SURVEY_SYNTHETIC_SEEDING,
  allowedTenantIds = import.meta.env.VITE_SURVEY_SYNTHETIC_SEED_TENANT_IDS,
  tenantId,
}: SurveySyntheticSeedGateOptions = {}): boolean => {
  const normalizedMode = mode.trim().toLowerCase();
  const environmentEnabled =
    normalizedMode === 'development' || explicitFlag?.trim().toLowerCase() === 'true';
  if (!environmentEnabled) return false;

  const normalizedTenantId = normalizeTenantId(tenantId);
  if (normalizedTenantId === null) return false;

  return parseTenantAllowlist(allowedTenantIds).has(normalizedTenantId);
};
