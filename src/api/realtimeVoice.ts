import { ApiError, apiFetch } from "@/utils/api";
import type { RealtimeVoiceCapabilities, RealtimeVoiceQuery } from "@/types/realtimeVoice";

export async function getRealtimeVoiceCapabilities(
  query: RealtimeVoiceQuery = {},
): Promise<RealtimeVoiceCapabilities | null> {
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
  try {
    return await apiFetch<RealtimeVoiceCapabilities>(
      `/api/public/realtime/voice-capabilities${suffix}`,
      {
        skipAuth: true,
        isWidgetRequest: true,
        omitCredentials: true,
        omitEntityToken: true,
        omitChatSessionId: true,
        omitTenant: true,
        headers: tenant ? { "X-Tenant-Slug": tenant } : undefined,
        suppressPanel401Redirect: true,
      },
    );
  } catch (error) {
    if (error instanceof ApiError && [404, 405, 501].includes(error.status)) {
      return null;
    }
    return null;
  }
}
