import { demoApi } from '@/api/v2/client';
import { getRubrosHierarchy } from '@/api/rubros';
import type { DemoCatalogResponse, DemoSessionResponse, DemoSector, DemoWorkspaceConfig } from './demoTypes';

export const getDemoCatalog = async (): Promise<DemoCatalogResponse> => {
  try {
    return await demoApi.get<DemoCatalogResponse>('/api/v2/demo/catalog');
  } catch {
    const rubros = await getRubrosHierarchy().catch(() => []);
    return { sectors: ['gobierno', 'empresas'], rubros };
  }
};

export const createDemoSession = (payload: { sector: DemoSector; rubro: string }) =>
  demoApi.post<DemoSessionResponse>('/api/v2/demo/session', payload, {
    legacyFallbackPath: '/api/v1/demo/session',
  }).then((response) => ({
    ...response,
    demo_session_id: response.demo_session_id ?? response.session_id ?? null,
    workspace: normalizeWorkspaceConfig(response),
  }));

const normalizeWorkspaceConfig = (response: DemoSessionResponse): DemoWorkspaceConfig | null => {
  const workspace: DemoWorkspaceConfig = response.workspace ?? {};
  const quickReplies = workspace.quick_replies ?? response.quick_replies ?? [];
  const valueCards = workspace.value_cards ?? response.value_cards ?? [];
  const welcomeMessage = workspace.welcome_message ?? response.welcome_message ?? null;
  const handoffLabels = workspace.handoff_labels ?? response.handoff_labels ?? null;

  if (!quickReplies.length && !valueCards.length && !welcomeMessage && !handoffLabels && !workspace.title) {
    return null;
  }

  return {
    title: workspace.title ?? null,
    welcome_message: welcomeMessage,
    quick_replies: quickReplies,
    value_cards: valueCards,
    handoff_labels: handoffLabels,
  };
};
