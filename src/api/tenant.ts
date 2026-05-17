import { apiFetch, ApiError } from '@/utils/api';
import { SAME_ORIGIN_PROXY_BASE } from '@/config';
import { normalizeEntityToken } from '@/utils/entityToken';
import type {
  TenantEventItem,
  TenantNewsItem,
  TenantPublicNavigationContract,
  TenantPublicNavigationItem,
  TenantPublicInfo,
  TenantSummary,
  TenantTicketPayload,
} from '@/types/tenant';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const SAME_ORIGIN_API_BASE = SAME_ORIGIN_PROXY_BASE || '/api';

const shouldLogFallbackWarnings = () => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined;
  return Boolean(metaEnv?.DEV || metaEnv?.MODE === 'development');
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
};

const coerceBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const coerceNumberOrString = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
};

const coerceTenantSummary = (input: unknown): TenantSummary | null => {
  if (!isRecord(input)) return null;

  const candidate = input as Record<string, unknown>;
  const tenantData = isRecord(candidate.tenant) ? candidate.tenant : candidate;
  const slug = coerceString(tenantData.slug) ?? coerceString(candidate.tenant_slug) ?? coerceString(candidate.slug);

  if (!slug) {
    return null;
  }

  return {
    slug,
    nombre:
      coerceString(tenantData.nombre) ??
      coerceString(candidate.nombre) ??
      coerceString(candidate.tenant_nombre) ??
      null,
    logo_url:
      coerceString(tenantData.logo_url) ??
      coerceString(candidate.logo_url) ??
      coerceString(candidate.logoUrl) ??
      null,
    tenant_id:
      (tenantData.id as number | string | undefined) ??
      coerceNumberOrString(candidate.tenant_id) ??
      coerceNumberOrString(candidate.id) ??
      null,
    tipo:
      coerceString(tenantData.tipo) ??
      coerceString(candidate.tipo) ??
      coerceString(candidate.tenant_tipo) ??
      null,
  };
};

const normalizeTenantInfo = (
  payload: unknown,
  fallbackSlug: string,
  forceSlug?: string | null,
): TenantPublicInfo => {
  if (!isRecord(payload)) {
    throw new Error('No pudimos cargar el espacio solicitado en este momento.');
  }

  const contractVersion =
    typeof payload.contract_version === 'string' ? payload.contract_version.trim() : '';
  if (contractVersion && contractVersion !== 'public.tenant_profile.v1') {
    throw new Error(`Contract version inválida para tenant-profile: ${contractVersion}`);
  }

  const source = isRecord(payload.tenant) ? payload.tenant : payload;

  const slug = forceSlug ?? coerceString(source.slug) ?? coerceString(payload.slug) ?? fallbackSlug;
  if (!slug) {
    throw new Error('No se pudo identificar el tenant solicitado.');
  }

  const nombre = coerceString(source.nombre) ?? coerceString(payload.nombre) ?? slug;

  return {
    slug,
    nombre,
    logo_url:
      coerceString(source.logo_url) ??
      coerceString(source.logoUrl) ??
      coerceString(source.logo) ??
      coerceString(payload.logo_url) ??
      null,
    tema: isRecord(source.tema)
      ? (source.tema as Record<string, unknown>)
      : isRecord(payload.tema)
        ? (payload.tema as Record<string, unknown>)
        : null,
    tipo: coerceString(source.tipo) ?? coerceString(payload.tipo) ?? null,
    descripcion: coerceString(source.descripcion) ?? coerceString(payload.descripcion) ?? null,
    public_base_url:
      coerceString(source.public_base_url) ??
      coerceString(source.publicBaseUrl) ??
      coerceString(source.public_base) ??
      coerceString(source.publicBase) ??
      coerceString(source.public_url) ??
      coerceString(source.publicUrl) ??
      null,
    public_cart_url:
      coerceString(source.public_cart_url) ??
      coerceString(source.publicCartUrl) ??
      coerceString(source.cart_url) ??
      coerceString(source.cartUrl) ??
      null,
    public_catalog_url:
      coerceString(source.public_catalog_url) ??
      coerceString(source.publicCatalogUrl) ??
      coerceString(source.catalog_url) ??
      coerceString(source.catalogUrl) ??
      null,
    whatsapp_share_url:
      coerceString(source.whatsapp_share_url) ??
      coerceString(source.whatsappShareUrl) ??
      null,
    cta_messages: Array.isArray(source.cta_messages)
      ? (source.cta_messages as any[])
      : Array.isArray(payload.cta_messages)
        ? (payload.cta_messages as any[])
        : undefined,
    theme_config: isRecord(source.theme_config)
      ? (source.theme_config as any)
      : isRecord(payload.theme_config)
        ? (payload.theme_config as any)
        : undefined,
    default_open: Boolean(source.default_open ?? payload.default_open),
  };
};

