import { apiFetch } from "@/utils/api";

export type TrackingKind = "claim" | "order";
export type TrackingRecord = Record<string, any>;

export interface TrackingExperienceQuery {
  kind: TrackingKind;
  code: string;
  pin?: string | null;
  token?: string | null;
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
  support?: TrackingRecord;
}

export async function fetchTrackingExperience({
  kind,
  code,
  pin,
  token,
  tenantSlug,
}: TrackingExperienceQuery): Promise<TrackingExperienceResponse> {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("code", code);
  if (pin) params.set("pin", pin);
  if (token) params.set("token", token);
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

export async function sendTrackingSupportMessage({
  endpoint,
  pin,
  message,
  code,
}: {
  endpoint: string;
  pin?: string | null;
  message: string;
  code?: string | null;
}): Promise<TrackingRecord> {
  const params = new URLSearchParams();
  if (pin) params.set("pin", pin);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const normalizedCode = (code || "").replace(/^(M|S)-/i, "");
  const isLegacyClaimEndpoint = endpoint.includes("/tracking/api/send-claim-message");
  return apiFetch<TrackingRecord>(`${endpoint}${suffix}`, {
    method: "POST",
    body: isLegacyClaimEndpoint
      ? { nro_ticket: normalizedCode, mensaje: message, comentario: message }
      : { comentario: message, mensaje: message, texto: message },
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitEntityToken: true,
    omitChatSessionId: true,
    omitTenant: true,
    suppressPanel401Redirect: true,
    pin: pin || null,
  });
}
