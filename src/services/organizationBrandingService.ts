import { ApiError, apiFetch } from '@/utils/api';
import { panelReadOptions } from '@/utils/panelReadOptions';
import {
  buildPublishBrandingPayload,
  buildRestoreBrandingPayload,
  expectedBrandingSaveEndpoint,
  readOrganizationBranding,
  type OrganizationBrandingSnapshot,
  type OrganizationBrandingValues,
} from '@/utils/organizationBranding';

export interface OrganizationBrandingService {
  getBranding: (
    slug: string,
    expectedTenantId?: number | null,
  ) => Promise<OrganizationBrandingSnapshot>;
  publishBranding: (
    slug: string,
    expectedRevision: string,
    values: OrganizationBrandingValues,
    options?: { saveEndpoint?: string; expectedTenantId?: number | null },
  ) => Promise<OrganizationBrandingSnapshot>;
  restoreBranding: (
    slug: string,
    expectedRevision: string,
    version: number,
    options?: { saveEndpoint?: string; expectedTenantId?: number | null },
  ) => Promise<OrganizationBrandingSnapshot>;
}

const resolveEndpoint = (slug: string, candidate?: string): string => {
  const canonical = expectedBrandingSaveEndpoint(slug);
  return candidate && candidate.trim() === canonical ? canonical : canonical;
};

const extractBrandingFromReceipt = (
  response: unknown,
  slug: string,
  expectedTenantId?: number | null,
): OrganizationBrandingSnapshot | null => {
  if (!response || typeof response !== 'object') return null;
  const record = response as Record<string, unknown>;
  const candidate = record.brand ?? record.organization_branding ?? record;
  return readOrganizationBranding(candidate, slug, expectedTenantId);
};

export const organizationBrandingService: OrganizationBrandingService = {
  getBranding: async (slug, expectedTenantId) => {
    const endpoint = expectedBrandingSaveEndpoint(slug);
    const bundle = await apiFetch<Record<string, unknown>>(endpoint, {
      ...panelReadOptions(slug),
      cache: 'no-store',
    });
    const parsed = readOrganizationBranding(
      bundle?.organization_branding,
      slug,
      expectedTenantId,
    );
    if (!parsed) {
      throw new ApiError(
        'No pudimos leer la configuración de paleta para esta organización.',
        502,
      );
    }
    return parsed;
  },

  publishBranding: async (slug, expectedRevision, values, options = {}) => {
    const endpoint = resolveEndpoint(slug, options.saveEndpoint);
    const body = buildPublishBrandingPayload(values, expectedRevision);
    const receipt = await apiFetch<unknown>(endpoint, {
      ...panelReadOptions(slug),
      allowStartupRecovery: false,
      method: 'PUT',
      body,
    });
    const updated = extractBrandingFromReceipt(
      receipt,
      slug,
      options.expectedTenantId,
    );
    if (updated) return updated;
    return organizationBrandingService.getBranding(slug, options.expectedTenantId);
  },

  restoreBranding: async (slug, expectedRevision, version, options = {}) => {
    const endpoint = resolveEndpoint(slug, options.saveEndpoint);
    const body = buildRestoreBrandingPayload(version, expectedRevision);
    const receipt = await apiFetch<unknown>(endpoint, {
      ...panelReadOptions(slug),
      allowStartupRecovery: false,
      method: 'PUT',
      body,
    });
    const updated = extractBrandingFromReceipt(
      receipt,
      slug,
      options.expectedTenantId,
    );
    if (updated) return updated;
    return organizationBrandingService.getBranding(slug, options.expectedTenantId);
  },
};
