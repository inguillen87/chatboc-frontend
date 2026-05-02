import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useTenant } from '@/context/TenantContext';
import type { EducationPersona, EducationShellPayload } from '@/types/education';

const getFallbackPayload = (persona: EducationPersona): EducationShellPayload => ({
  persona,
  nav_items: [],
  quick_actions: [],
  staff_filters: [],
  staff_sensitivity_filters: [],
  staff_context_fields: [],
  staff_case_timeline: [],
  family_context: {
    verification_state: persona === 'public' ? 'anonymous' : persona === 'staff' ? 'staff' : 'known',
    students: [],
    access_gate: {
      title: 'Verificación requerida',
      description: 'Necesitás validar tu vínculo familiar para acceder a la información protegida.',
      cta_label: 'Continuar verificación',
      cta_path: '/educacion/familia/verificacion',
      loading_label: 'Validando perfil familiar...',
    },
  },
});

export const useEducationShellData = (persona: EducationPersona) => {
  const { currentSlug } = useTenant();
  const requestOptions = currentSlug ? { tenantSlug: currentSlug } : undefined;

  return useQuery({
    queryKey: ['education-shell', persona, currentSlug],
    queryFn: async () => {
      const response = await apiClient.get<EducationShellPayload>(
        `/api/v1/education/shell?persona=${encodeURIComponent(persona)}`,
        requestOptions,
      );
      return { ...getFallbackPayload(persona), ...response };
    },
    retry: 0,
    staleTime: 30_000,
    placeholderData: getFallbackPayload(persona),
  });
};
