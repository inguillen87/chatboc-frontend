import { apiFetch, ApiError } from '@/utils/api';
import { normalizeEntityToken } from '@/utils/entityToken';
import type {
  TenantEventItem,
  TenantNewsItem,
  TenantPublicInfo,
  TenantSummary,
  TenantTicketPayload,
} from '@/types/tenant';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;


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
    throw new Error('El backend devolvió un formato inesperado para el espacio solicitado.');
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

  try {
    const response = await fetchWithFallback('/api/pwa/tenant-info');
    return normalizeTenantInfo(response, fallbackSlug, forceSlug);
  } catch (primaryError) {
    const shouldTrySecondaryFallback =
      primaryError instanceof ApiError && [404, 405].includes(primaryError.status);
    if (!shouldTrySecondaryFallback) {
      throw primaryError;
    }

    try {
      const response = await fetchWithFallback('/pwa/tenant-info');
      return normalizeTenantInfo(response, fallbackSlug, forceSlug);
    } catch (secondaryError) {
      throw secondaryError;
    }
  }
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
      if (!safeWidgetToken) {
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

export async function submitTenantTicket(
  slug: string,
  payload: TenantTicketPayload,
): Promise<{ ok: boolean; ticket_id?: number }> {
  return apiFetch('/app/tickets', {
    method: 'POST',
    body: payload,
    tenantSlug: slug,
    omitChatSessionId: true,
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
  });
}

export async function unfollowTenant(slug: string): Promise<void> {
  try {
    await apiFetch('/app/me/tenants/follow', {
      method: 'DELETE',
      body: { slug },
      tenantSlug: slug,
      omitChatSessionId: true,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 405) {
      await apiFetch('/app/me/tenants/unfollow', {
        method: 'POST',
        body: { slug },
        tenantSlug: slug,
        omitChatSessionId: true,
      });
      return;
    }
    throw error;
  }
}
