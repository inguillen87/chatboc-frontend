import { ApiError } from "@/utils/api";
import { publicApi } from "@/api/v2/client";

export type LandingRecord = Record<string, any>;

export interface LandingExperience extends LandingRecord {
  contract_version?: string;
  brand?: LandingRecord;
  tokens?: LandingRecord;
  motion?: LandingRecord;
  navigation?: LandingRecord | LandingRecord[];
  hero?: LandingRecord;
  proof_bar?: LandingRecord | LandingRecord[];
  sections?: LandingRecord[];
  ctas?: LandingRecord | LandingRecord[];
  pages?: LandingRecord | LandingRecord[];
  request_id?: string;
}

export interface LandingExperienceQuery {
  tenant?: string | null;
  tenantSlug?: string | null;
  slug?: string | null;
  widgetToken?: string | null;
}

const buildLandingExperiencePath = (query: LandingExperienceQuery = {}) => {
  const params = new URLSearchParams();
  const tenant = query.tenantSlug || query.tenant || query.slug;

  if (tenant) params.set("tenant_slug", tenant);
  if (query.widgetToken) params.set("widget_token", query.widgetToken);

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return `/api/public/landing-experience${suffix}`;
};

export async function getLandingExperience(
  query: LandingExperienceQuery = {},
): Promise<LandingExperience | null> {
  try {
    return await publicApi.get<LandingExperience>(buildLandingExperiencePath(query), {
      tenantSlug: query.tenantSlug || query.tenant || query.slug || null,
      isWidgetRequest: true,
      omitCredentials: true,
    });
  } catch (error) {
    if (error instanceof ApiError && [404, 405, 501].includes(error.status)) {
      return null;
    }
    return null;
  }
}
