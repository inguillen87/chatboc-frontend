import { apiFetch } from "@/utils/api";

export type TrackingKind = "claim" | "order";
export type TrackingRecord = Record<string, any>;

export interface TrackingExperienceQuery {
  kind: TrackingKind;
  code: string;
  pin?: string | null;
  tenantSlug?: string | null;
}

export interface TrackingExperienceResponse extends TrackingRecord {
  contract_version?: string;
  request_id?: string;
  kind?: TrackingKind | string;
  code?: string;
  status?: string | TrackingRecord;
  timeline?: TrackingRecord[];
  milestones?: string[] | TrackingRecord[];
  map?: TrackingRecord;
  render_contract?: TrackingRecord;
  actions?: TrackingRecord[];
}

export async function fetchTrackingExperience({
  kind,
  code,
  pin,
  tenantSlug,
}: TrackingExperienceQuery): Promise<TrackingExperienceResponse> {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("code", code);
  if (pin) params.set("pin", pin);
  if (tenantSlug) params.set("tenant_slug", tenantSlug);

  return apiFetch<TrackingExperienceResponse>(
    `/api/public/tracking/experience?${params.toString()}`,
    {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitEntityToken: true,
      omitChatSessionId: true,
      omitTenant: true,
      suppressPanel401Redirect: true,
      headers: tenantSlug ? { "X-Tenant-Slug": tenantSlug } : undefined,
      pin: pin || null,
    },
  );
}

