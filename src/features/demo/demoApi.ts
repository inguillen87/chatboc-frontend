import { demoApi } from '@/api/v2/client';
import { getRubrosHierarchy } from '@/api/rubros';
import { DEMO_SECTOR_GROUPS } from '@/data/demoHierarchy';
import type { DemoCatalogResponse, DemoChatBootstrap, DemoSectorGroup, DemoSessionResponse, DemoSector, DemoWorkspaceConfig } from './demoTypes';

const DEFAULT_DEMO_SECTORS: DemoSector[] = ['educacion', 'gobierno', 'empresas'];

export const getDemoCatalog = async (): Promise<DemoCatalogResponse> => {
  try {
    return normalizeDemoCatalog(await demoApi.get<DemoCatalogResponse>('/api/v2/demo/catalog'));
  } catch (error) {
    const rubros = await getRubrosHierarchy().catch(() => []);
    return normalizeDemoCatalog({
      sectors: DEFAULT_DEMO_SECTORS,
      sector_groups: DEMO_SECTOR_GROUPS,
      rubros,
      local_demo_mode: true,
      catalog_error: error instanceof Error ? error.message : 'demo_catalog_unavailable',
    });
  }
};

export const createDemoSession = (payload: { sector?: DemoSector | string; pillar?: DemoSector | string; rubro?: string; rubro_slug?: string; category_slug?: string; tenant_slug?: string | null }) =>
  demoApi.post<DemoSessionResponse>('/api/v2/demo/session', payload, {
    legacyFallbackPath: '/api/v1/demo/session',
  }).then((response) => ({
    ...response,
    demo_session_id: response.demo_session_id ?? response.session_id ?? null,
    tenant_slug: response.tenant_slug ?? response.tenant?.slug ?? null,
    workspace: normalizeWorkspaceConfig(response),
  }));

const normalizeDemoCatalog = (response: DemoCatalogResponse): DemoCatalogResponse => {
  const incomingPillars = Array.isArray(response.pillars) ? response.pillars : [];
  const pillarSectors = incomingPillars
    .map((pillar) => pillar?.key ?? pillar?.sector ?? pillar?.slug)
    .filter((value): value is DemoSector => typeof value === 'string' && !!value);
  const incomingSectors = Array.isArray(response.sectors) ? response.sectors : [];
  const sectors = Array.from(new Set([...pillarSectors, ...incomingSectors, ...DEFAULT_DEMO_SECTORS]));
  const incomingGroups = Array.isArray(response.sector_groups)
    ? response.sector_groups.filter((group) => group?.key)
    : [];
  const groupMap = new Map<string, DemoSectorGroup>();

  DEMO_SECTOR_GROUPS.forEach((group) => groupMap.set(String(group.key), group));
  incomingPillars.forEach((pillar) => {
    const key = String(pillar?.key ?? pillar?.sector ?? pillar?.slug ?? '');
    if (!key) return;
    const fallback = groupMap.get(key);
    groupMap.set(key, {
      ...fallback,
      key,
      label: pillar.label ?? fallback?.label ?? null,
      description: pillar.description ?? fallback?.description ?? null,
      cta_label: pillar.cta_label ?? fallback?.cta_label ?? null,
      tenant_slug: pillar.tenant_slug ?? pillar.demo_tenant_slug ?? pillar.default_tenant_slug ?? fallback?.tenant_slug ?? null,
      default_rubro: pillar.default_rubro ?? pillar.default_rubro_slug ?? null,
    });
  });
  incomingGroups.forEach((group) => {
    const fallback = groupMap.get(String(group.key));
    groupMap.set(String(group.key), { ...fallback, ...group });
  });

  return {
    ...response,
    sectors,
    pillars: incomingPillars,
    sector_groups: Array.from(groupMap.values()),
    rubros: Array.isArray(response.rubros) ? response.rubros : [],
  };
};