const normalizeNewsItem = (input: unknown): TenantNewsItem | null => {
  if (!isRecord(input)) return null;
  const titulo = coerceString(input.titulo) ?? coerceString(input.title);
  if (!titulo) return null;

  const id = coerceNumberOrString(input.id) ?? titulo;
  return {
    id,
    titulo,
    resumen: coerceString(input.resumen) ?? coerceString(input.summary) ?? null,
    body: coerceString(input.body) ?? coerceString(input.contenido) ?? null,
    cover_url:
      coerceString(input.cover_url) ??
      coerceString(input.coverUrl) ??
      coerceString(input.imagen) ??
      null,
    publicado_at: coerceString(input.publicado_at) ?? coerceString(input.published_at) ?? null,
    tags: Array.isArray(input.tags)
      ? (input.tags.filter((tag) => typeof tag === 'string') as string[])
      : null,
  };
};

const normalizeEventItem = (input: unknown): TenantEventItem | null => {
  if (!isRecord(input)) return null;
  const titulo = coerceString(input.titulo) ?? coerceString(input.title);
  if (!titulo) return null;

  const id = coerceNumberOrString(input.id) ?? titulo;
  return {
    id,
    titulo,
    descripcion: coerceString(input.descripcion) ?? coerceString(input.description) ?? null,
    cover_url:
      coerceString(input.cover_url) ??
      coerceString(input.coverUrl) ??
      coerceString(input.imagen) ??
      null,
    starts_at: coerceString(input.starts_at) ?? coerceString(input.start_at) ?? coerceString(input.fecha_inicio) ?? null,
    ends_at: coerceString(input.ends_at) ?? coerceString(input.end_at) ?? coerceString(input.fecha_fin) ?? null,
    lugar: coerceString(input.lugar) ?? coerceString(input.location) ?? null,
    tags: Array.isArray(input.tags)
      ? (input.tags.filter((tag) => typeof tag === 'string') as string[])
      : null,
  };
};

export async function getTenantPublicInfo(slug: string): Promise<TenantPublicInfo> {
  const response = await apiFetch<unknown>('/public/tenant', {
    tenantSlug: slug,
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
  });

  return normalizeTenantInfo(response, slug);
}

const PLACEHOLDER_SLUGS = new Set(['iframe', 'embed', 'widget']);

const sanitizeTenant = (raw?: string | null) => {
  if (!raw) return null;
  const normalized = raw.trim();
  if (!normalized) return null;
  return PLACEHOLDER_SLUGS.has(normalized.toLowerCase()) ? null : normalized;
};

type TenantResolveOptions = {
  slug?: string | null;
  widgetToken?: string | null;
  forceSlug?: string | null;
};

const normalizePublicNavigationItem = (input: unknown): TenantPublicNavigationItem | null => {
  if (!isRecord(input)) return null;
  const label = coerceString(input.label) ?? coerceString(input.title) ?? coerceString(input.name);
  const route = coerceString(input.route) ?? coerceString(input.path) ?? coerceString(input.url);
  const id = coerceString(input.id) ?? coerceString(input.key) ?? label ?? route;
  if (!id || !label) return null;

  const explicitEnabled = coerceBoolean(input.enabled);
  const explicitDisabled = coerceBoolean(input.disabled);
  const visible = coerceBoolean(input.visible);

  return {
    ...(input as Record<string, unknown>),
    id,
    label,
    route: route ?? null,
    href: coerceString(input.href) ?? null,
    endpoint: coerceString(input.endpoint) ?? null,
    enabled: explicitEnabled ?? (explicitDisabled === true ? false : true),
    visible: visible ?? true,
    reason_code: coerceString(input.reason_code) ?? null,
    disabled_reason: coerceString(input.disabled_reason) ?? coerceString(input.reason) ?? null,
  };
};

