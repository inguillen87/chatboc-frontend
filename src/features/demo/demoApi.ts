import { demoApi } from '@/api/v2/client';
import { findDemoCatalogAsset } from '@/data/demoCatalogAssets';
import { normalizeDemoResourceUrlsDeep } from '@/utils/demoResourceUrls';
import { persistDemoRuntimeStorage } from './demoStorage';
import type {
  DemoAdminPreviewResponse,
  DemoCatalogResponse,
  DemoChatBootstrap,
  DemoSectorGroup,
  DemoSessionResponse,
  DemoSector,
  DemoWorkspaceConfig,
  DemoWhatsappSandboxResponse,
} from './demoTypes';

export const getDemoCatalog = async (): Promise<DemoCatalogResponse> => {
  const query = new URLSearchParams({ response_profile: 'selector' });
  return normalizeDemoCatalog(
    await demoApi.get<DemoCatalogResponse>(`/api/v2/demo/catalog?${query.toString()}`),
  );
};

export type DemoSessionPayload = {
  sector?: DemoSector | string;
  pillar?: DemoSector | string;
  rubro?: string;
  rubro_slug?: string;
  category_slug?: string;
  tenant_slug?: string | null;
  label?: string | null;
  surface?: string | null;
  source?: string | null;
  anon_id?: string | null;
  chat_session_id?: string | null;
};

export type DemoWhatsappSandboxPayload = {
  sector?: DemoSector | string | null;
  rubro?: string | null;
  tenant_slug?: string | null;
  source?: string | null;
};

export const getDemoAdminPreview = async (params: {
  sector?: DemoSector | string | null;
  tenant_slug?: string | null;
  chat_session_id?: string | null;
  demo_session_id?: string | null;
}): Promise<DemoAdminPreviewResponse> => {
  const query = new URLSearchParams();
  if (params.sector) query.set('sector', String(params.sector));
  if (params.tenant_slug) query.set('tenant_slug', params.tenant_slug);
  if (params.chat_session_id) query.set('chat_session_id', params.chat_session_id);
  if (params.demo_session_id) query.set('demo_session_id', params.demo_session_id);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return demoApi.get<DemoAdminPreviewResponse>(`/api/v2/demo/admin-preview${suffix}`, {
    baseUrlOverride: '/api',
  });
};

export const createDemoSession = async (
  payload: DemoSessionPayload,
  options: { strictSelection?: boolean } = {},
) => {
  const response = await demoApi.post<DemoSessionResponse>('/api/v2/demo/session', payload, {
    baseUrlOverride: '/api',
  });
  const normalized = normalizeDemoSessionResponse(response);
  const isRubroSelectionStep = isDemoRubroSelectionStep(normalized);
  if (!isUsableDemoSessionResponse(normalized)) {
    throw new Error('La demo real no devolvio sesion de chat utilizable.');
  }
  if (isWidgetDemoSelectorPayload(payload) && !isRubroSelectionStep) {
    if (normalized.widget_onboarding?.open_chat !== true) {
      throw new Error('La demo real no autorizo abrir el chat.');
    }
  }

  if (options.strictSelection !== false && !isDemoSessionAlignedWithSelection(normalized, payload)) {
    throw new Error('La demo real recibida no coincide con la seleccion solicitada.');
  }

  if (!isRubroSelectionStep) {
    persistDemoRuntimeSession(normalized);
  }

  return normalized;
};

const isWidgetDemoSelectorPayload = (payload: DemoSessionPayload) => {
  if (!payload || typeof payload !== 'object') return false;
  const source = String((payload as Record<string, unknown>).source ?? '').trim();
  return (
    (payload as Record<string, unknown>).surface === 'widget' &&
    (source === 'landing_widget_selector' || source === 'landing_widget_rubro_selector')
  );
};

export const getDemoWhatsappSandbox = async (
  params: DemoWhatsappSandboxPayload = {},
): Promise<DemoWhatsappSandboxResponse> => {
  const query = new URLSearchParams();
  if (params.sector) query.set('sector', String(params.sector));
  if (params.rubro) query.set('rubro', String(params.rubro));
  if (params.tenant_slug) query.set('tenant_slug', String(params.tenant_slug));
  if (params.source) query.set('source', String(params.source));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return normalizeDemoWhatsappSandboxResponse(
    await demoApi.get<DemoWhatsappSandboxResponse>(`/api/v2/demo/whatsapp-sandbox${suffix}`, {
      baseUrlOverride: '/api',
    }),
  );
};

export const createDemoWhatsappSandbox = async (
  payload: DemoWhatsappSandboxPayload = {},
): Promise<DemoWhatsappSandboxResponse> => {
  return normalizeDemoWhatsappSandboxResponse(
    await demoApi.post<DemoWhatsappSandboxResponse>('/api/v2/demo/whatsapp-sandbox', payload, {
      baseUrlOverride: '/api',
    }),
  );
};

