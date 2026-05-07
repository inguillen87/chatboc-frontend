import { apiFetch } from "@/utils/api";
import type { RealtimeVoiceCapabilities, RealtimeVoiceQuery } from "@/types/realtimeVoice";

export async function getRealtimeVoiceCapabilities(
  query: RealtimeVoiceQuery = {},
): Promise<RealtimeVoiceCapabilities> {
  const params = new URLSearchParams();
  const tenant = query.tenant ?? query.tenantSlug ?? query.slug;
  const widgetToken = query.widgetToken;

  if (tenant) {
    params.set("tenant_slug", tenant);
  }
  if (widgetToken) {
    params.set("widget_token", widgetToken);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<RealtimeVoiceCapabilities>(`/api/public/realtime/voice-capabilities${suffix}`, {
    tenantSlug: tenant || undefined,
    omitTenant: !tenant,
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    sendAnonId: true,
    omitEntityToken: true,
  });
}
