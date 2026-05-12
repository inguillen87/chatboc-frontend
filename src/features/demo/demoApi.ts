import { demoApi } from '@/api/v2/client';
import { getRubrosHierarchy } from '@/api/rubros';
import { DEMO_SECTOR_GROUPS } from '@/data/demoHierarchy';
import { findDemoCatalogAsset } from '@/data/demoCatalogAssets';
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

export type DemoSessionPayload = {
  sector?: DemoSector | string;
  pillar?: DemoSector | string;
  rubro?: string;
  rubro_slug?: string;
  category_slug?: string;
  tenant_slug?: string | null;
};

export const createDemoSession = async (payload: DemoSessionPayload) => {
  if (shouldUseLocalDemoSession(payload)) {
    return normalizeDemoSessionResponse(createLocalDemoSession(payload));
  }

  const response = await demoApi.post<DemoSessionResponse>('/api/v2/demo/session', payload, {
    baseUrlOverride: '/api',
  }).catch(() => createLocalDemoSession(payload));
  const normalized = normalizeDemoSessionResponse(response);

  return isDemoSessionAlignedWithSelection(normalized, payload)
    ? normalized
    : normalizeDemoSessionResponse(createLocalDemoSession(payload));
};

const normalizeDemoSector = (value?: string | null): DemoSector => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('educ') || normalized.includes('coleg') || normalized.includes('escuela')) return 'educacion';
  if (normalized.includes('gob') || normalized.includes('muni') || normalized.includes('public')) return 'gobierno';
  if (normalized.includes('empresa') || normalized.includes('pyme') || normalized.includes('comerc')) return 'empresas';
  return (normalized || 'empresas') as DemoSector;
};

const resolveLocalDemoGroup = (sector: DemoSector) =>
  DEMO_SECTOR_GROUPS.find((group) => String(group.key) === String(sector)) ?? DEMO_SECTOR_GROUPS[1];

const PLATFORM_DEMO_TENANTS = new Set([
  'municipio',
  'demo-municipio',
  'bodega',
  'colegio-demo',
  'colegios',
  'gobierno',
  'gobiernos',
  'empresas',
  'educacion',
]);

const shouldUseLocalDemoSession = (payload: DemoSessionPayload) => {
  const candidates = [
    payload.tenant_slug,
    payload.rubro_slug,
    payload.category_slug,
    payload.rubro,
    payload.sector,
    payload.pillar,
  ]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);

  if (candidates.some((candidate) => PLATFORM_DEMO_TENANTS.has(candidate))) return true;
  return candidates.some((candidate) => Boolean(findDemoCatalogAsset(candidate)));
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
  if ((response as any).local_demo_mode === true) return true;

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

const buildLocalQuickReplies = (asset: ReturnType<typeof findDemoCatalogAsset>, sector: DemoSector) => {
  const fallbackBySector: Record<string, string[]> = {
    educacion: ['Quiero justificar una inasistencia', 'Necesito un certificado', 'Consultar admisiones'],
    gobierno: ['Iniciar un reclamo', 'Consultar un tramite', 'Hablar con un operador'],
    empresas: ['Consultar disponibilidad', 'Tomar un pedido', 'Hablar con ventas'],
  };
  const questions = asset?.questions?.length ? asset.questions : fallbackBySector[String(sector)] ?? fallbackBySector.empresas;
  return questions.slice(0, 3).map((label, index) => ({
    id: `demo_local_${sector}_${index + 1}`,
    label,
    payload: label,
  }));
};

export const createLocalDemoSession = (payload: DemoSessionPayload): DemoSessionResponse & { local_demo_mode: true } => {
  const sector = normalizeDemoSector(String(payload.sector ?? payload.pillar ?? payload.category_slug ?? payload.rubro ?? 'empresas'));
  const group = resolveLocalDemoGroup(sector);
  const tenantSlug =
    payload.tenant_slug?.trim() ||
    group?.tenant_slug ||
    group?.demo_tenant_slug ||
    group?.default_tenant_slug ||
    null;
  const rubro = payload.rubro_slug || payload.rubro || payload.category_slug || group?.default_rubro || tenantSlug || String(sector);
  const asset =
    findDemoCatalogAsset(rubro) ||
    findDemoCatalogAsset(tenantSlug) ||
    findDemoCatalogAsset(group?.default_rubro) ||
    null;
  const demoSessionId = `local_demo_${String(sector)}_${Date.now().toString(36)}`;
  const title = asset?.title || group?.label || 'Demo Chatboc';
  const description =
    asset?.description ||
    group?.description ||
    'Probá cómo Chatboc atiende consultas, ordena pedidos y deja cada caso listo para seguimiento.';

  return {
    contract_version: 'demo.session.local.v1',
    request_id: demoSessionId,
    session_id: demoSessionId,
    demo_session_id: demoSessionId,
    tenant_slug: tenantSlug,
    tenant: {
      slug: tenantSlug,
      nombre: title,
      tipo: sector === 'gobierno' ? 'municipio' : 'pyme',
    },
    workspace: {
      title,
      welcome_message: `Hola, soy Chatboc. Podemos probar ${title.toLowerCase()} con consultas, adjuntos, seguimiento y derivación a una persona cuando haga falta.`,
      quick_replies: buildLocalQuickReplies(asset, sector),
      value_cards: [
        {
          key: 'consultas',
          title: 'Consultas guiadas',
          desc: 'Respuestas claras y próximos pasos para cada persona.',
          status: 'listo',
        },
        {
          key: 'seguimiento',
          title: 'Seguimiento simple',
          desc: 'Cada pedido o reclamo queda ordenado para continuar.',
          status: 'listo',
        },
        {
          key: 'equipo',
          title: 'Derivación humana',
          desc: 'Cuando el caso lo necesita, queda listo para el equipo.',
          status: 'listo',
        },
      ],
      catalog_resources: asset
        ? [
            {
              id: asset.slug,
              label: 'Descargar catalogo',
              title: asset.title,
              href: asset.href,
              action: 'download',
            },
          ]
        : [],
      media_capabilities: {
        input_modes: {
          text: { enabled: true, payload_key: 'pregunta' },
          image: { enabled: true },
          audio: { enabled: true },
          location: { enabled: true },
          file: { enabled: true },
        },
      } as any,
      conversion_ctas: {
        actions: buildLocalQuickReplies(asset, sector).map((item) => ({
          id: item.id,
          label: item.label,
          intent: item.payload,
          style: 'secondary',
        })),
      } as any,
      sample_conversations: buildLocalQuickReplies(asset, sector).map((item) => ({
        id: item.id,
        title: item.label,
        text: item.label,
      })),
      trust_signals: [
        { id: 'always_on', title: 'Disponible 24/7', text: 'La demo responde sin esperar configuración adicional.' },
        { id: 'human_handoff', title: 'Equipo incluido', text: 'Los casos importantes pueden pasar a una persona.' },
      ],
      chat_bootstrap: null,
    },
    chat_bootstrap: null,
    local_demo_mode: true,
  };
};

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
