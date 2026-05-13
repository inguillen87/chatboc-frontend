import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useTenant } from "@/context/TenantContext";
import type { EducationPersona, EducationShellPayload } from "@/types/education";

const emptyPayload = (persona: EducationPersona): EducationShellPayload => ({
  persona,
  nav_items: [],
  quick_actions: [],
  staff_filters: [],
  staff_sensitivity_filters: [],
  staff_context_fields: [],
  staff_case_timeline: [],
});

export const useEducationShellData = (persona: EducationPersona) => {
  const { currentSlug } = useTenant();
  const requestOptions = currentSlug ? { tenantSlug: currentSlug } : undefined;

  return useQuery({
    queryKey: ["education-shell", persona, currentSlug],
    queryFn: async () => {
      const response = await apiClient.get<EducationShellPayload>(
        `/api/v1/education/shell?persona=${encodeURIComponent(persona)}`,
        requestOptions,
      );
      return { ...emptyPayload(persona), ...response };
    },
    retry: 0,
    staleTime: 30_000,
  });
};
