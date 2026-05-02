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
  const experienceBlueprint = workspace.experience_blueprint ?? response.experience_blueprint ?? null;
  const leadCapture = workspace.lead_capture ?? response.lead_capture ?? experienceBlueprint?.lead_capture ?? null;
  const mediaCapabilities = workspace.media_capabilities ?? response.media_capabilities ?? experienceBlueprint?.media_capabilities ?? null;
  const conversionCtas = workspace.conversion_ctas ?? response.conversion_ctas ?? experienceBlueprint?.conversion_ctas ?? null;
  const animationTokens = workspace.animation_tokens ?? response.animation_tokens ?? experienceBlueprint?.animation_tokens ?? null;
  const emptyStates = workspace.empty_states ?? response.empty_states ?? experienceBlueprint?.empty_states ?? undefined;
  const firstVisit = workspace.first_visit ?? experienceBlueprint?.first_visit ?? null;
  const sampleConversations =
    workspace.sample_conversations ??
    response.chat_seed?.sample_conversations ??
    workspace.chat_seed?.sample_conversations ??
    experienceBlueprint?.sample_conversations ??
    [];
  const trustSignals = workspace.trust_signals ?? experienceBlueprint?.trust_signals ?? [];

  if (
    !quickReplies.length &&
    !valueCards.length &&
    !welcomeMessage &&
    !handoffLabels &&
    !workspace.title &&
    !firstVisit &&
    !sampleConversations.length &&
    !trustSignals.length &&
    !leadCapture &&
    !mediaCapabilities &&
    !conversionCtas &&
    !animationTokens &&
    !emptyStates
  ) {
    return null;
  }

  return {
    title: workspace.title ?? null,
    welcome_message: welcomeMessage,
    quick_replies: quickReplies,
    value_cards: valueCards,
    handoff_labels: handoffLabels,
    first_visit: firstVisit,
    sample_conversations: sampleConversations,
    trust_signals: trustSignals,
    experience_blueprint: experienceBlueprint,
    lead_capture: leadCapture,
    media_capabilities: mediaCapabilities,
    conversion_ctas: conversionCtas,
    animation_tokens: animationTokens,
    empty_states: emptyStates,
    chat_seed: workspace.chat_seed ?? response.chat_seed ?? null,
  };
};