const normalizeWorkspaceConfig = (response: DemoSessionResponse): DemoWorkspaceConfig | null => {
  const workspace: DemoWorkspaceConfig = response.workspace ?? {};
  const quickReplies = workspace.quick_replies ?? response.quick_replies ?? [];
  const valueCards = workspace.value_cards ?? response.value_cards ?? [];
  const catalogResources = workspace.catalog_resources ?? (response as any).catalog_resources ?? [];
  const welcomeMessage = workspace.welcome_message ?? response.welcome_message ?? null;
  const handoffLabels = workspace.handoff_labels ?? response.handoff_labels ?? null;
  const experienceBlueprint = workspace.experience_blueprint ?? response.experience_blueprint ?? null;
  const leadCapture = workspace.lead_capture ?? response.lead_capture ?? experienceBlueprint?.lead_capture ?? null;
  const mediaCapabilities = workspace.media_capabilities ?? response.media_capabilities ?? experienceBlueprint?.media_capabilities ?? null;
  const conversionCtas = workspace.conversion_ctas ?? response.conversion_ctas ?? experienceBlueprint?.conversion_ctas ?? null;
  const animationTokens = workspace.animation_tokens ?? response.animation_tokens ?? experienceBlueprint?.animation_tokens ?? null;
  const emptyStates = workspace.empty_states ?? response.empty_states ?? experienceBlueprint?.empty_states ?? undefined;
  const education = workspace.education ?? null;
  const chatBootstrap = normalizeChatBootstrap(
    workspace.chat_bootstrap ??
      response.chat_bootstrap ??
      workspace.chat_seed?.chat_bootstrap ??
      response.chat_seed?.chat_bootstrap ??
      null,
    {
      demoSessionId: response.demo_session_id ?? response.session_id ?? null,
      tenantSlug: response.tenant_slug ?? response.tenant?.slug ?? null,
    },
  );
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
    !catalogResources.length &&
    !handoffLabels &&
    !workspace.title &&
    !firstVisit &&
    !sampleConversations.length &&
    !trustSignals.length &&
    !leadCapture &&
    !mediaCapabilities &&
    !conversionCtas &&
    !animationTokens &&
    !emptyStates &&
    !education &&
    !chatBootstrap
  ) {
    return null;
  }

  return {
    title: workspace.title ?? null,
    welcome_message: welcomeMessage,
    quick_replies: quickReplies,
    value_cards: valueCards,
    catalog_resources: catalogResources,
    analytics_summary: workspace.analytics_summary ?? (response as any).analytics_summary ?? null,
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
    education,
    chat_bootstrap: chatBootstrap,
    chat_seed: workspace.chat_seed ?? response.chat_seed ?? null,
  };
};

const normalizeChatBootstrap = (
  value: DemoChatBootstrap | null,
  context?: { demoSessionId?: string | null; tenantSlug?: string | null },
): DemoChatBootstrap | null => {
  if (!value || typeof value !== 'object') return null;
  const headers = value.headers && typeof value.headers === 'object' ? { ...value.headers } : {};
  const payload = value.payload && typeof value.payload === 'object' ? { ...value.payload } : undefined;
  const query = value.query && typeof value.query === 'object' ? { ...value.query } : undefined;
  const demoSessionId =
    context?.demoSessionId ??
    (typeof payload?.demo_session_id === 'string' ? payload.demo_session_id : null) ??
    (typeof query?.demo_session_id === 'string' ? query.demo_session_id : null);
  const tenantSlug =
    context?.tenantSlug ??
    (typeof payload?.tenant_slug === 'string' ? payload.tenant_slug : null) ??
    (typeof query?.tenant_slug === 'string' ? query.tenant_slug : null);

  if (demoSessionId) {
    headers['X-Demo-Session-Id'] ||= demoSessionId;
    headers['X-Demo-Session'] ||= demoSessionId;
    headers['X-Chat-Session-Id'] ||= demoSessionId;
    if (payload && !payload.demo_session_id) payload.demo_session_id = demoSessionId;
    if (query && !query.demo_session_id) query.demo_session_id = demoSessionId;
  }
  if (tenantSlug) {
    headers['X-Tenant-Slug'] ||= tenantSlug;
    if (payload && !payload.tenant_slug) payload.tenant_slug = tenantSlug;
    if (query && !query.tenant_slug) query.tenant_slug = tenantSlug;
  }

  return {
    contract_version: typeof value.contract_version === 'string' ? value.contract_version : null,
    endpoint: typeof value.endpoint === 'string' ? value.endpoint : null,
    fallback_endpoint: typeof value.fallback_endpoint === 'string' ? value.fallback_endpoint : null,
    method: typeof value.method === 'string' ? value.method : null,
    headers: Object.keys(headers).length ? headers : undefined,
    query,
    payload,
    supports: value.supports && typeof value.supports === 'object' ? value.supports : undefined,
  };
};