const normalizeDemoSector = (value?: string | null): DemoSector => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('educ') || normalized.includes('coleg') || normalized.includes('escuela')) return 'educacion';
  if (normalized.includes('gob') || normalized.includes('muni') || normalized.includes('public')) return 'gobierno';
  if (normalized.includes('empresa') || normalized.includes('pyme') || normalized.includes('comerc')) return 'empresas';
  return (normalized || 'empresas') as DemoSector;
};

const normalizeDemoSessionResponse = (response: DemoSessionResponse): DemoSessionResponse => {
  const session = response.session && typeof response.session === 'object' ? response.session : null;
  const chatSessionId =
    readShortChatSessionId(response.chat_session_id) ??
    readShortChatSessionId(response.session_id) ??
    readShortChatSessionId(session?.chat_session_id) ??
    readShortChatSessionId(session?.session_id) ??
    readChatSessionIdFromBootstrap(response.workspace?.chat_bootstrap) ??
    readChatSessionIdFromBootstrap(response.chat_bootstrap) ??
    readChatSessionIdFromBootstrap(response.workspace?.chat_seed?.chat_bootstrap) ??
    readChatSessionIdFromBootstrap(response.chat_seed?.chat_bootstrap);
  const demoSessionId =
    readString(response.demo_session_id) ??
    readString(session?.demo_session_id) ??
    readString(response.workspace?.chat_bootstrap?.session?.demo_session_id) ??
    readString(response.chat_bootstrap?.session?.demo_session_id);
  const tenantSlug =
    response.tenant?.slug ??
    response.tenant_slug ??
    (typeof session?.tenant_slug === 'string' ? session.tenant_slug : null) ??
    null;

  return {
    ...response,
    demo_session_id: demoSessionId ?? undefined,
    chat_session_id: chatSessionId,
    tenant_slug: tenantSlug,
    session: session
      ? {
          ...session,
          demo_session_id: demoSessionId ?? session.demo_session_id ?? null,
          chat_session_id: chatSessionId ?? null,
        }
      : session,
    workspace: normalizeWorkspaceConfig(response, {
      chatSessionId,
      demoSessionId,
      tenantSlug,
    }),
  };
};

const normalizeDemoWhatsappSandboxResponse = (
  response: DemoWhatsappSandboxResponse,
): DemoWhatsappSandboxResponse => {
  const session = response.session && typeof response.session === 'object' ? response.session : null;
  const chatSessionId =
    readShortChatSessionId(session?.chat_session_id) ??
    readShortChatSessionId(session?.session_id);

  return {
    ...response,
    session: session
      ? {
          ...session,
          chat_session_id: chatSessionId ?? null,
        }
      : session,
    whatsapp_sandbox: response.whatsapp_sandbox
      ? {
          ...response.whatsapp_sandbox,
          rubro_options: Array.isArray(response.whatsapp_sandbox.rubro_options)
            ? response.whatsapp_sandbox.rubro_options
            : [],
          scenario_scripts: Array.isArray(response.whatsapp_sandbox.scenario_scripts)
            ? response.whatsapp_sandbox.scenario_scripts
            : [],
          catalog: response.whatsapp_sandbox.catalog ?? null,
          surveys_votings: response.whatsapp_sandbox.surveys_votings ?? null,
        }
      : null,
  };
};

const persistDemoRuntimeSession = (response: DemoSessionResponse) => {
  persistDemoRuntimeStorage(response);
};

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
  const requestedSectorRaw = [payload.sector, payload.pillar, payload.category_slug, payload.rubro]
    .map((value) => String(value ?? '').trim())
    .find((value) => value.length > 0);
  const requestedSector = requestedSectorRaw ? normalizeDemoSector(requestedSectorRaw) : null;

  const responsePayload = response.workspace?.chat_bootstrap?.payload ?? response.chat_bootstrap?.payload ?? {};
  const explicitVertical = String(
    responsePayload.vertical ?? responsePayload.sector ?? responsePayload.pillar ?? '',
  ).trim();
  if (explicitVertical) {
    const normalizedVertical = normalizeDemoSector(explicitVertical);
    if (requestedSector && normalizedVertical !== requestedSector) return false;
  }

  const responseAssetSector = findAssetSectorFromResponse(response);
  if (requestedSector && responseAssetSector && responseAssetSector !== requestedSector) return false;

  return true;
};

