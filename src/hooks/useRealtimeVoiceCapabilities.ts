import { useQuery } from "@tanstack/react-query";
import { getRealtimeVoiceCapabilities } from "@/api/realtimeVoice";
import type { RealtimeVoiceQuery } from "@/types/realtimeVoice";

export function useRealtimeVoiceCapabilities(query: RealtimeVoiceQuery = {}, enabled = true) {
  const tenant = query.tenant ?? query.tenantSlug ?? query.slug ?? null;
  const widgetToken = query.widgetToken ?? null;

  return useQuery({
    queryKey: ["realtime-voice-capabilities", tenant, widgetToken],
    queryFn: () => getRealtimeVoiceCapabilities({ tenant, widgetToken }),
    enabled,
    retry: 0,
    staleTime: 60_000,
  });
}
