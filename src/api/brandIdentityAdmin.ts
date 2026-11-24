import { ApiError, apiFetch } from "@/utils/api";

/**
 * Superadmin reading and publication of an organization's brand identity
 * (`organization.brand_identity_admin.v1`). The stored value is the backend's
 * canonical record; `published` says whether it is visible on public
 * surfaces (only for an active Full-plan organization).
 */
export const BRAND_IDENTITY_ADMIN_CONTRACT = "organization.brand_identity_admin.v1";

export interface StoredBrandIdentity {
  palette: string[];
  gradient_stops?: { color: string; x: number; y: number }[];
  text_color?: string;
  typography?: { family: string; fallback?: string; stylesheet_url?: string; letter_spacing?: string };
  logo?: { on_light?: string; on_dark?: string; mark?: string; alt?: string };
  bubble_style?: "default" | "globa";
  avatar?: { style: "chatboc_bot" | "brand_bot" };
}

export interface BrandIdentityAdminState {
  tenant: { id: number; slug: string };
  brandIdentity: StoredBrandIdentity | null;
  published: boolean;
}

export class BrandIdentityAdminError extends Error {
  constructor(public readonly reason: string, public readonly status: number) {
    super(reason);
    this.name = "BrandIdentityAdminError";
  }
}

const REQUEST = {
  omitTenant: true,
  omitEntityToken: true,
  omitChatSessionId: true,
  isWidgetRequest: false,
  singleAttempt: true,
  suppressPanel401Redirect: true,
} as const;

const path = (slug: string) => `/api/admin/tenants/${encodeURIComponent(slug)}/brand-identity`;

function readState(payload: unknown, slug: string): BrandIdentityAdminState {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const tenant = source.tenant && typeof source.tenant === "object" ? source.tenant as Record<string, unknown> : {};
  const identity = source.brand_identity;
  if (
    source.contract_version !== BRAND_IDENTITY_ADMIN_CONTRACT
    || tenant.slug !== slug
    || typeof tenant.id !== "number"
    || typeof source.published !== "boolean"
    || (identity !== null && (typeof identity !== "object" || Array.isArray(identity)))
  ) {
    throw new BrandIdentityAdminError("brand_identity_response_invalid", 0);
  }
  return {
    tenant: { id: tenant.id, slug },
    brandIdentity: identity as StoredBrandIdentity | null,
    published: source.published,
  };
}

function rethrow(error: unknown): never {
  if (error instanceof BrandIdentityAdminError) throw error;
  if (error instanceof ApiError) {
    const reason = typeof error.body?.reason_code === "string" ? error.body.reason_code : "brand_identity_request_failed";
    throw new BrandIdentityAdminError(reason, error.status);
  }
  throw new BrandIdentityAdminError("brand_identity_request_failed", 0);
}

export async function getBrandIdentityAdmin(slug: string): Promise<BrandIdentityAdminState> {
  try {
    return readState(await apiFetch<unknown>(path(slug), { ...REQUEST, allowStartupRecovery: true }), slug);
  } catch (error) {
    rethrow(error);
  }
}

/** Publishes `value`; `null` removes the identity. */
export async function putBrandIdentityAdmin(slug: string, value: StoredBrandIdentity | null): Promise<BrandIdentityAdminState> {
  try {
    return readState(await apiFetch<unknown>(path(slug), { ...REQUEST, method: "PUT", body: { brand_identity: value } }), slug);
  } catch (error) {
    rethrow(error);
  }
}

const REASONS: Record<string, string> = {
  brand_identity_superadmin_required: "Solo un superadmin puede ver o cambiar la identidad de marca.",
  brand_identity_tenant_missing: "No encontramos esa organización.",
  brand_identity_writer_fenced: "Las escrituras están pausadas por una migración. Probá de nuevo más tarde.",
  brand_identity_storage_unavailable: "No se pudo guardar en este momento. Probá de nuevo.",
  brand_identity_invalid: "La identidad no tiene el formato esperado.",
  brand_identity_palette_invalid: "La paleta necesita de 2 a 6 colores en formato #RRGGBB.",
  brand_identity_gradient_invalid: "El gradiente necesita de 2 a 6 puntos con color #RRGGBB y posición entre 0 y 100 %.",
  brand_identity_text_color_invalid: "El color de texto debe estar en formato #RRGGBB.",
  brand_identity_typography_invalid: "Revisá la tipografía: nombre, respaldo, hoja de Google Fonts (css2) y espaciado en em.",
  brand_identity_logo_invalid: "Los logos deben ser direcciones https, y el texto alternativo no puede llevar < ni >.",
  brand_identity_bubble_style_invalid: "El estilo de burbuja no es válido.",
  brand_identity_avatar_invalid: "El estilo de avatar no es válido.",
  brand_identity_response_invalid: "La respuesta del servidor no coincide con el contrato esperado.",
};

export function brandIdentityReasonMessage(reason: string): string {
  return REASONS[reason] ?? "No se pudo completar la operación.";
}
