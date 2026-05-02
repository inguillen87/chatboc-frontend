import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { educationApi } from '@/api/education';
import { useTenant } from '@/context/TenantContext';

export const useEducationAdminMenu = () => {
  const { currentSlug } = useTenant();
  const requestOptions = currentSlug ? { tenantSlug: currentSlug } : undefined;

  const adminMenuQuery = useQuery({
    queryKey: ['education-admin-menu', currentSlug],
    queryFn: () => educationApi.getAdminMenu(requestOptions),
    retry: 0,
    staleTime: 30_000,
  });

  const playbookQuery = useQuery({
    queryKey: ['education-whatsapp-playbook', currentSlug],
    queryFn: () => educationApi.getWhatsappPlaybook(requestOptions),
    retry: 0,
    staleTime: 30_000,
  });

  const capabilitiesQuery = useQuery({
    queryKey: ['education-tenant-capabilities', currentSlug],
    queryFn: () => educationApi.getTenantCapabilities(requestOptions),
    retry: 0,
    staleTime: 30_000,
  });

  const operationsSummaryQuery = useQuery({
    queryKey: ['education-operations-summary', currentSlug],
    queryFn: () => educationApi.getOperationsSummary(requestOptions),
    retry: 0,
    staleTime: 30_000,
  });

  const operationsHeatmapQuery = useQuery({
    queryKey: ['education-operations-heatmap', currentSlug],
    queryFn: () => educationApi.getOperationsHeatmap({ limit: 100 }, requestOptions),
    retry: 0,
    staleTime: 30_000,
  });

  const data = useMemo(() => {
    const adminMenu = adminMenuQuery.data ?? capabilitiesQuery.data?.admin_menu ?? null;
    const whatsappPlaybook =
      playbookQuery.data ??
      adminMenu?.whatsapp_playbook ??
      capabilitiesQuery.data?.whatsapp_playbook ??
      null;
    const profile =
      adminMenu?.profile ??
      capabilitiesQuery.data?.education_profile ??
      null;

    return {
      adminMenu,
      whatsappPlaybook,
      profile,
      quickMenu: adminMenu?.quick_menu ?? whatsappPlaybook?.quick_menu ?? [],
      panelSections: adminMenu?.panel_sections ?? [],
      profileFields: adminMenu?.profile_fields ?? [],
      operationsSummary: operationsSummaryQuery.data ?? null,
      operationsHeatmap: operationsHeatmapQuery.data ?? null,
    };
  }, [
    adminMenuQuery.data,
    capabilitiesQuery.data,
    operationsHeatmapQuery.data,
    operationsSummaryQuery.data,
    playbookQuery.data,
  ]);

  return {
    data,
    adminMenuQuery,
    playbookQuery,
    capabilitiesQuery,
    operationsSummaryQuery,
    operationsHeatmapQuery,
    isLoading: adminMenuQuery.isLoading || playbookQuery.isLoading || capabilitiesQuery.isLoading,
    isError: adminMenuQuery.isError && playbookQuery.isError && capabilitiesQuery.isError,
  };
};