const normalizePublicNavigation = (
  input: unknown,
  fallbackSlug: string,
): TenantPublicNavigationContract => {
  if (!isRecord(input)) {
    return { contract_version: null, tenant_slug: fallbackSlug, items: [] };
  }

  const rawItems = Array.isArray(input.items)
    ? input.items
    : Array.isArray(input.navigation)
      ? input.navigation
      : Array.isArray(input.menu)
        ? input.menu
        : [];

  return {
    contract_version: coerceString(input.contract_version) ?? null,
    tenant_slug:
      (isRecord(input.tenant) ? coerceString(input.tenant.slug) : undefined) ??
      coerceString(input.tenant_slug) ??
      fallbackSlug,
    items: rawItems
      .map((item) => normalizePublicNavigationItem(item))
      .filter((item): item is TenantPublicNavigationItem => Boolean(item)),
    request_id: coerceString(input.request_id) ?? null,
    reason_code: coerceString(input.reason_code) ?? null,
  };
};

const isPwaTenantResolutionFailure = (error: unknown) =>
  error instanceof ApiError &&
  isRecord(error.body) &&
  error.body.contract_version === 'pwa.public_tenant_resolution.v1' &&
  error.body.reason_code === 'tenant_resolution_failed';

const shouldTryTenantInfoFallback = (error: unknown) =>
  error instanceof ApiError &&
  !isPwaTenantResolutionFailure(error) &&
  (error.status === 404 || error.status === 405 || error.status === 501);

const resolveTenantInfo = async ({
  slug,
  widgetToken,
  forceSlug,
}: TenantResolveOptions): Promise<TenantPublicInfo> => {
  const params = new URLSearchParams();
  if (slug) params.set('tenant', slug);
  if (widgetToken) params.set('widget_token', widgetToken);

  const fallbackSlug = slug ?? widgetToken ?? '';

  const fetchWithFallback = async (endpoint: string) => {
    return await apiFetch<unknown>(`${endpoint}${params.toString() ? `?${params.toString()}` : ''}`, {
      tenantSlug: slug ?? undefined,
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitChatSessionId: true,
      sendAnonId: true,
      omitEntityToken: true,
    });
  };

  const endpoints = ['/api/pwa/public/tenant-info', '/api/pwa/tenant-info', '/pwa/tenant-info'];
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithFallback(endpoint);
      return normalizeTenantInfo(response, fallbackSlug, forceSlug);
    } catch (error) {
      lastError = error;
      if (!shouldTryTenantInfoFallback(error)) {
        break;
      }
    }
  }

  throw lastError ?? new Error('No se pudo resolver el tenant solicitado.');
};

export async function getTenantPublicInfoFlexible(
  slug?: string | null,
  widgetToken?: string | null,
): Promise<TenantPublicInfo> {
  const safeSlug = sanitizeTenant(slug);
  const safeWidgetToken = normalizeEntityToken(widgetToken) ?? null;

  if (safeSlug) {
    try {
      // Prioriza la resolución por slug explícito sin el widget token para evitar cruces de tenant.
      return await resolveTenantInfo({ slug: safeSlug, forceSlug: safeSlug });
    } catch (slugError) {
      if (!safeWidgetToken || isPwaTenantResolutionFailure(slugError)) {
        throw slugError;
      }

      // Si el slug falló, probamos con el widget token como alternativa.
      const info = await resolveTenantInfo({
        slug: safeSlug,
        widgetToken: safeWidgetToken,
        forceSlug: safeSlug,
      });

      if (info.slug !== safeSlug) {
        return { ...info, slug: safeSlug };
      }

      return info;
    }
  }

  if (safeWidgetToken) {
    return resolveTenantInfo({ widgetToken: safeWidgetToken });
  }

  throw new Error('No se pudo identificar el tenant solicitado.');
}

