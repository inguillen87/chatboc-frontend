import { apiFetch, ApiError } from '@/utils/api';
import type {
  TenantEventItem,
  TenantNewsItem,
  TenantPublicInfo,
  TenantSummary,
  TenantTicketPayload,
} from '@/types/tenant';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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
): TenantPublicInfo => {
  if (!isRecord(payload)) {
    throw new Error('El backend devolvió un formato inesperado para el espacio solicitado.');
  }

  const slug = coerceString(payload.slug) ?? fallbackSlug;
  if (!slug) {
    throw new Error('No se pudo identificar el tenant solicitado.');
  }

  const nombre = coerceString(payload.nombre) ?? slug;

  return {
    slug,
    nombre,
    logo_url:
      coerceString(payload.logo_url) ??
      coerceString(payload.logoUrl) ??
      coerceString(payload.logo) ??
      null,
    tema: isRecord(payload.tema) ? (payload.tema as Record<string, unknown>) : null,
    tipo: coerceString(payload.tipo) ?? null,
    descripcion: coerceString(payload.descripcion) ?? null,
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

export async function listTenantNews(slug: string): Promise<TenantNewsItem[]> {
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
}

export async function listTenantEvents(slug: string): Promise<TenantEventItem[]> {
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

export async function listFollowedTenants(): Promise<TenantSummary[]> {
  try {
    const response = await apiFetch<unknown>('/app/me/tenants', {
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