const isUsableDemoSessionResponse = (response: DemoSessionResponse) => {
  if (response.ok === false) return false;
  if (isDemoRubroSelectionStep(response)) return true;

  const chatSessionId =
    readShortChatSessionId(response.chat_session_id) ??
    readShortChatSessionId(response.session?.chat_session_id) ??
    readShortChatSessionId(response.session?.session_id) ??
    readChatSessionIdFromBootstrap(response.workspace?.chat_bootstrap) ??
    readChatSessionIdFromBootstrap(response.chat_bootstrap) ??
    readChatSessionIdFromBootstrap(response.workspace?.chat_seed?.chat_bootstrap) ??
    readChatSessionIdFromBootstrap(response.chat_seed?.chat_bootstrap);
  const chatBootstrap =
    response.workspace?.chat_bootstrap ??
    response.chat_bootstrap ??
    response.workspace?.chat_seed?.chat_bootstrap ??
    response.chat_seed?.chat_bootstrap ??
    null;

  return Boolean(chatSessionId && chatBootstrap);
};

const isDemoRubroSelectionStep = (response: DemoSessionResponse) => {
  const nextStep = String(response.next_step ?? response.frontend_contract?.next_step ?? '').trim().toLowerCase();
  const onboardingStatus = String(response.widget_onboarding?.status ?? '').trim().toLowerCase();
  const renderAs = String(response.frontend_contract?.render_as ?? response.workspace?.rubro_selector?.render_as ?? '').trim().toLowerCase();
  const categories = response.workspace?.rubro_selector?.categories;

  return Boolean(
    response.requires_rubro_selection === true ||
      nextStep === 'select_rubro' ||
      onboardingStatus === 'select_rubro' ||
      renderAs === 'demo_rubro_selector' ||
      (renderAs === 'rubro_selector' && Array.isArray(categories)),
  );
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

const normalizeWorkspaceConfig = (
  response: DemoSessionResponse,
  context: {
    chatSessionId?: string | null;
    demoSessionId?: string | null;
    tenantSlug?: string | null;
  } = {},
): DemoWorkspaceConfig | null => {
  const workspace: DemoWorkspaceConfig = response.workspace ?? {};
  const quickReplies = workspace.quick_replies ?? response.quick_replies ?? [];
  const valueCards = workspace.value_cards ?? response.value_cards ?? [];
  const catalogResources = normalizeDemoResourceUrlsDeep(
    workspace.catalog_resources ?? (response as any).catalog_resources ?? [],
  );
  const welcomeMessage = workspace.welcome_message ?? response.welcome_message ?? null;
  const rubroSelector = workspace.rubro_selector ?? null;
  const defaultMenu = workspace.default_menu ?? (response as any).default_menu ?? null;
  const quickMenu = workspace.quick_menu ?? (response as any).quick_menu ?? null;
  const rubroContext = workspace.rubro_context ?? (response as any).rubro_context ?? null;
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
      demoSessionId: context.demoSessionId ?? response.demo_session_id ?? null,
      chatSessionId:
        readShortChatSessionId(context.chatSessionId) ??
        readShortChatSessionId(response.chat_session_id) ??
        readShortChatSessionId(response.session_id),
      tenantSlug: context.tenantSlug ?? response.tenant?.slug ?? response.tenant_slug ?? null,
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
    !rubroSelector &&
    !defaultMenu &&
    !quickMenu &&
    !rubroContext &&
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
    !workspace.rubro_tools &&
    !workspace.business_tools &&
    !workspace.operational_tools &&
    !workspace.tools &&
    !workspace.toolkit &&
    !chatBootstrap
  ) {
    return null;
  }

  return {
    title: workspace.title ?? null,
    welcome_message: welcomeMessage,
    rubro: workspace.rubro ?? null,
    rubro_clave: workspace.rubro_clave ?? null,
    rubro_context: rubroContext,
    rubro_selector: rubroSelector,
    default_menu: defaultMenu,
    quick_menu: quickMenu,
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
    rubro_tools: normalizeDemoResourceUrlsDeep(workspace.rubro_tools ?? null),
    business_tools: normalizeDemoResourceUrlsDeep(workspace.business_tools ?? null),
    operational_tools: normalizeDemoResourceUrlsDeep(workspace.operational_tools ?? null),
    tools: normalizeDemoResourceUrlsDeep(workspace.tools ?? null),
    toolkit: normalizeDemoResourceUrlsDeep(workspace.toolkit ?? null),
    chat_bootstrap: chatBootstrap,
    chat_seed: workspace.chat_seed ?? response.chat_seed ?? null,
  };
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const readShortChatSessionId = (value: unknown): string | null => {
  const trimmed = readString(value);
  if (!trimmed) return null;
  return trimmed.length <= 64 && !trimmed.includes('.') ? trimmed : null;
};

const readChatSessionIdFromBootstrap = (bootstrap?: DemoChatBootstrap | null): string | null => {
  if (!bootstrap || typeof bootstrap !== 'object') return null;
  const headers = bootstrap.headers && typeof bootstrap.headers === 'object' ? bootstrap.headers : {};
  const payload = bootstrap.payload && typeof bootstrap.payload === 'object' ? bootstrap.payload : {};
  const query = bootstrap.query && typeof bootstrap.query === 'object' ? bootstrap.query : {};
  const session = bootstrap.session && typeof bootstrap.session === 'object' ? bootstrap.session : {};
  return (
    readShortChatSessionId(session.chat_session_id) ??
    readShortChatSessionId(session.session_id) ??
    readShortChatSessionId(headers['X-Chat-Session-Id']) ??
    readShortChatSessionId(payload.chat_session_id) ??
    readShortChatSessionId(payload.session_id) ??
    readShortChatSessionId(query.chat_session_id) ??
    readShortChatSessionId(query.session_id)
  );
};

const normalizeChatBootstrap = (
  value: DemoChatBootstrap | null,
  context?: { demoSessionId?: string | null; chatSessionId?: string | null; tenantSlug?: string | null },
): DemoChatBootstrap | null => {
  if (!value || typeof value !== 'object') return null;
  const headers = value.headers && typeof value.headers === 'object' ? { ...value.headers } : {};
  const payload = value.payload && typeof value.payload === 'object' ? { ...value.payload } : undefined;
  const query = value.query && typeof value.query === 'object' ? { ...value.query } : undefined;
  const session = value.session && typeof value.session === 'object' ? { ...value.session } : {};
  const demoSessionId =
    context?.demoSessionId ??
    (typeof session.demo_session_id === 'string' ? session.demo_session_id : null) ??
    (typeof payload?.demo_session_id === 'string' ? payload.demo_session_id : null) ??
    (typeof query?.demo_session_id === 'string' ? query.demo_session_id : null);
  const chatSessionId =
    readShortChatSessionId(context?.chatSessionId) ??
    readShortChatSessionId(session.chat_session_id) ??
    readShortChatSessionId(headers['X-Chat-Session-Id']) ??
    readShortChatSessionId(payload?.chat_session_id) ??
    readShortChatSessionId(payload?.session_id) ??
    readShortChatSessionId(query?.chat_session_id) ??
    readShortChatSessionId(query?.session_id);
  const tenantSlug =
    context?.tenantSlug ??
    (typeof payload?.tenant_slug === 'string' ? payload.tenant_slug : null) ??
    (typeof query?.tenant_slug === 'string' ? query.tenant_slug : null);

  if (headers['X-Chat-Session-Id'] && !readShortChatSessionId(headers['X-Chat-Session-Id'])) {
    delete headers['X-Chat-Session-Id'];
  }
  if (payload?.chat_session_id && !readShortChatSessionId(payload.chat_session_id)) delete payload.chat_session_id;
  if (payload?.session_id && !readShortChatSessionId(payload.session_id)) delete payload.session_id;
  if (query) {
    delete query.chat_session_id;
    delete query.session_id;
    delete query.demo_session_id;
    delete query.demoSessionId;
    delete query.session;
  }

  if (demoSessionId) {
    headers['X-Demo-Session-Id'] ||= demoSessionId;
    headers['X-Demo-Session'] ||= demoSessionId;
    session.demo_session_id ||= demoSessionId;
    if (payload && !payload.demo_session_id) payload.demo_session_id = demoSessionId;
  }
  if (chatSessionId) {
    headers['X-Chat-Session-Id'] ||= chatSessionId;
    session.chat_session_id ||= chatSessionId;
    if (payload && !payload.chat_session_id) payload.chat_session_id = chatSessionId;
  }
  if (tenantSlug) {
    headers['X-Tenant-Slug'] ||= tenantSlug;
    if (payload && !payload.tenant_slug) payload.tenant_slug = tenantSlug;
    if (payload && !payload.tenant) payload.tenant = tenantSlug;
    if (query && !query.tenant_slug) query.tenant_slug = tenantSlug;
    if (query && !query.tenant) query.tenant = tenantSlug;
  }

  return {
    contract_version: typeof value.contract_version === 'string' ? value.contract_version : null,
    endpoint: typeof value.endpoint === 'string' ? value.endpoint : null,
    same_origin_endpoint: typeof value.same_origin_endpoint === 'string' ? value.same_origin_endpoint : null,
    fallback_endpoint: typeof value.fallback_endpoint === 'string' ? value.fallback_endpoint : null,
    method: typeof value.method === 'string' ? value.method : null,
    headers: Object.keys(headers).length ? headers : undefined,
    query,
    payload,
    default_menu: value.default_menu,
    quick_menu: value.quick_menu,
    session: Object.keys(session).length ? session : undefined,
    empty_states: value.empty_states && typeof value.empty_states === 'object' ? value.empty_states : undefined,
    supports: value.supports && typeof value.supports === 'object' ? value.supports : undefined,
  };
};
