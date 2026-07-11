import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { advanceChatbocSessionRevision } from "@/utils/sessionLogout";

export interface PanelLoginUser {
  id?: string | number;
  email?: string;
  name?: string;
  rol?: string;
  role?: string;
  tenant_slug?: string | null;
  tenantSlug?: string | null;
  tipo_chat?: "pyme" | "municipio" | string | null;
  tenant?: {
    slug?: string | null;
    tenant_slug?: string | null;
  } | null;
  [key: string]: unknown;
}

export interface PersistPanelLoginSessionInput {
  token?: string | null;
  user?: PanelLoginUser | null;
  entityToken?: string | null;
  tipoChat?: "pyme" | "municipio" | string | null;
  tenantSlugHint?: string | null;
  setUser?: (user: PanelLoginUser) => void;
}

const parseStoredUser = (): PanelLoginUser => {
  const raw = safeLocalStorage.getItem("user");
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    safeLocalStorage.removeItem("user");
    return {};
  }
};

const firstText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
};

export const persistPanelLoginSession = ({
  token,
  user,
  entityToken,
  tipoChat,
  tenantSlugHint,
  setUser,
}: PersistPanelLoginSessionInput): PanelLoginUser | null => {
  safeLocalStorage.removeItem("authProvider");
  safeLocalStorage.removeItem("clerkUserId");
  if (token) {
    advanceChatbocSessionRevision();
    safeLocalStorage.setItem("authToken", token);
  }
  if (entityToken) {
    safeLocalStorage.setItem("entityToken", entityToken);
  }

  const storedUser = { ...parseStoredUser() };
  delete storedUser.authProvider;
  delete storedUser.auth_provider;
  delete storedUser.clerkUserId;
  const resolvedTenantSlug = firstText(
    user?.tenant_slug,
    user?.tenantSlug,
    user?.tenant?.slug,
    user?.tenant?.tenant_slug,
    tenantSlugHint,
    storedUser.tenant_slug,
    storedUser.tenantSlug,
    storedUser.tenant?.slug,
    storedUser.tenant?.tenant_slug,
    safeLocalStorage.getItem("tenantSlug"),
  );

  if (resolvedTenantSlug) {
    safeLocalStorage.setItem("tenantSlug", resolvedTenantSlug);
  }

  const resolvedRole = firstText(user?.rol, user?.role, storedUser.rol, storedUser.role);
  const resolvedTipoChat = firstText(tipoChat, user?.tipo_chat, storedUser.tipo_chat);
  const nextUser: PanelLoginUser = {
    ...storedUser,
    ...(user || {}),
    ...(resolvedRole ? { rol: resolvedRole, role: resolvedRole } : {}),
    ...(resolvedTipoChat ? { tipo_chat: resolvedTipoChat } : {}),
    ...(token ? { token } : {}),
    ...(resolvedTenantSlug
      ? {
          tenant_slug: resolvedTenantSlug,
          tenantSlug: resolvedTenantSlug,
          tenant: {
            ...(storedUser.tenant || {}),
            ...(user?.tenant || {}),
            slug: resolvedTenantSlug,
            tenant_slug: resolvedTenantSlug,
          },
        }
      : {}),
  };

  const hasUsefulIdentity = Boolean(
    nextUser.id ||
      nextUser.email ||
      nextUser.rol ||
      nextUser.tenant_slug ||
      nextUser.tenantSlug ||
      nextUser.tipo_chat,
  );

  if (!hasUsefulIdentity) return null;

  safeLocalStorage.setItem("user", JSON.stringify(nextUser));
  setUser?.(nextUser);
  return nextUser;
};
