import { demoApi } from '@/api/v2/client';
import { findDemoCatalogAsset } from '@/data/demoCatalogAssets';
import type {
  DemoAdminPreviewResponse,
  DemoCatalogResponse,
  DemoChatBootstrap,
  DemoSectorGroup,
  DemoSessionResponse,
  DemoSector,
  DemoWorkspaceConfig,
} from './demoTypes';

export const getDemoCatalog = async (): Promise<DemoCatalogResponse> => {
  return normalizeDemoCatalog(await demoApi.get<DemoCatalogResponse>('/api/v2/demo/catalog'));
};

export type DemoSessionPayload = {
  sector?: DemoSector | string;
  pillar?: DemoSector | string;
  rubro?: string;
  rubro_slug?: string;
  category_slug?: string;
  tenant_slug?: string | null;
};

export const getDemoAdminPreview = async (params: {
  sector?: DemoSector | string | null;
  tenant_slug?: string | null;
}): Promise<DemoAdminPreviewResponse> => {
  const query = new URLSearchParams();
  if (params.sector) query.set('sector', String(params.sector));
  if (params.tenant_slug) query.set('tenant_slug', params.tenant_slug);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return demoApi.get<DemoAdminPreviewResponse>(`/api/v2/demo/admin-preview${suffix}`, {
    baseUrlOverride: '/api',
  });
};

export const createDemoSession = async (payload: DemoSessionPayload) => {
  const response = await demoApi.post<DemoSessionResponse>('/api/v2/demo/session', payload, {
    baseUrlOverride: '/api',
  });
  const normalized = normalizeDemoSessionResponse(response);

  if (!isDemoSessionAlignedWithSelection(normalized, payload)) {
    throw new Error('La demo real recibida no coincide con la seleccion solicitada.');
  }

  return normalized;
};

const normalizeDemoSector = (value?: string | null): DemoSector => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('educ') || normalized.includes('coleg') || normalized.includes('escuela')) return 'educacion';
  if (normalized.includes('gob') || normalized.includes('muni') || normalized.includes('public')) return 'gobierno';
  if (normalized.includes('empresa') || normalized.includes('pyme') || normalized.includes('comerc')) return 'empresas';
  return (normalized || 'empresas') as DemoSector;
};

const normalizeDemoSessionResponse = (response: DemoSessionResponse): DemoSessionResponse => ({
  ...response,
  demo_session_id: response.demo_session_id ?? response.session_id ?? null,
  tenant_slug: response.tenant_slug ?? response.tenant?.slug ?? null,
  workspace: normalizeWorkspaceConfig(response),
});

const findAssetSectorFromResponse = (response: DemoSessionResponse): DemoSector | null => {
  const candidates = [
    response.tenant_slug,
    response.tenant?.slug,
    response.workspace?.chat_bootstrap?.payload?.tenant_slug,
    response.workspace?.chat_bootstrap?.query?.tenant_slug,
    ...(response.workspace?.catalog_resources ?? []).flatMap((resource) => [
      resource.id,
      resource.key,
      resource.href?.split('/').pop(),
      resource.url?.split('/').pop(),
    ]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const asset = findDemoCatalogAsset(candidate.trim());
    if (asset?.sector) return asset.sector;
  }

  return null;
};

const isDemoSessionAlignedWithSelection = (response: DemoSessionResponse, payload: DemoSessionPayload) => {
  const requestedSector = normalizeDemoSector(
    String(payload.sector ?? payload.pillar ?? payload.category_slug ?? payload.rubro ?? ''),
  );
  const requestedTenant = payload.tenant_slug?.trim();
  const responseTenant = response.tenant_slug ?? response.tenant?.slug ?? null;

  if (requestedTenant && responseTenant && requestedTenant !== responseTenant) return false;

  const responsePayload = response.workspace?.chat_bootstrap?.payload ?? response.chat_bootstrap?.payload ?? {};
  const explicitVertical = String(
    responsePayload.vertical ?? responsePayload.sector ?? responsePayload.pillar ?? '',
  ).trim();
  if (explicitVertical) {
    const normalizedVertical = normalizeDemoSector(explicitVertical);
    if (normalizedVertical !== requestedSector) return false;
  }

  const responseAssetSector = findAssetSectorFromResponse(response);
  if (responseAssetSector && responseAssetSector !== requestedSector) return false;

  return true;
};

const normalizeDemoCatalog = (response: DemoCatalogResponse): DemoCatalogResponse => {
  const incomingPillars = Array.isArray(response.pillars) ? response.pillars : [];
  const pillarSectors = incomingPillars
    .map((pillar) => pillar?.key ?? pillar?.sector ?? pillar?.slug)
    .filter((value): value is DemoSector => typeof value === 'string' && !!value);
  const incomingSectors = Array.isArray(response.sectors) ? response.sectors : [];
  const sectors = Array.from(new Set([...pillarSectors, ...incomingSectors]));
  const incomingGroups = Array.isArray(response.sector_groups)
    ? response.sector_groups.filter((group) => group?.key)
    : [];
  const groupMap = new Map<string, DemoSectorGroup>();

  incomingPillars.forEach((pillar) => {
    const key = String(pillar?.key ?? pillar?.sector ?? pillar?.slug ?? '');
    if (!key) return;
    groupMap.set(key, {
      key,
      label: pillar.label ?? null,
      description: pillar.description ?? null,
      cta_label: pillar.cta_label ?? null,
      tenant_slug: pillar.tenant_slug ?? pillar.demo_tenant_slug ?? pillar.default_tenant_slug ?? null,
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
