import { PUBLIC_BACKEND_URL } from "@/config";
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
  const response = await fetch(`${PUBLIC_BACKEND_URL}/api/public/realtime/voice-capabilities${suffix}`, {
    credentials: "omit",
    headers: tenant ? { "X-Tenant-Slug": tenant } : undefined,
  });

  if (!response.ok) return null;
  return response.json();
}