export async function listTenantNews(slug: string): Promise<TenantNewsItem[]> {
  try {
    const response = await apiFetch<unknown>('/public/news', {
      tenantSlug: slug,
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitChatSessionId: true,
    });

    if (!Array.isArray(response)) {
      return [];
    }

    return response
      .map((item) => normalizeNewsItem(item))
      .filter((item): item is TenantNewsItem => Boolean(item));
  } catch (error) {
     if (shouldLogFallbackWarnings()) {
       console.warn(`[API] Failed to fetch news for ${slug}.`, error);
     }
     return [];
  }
}

export async function listTenantEvents(slug: string): Promise<TenantEventItem[]> {
  try {
    const response = await apiFetch<unknown>('/public/events', {
      tenantSlug: slug,
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitChatSessionId: true,
    });

    if (!Array.isArray(response)) {
      return [];
    }

    return response
      .map((item) => normalizeEventItem(item))
      .filter((item): item is TenantEventItem => Boolean(item));
  } catch (error) {
    if (shouldLogFallbackWarnings()) {
      console.warn(`[API] Failed to fetch events for ${slug}.`, error);
    }
    return [];
  }
}

export async function getTenantPublicNavigation(slug: string): Promise<TenantPublicNavigationContract> {
  const normalized = slug.trim();
  const encoded = encodeURIComponent(normalized);
  const options = {
    tenantSlug: normalized,
    skipAuth: true,
    omitCredentials: true,
    isWidgetRequest: true,
    omitChatSessionId: true,
    omitEntityToken: true,
  } as const;

  const response = await apiFetch<unknown>(`/api/public/tenants/${encoded}/public-navigation`, options);
  return normalizePublicNavigation(response, normalized);
}

export async function submitTenantTicket(
  slug: string,
  payload: TenantTicketPayload,
): Promise<{ ok: boolean; ticket_id?: number }> {
  return apiFetch('/app/tickets', {
    method: 'POST',
    body: payload,
    tenantSlug: slug,
    omitChatSessionId: true,
    baseUrlOverride: SAME_ORIGIN_API_BASE,
  });
}

const extractTenantArray = (input: unknown): unknown[] => {
  if (Array.isArray(input)) {
    return input;
  }
  if (isRecord(input)) {
    if (Array.isArray(input.items)) return input.items;
    if (Array.isArray(input.tenants)) return input.tenants;
    if (Array.isArray(input.data)) return input.data;
  }
  return [];
};

export async function listFollowedTenants(
  tenantSlug?: string | null,
  widgetToken?: string | null,
): Promise<TenantSummary[]> {
  try {
    const response = await apiFetch<unknown>('/app/me/tenants', {
      tenantSlug: tenantSlug ?? null,
      entityToken: widgetToken ?? undefined,
      isWidgetRequest: Boolean(widgetToken),
      omitChatSessionId: true,
      suppressPanel401Redirect: true,
      baseUrlOverride: SAME_ORIGIN_API_BASE,
    });

    return extractTenantArray(response)
      .map((item) => coerceTenantSummary(item))
      .filter((item): item is TenantSummary => Boolean(item));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return [];
    }
    throw error;
  }
}

export async function followTenant(slug: string): Promise<void> {
  await apiFetch('/app/me/tenants/follow', {
    method: 'POST',
    body: { slug },
    tenantSlug: slug,
    omitChatSessionId: true,
    baseUrlOverride: SAME_ORIGIN_API_BASE,
  });
}

export async function unfollowTenant(slug: string): Promise<void> {
  try {
    await apiFetch('/app/me/tenants/follow', {
      method: 'DELETE',
      body: { slug },
      tenantSlug: slug,
      omitChatSessionId: true,
      baseUrlOverride: SAME_ORIGIN_API_BASE,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 405) {
      await apiFetch('/app/me/tenants/unfollow', {
        method: 'POST',
        body: { slug },
        tenantSlug: slug,
        omitChatSessionId: true,
        baseUrlOverride: SAME_ORIGIN_API_BASE,
      });
      return;
    }
    throw error;
  }
}
