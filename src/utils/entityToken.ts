import { safeLocalStorage } from "@/utils/safeLocalStorage";

const ENTITY_TOKEN_KEYS = [
  "entityToken",
  "entity_token",
  "widgetToken",
  "widget_token",
  "ownerToken",
  "owner_token",
  "token_widget",
  "widgetOwnerToken",
  "widget_owner_token",
  "empresa_token",
  "empresaToken",
  "municipio_token",
  "municipioToken",
  "organizationToken",
  "organization_token",
  "botToken",
  "bot_token",
  "tokenIntegracion",
  "token_integracion",
];

const ENTITY_TOKEN_KEY_SET = new Set(
  ENTITY_TOKEN_KEYS.map((key) => key.toLowerCase()),
);

const GENERIC_TOKEN_KEYS = [
  "token",
  "value",
  "jwt",
  "jwt_token",
  "access_token",
  "accesstoken",
  "auth_token",
  "authtoken",
  "api_token",
  "apitoken",
  "authorization",
];

const NESTED_TOKEN_SOURCES = [
  "entity",
  "entidad",
  "empresa",
  "municipio",
  "organization",
  "organizacion",
  "config",
  "widget",
  "tokens",
  "credentials",
  "integration",
  "integracion",
  "owner",
  "owners",
  "ownerinfo",
  "owner_info",
  "ownerdata",
  "owner_data",
  "propietario",
  "dueno",
  "dueño",
  "perfil",
  "profile",
  "account",
  "cuenta",
];

const NESTED_TOKEN_SOURCE_SET = new Set(
  NESTED_TOKEN_SOURCES.map((key) => key.toLowerCase()),
);

const TOKEN_CONTEXT_HINTS = [
  "entity",
  "entidad",
  "empresa",
  "municipio",
  "organization",
  "organizacion",
  "config",
  "widget",
  "tokens",
  "credentials",
  "integration",
  "integracion",
  "owner",
  "owners",
  "propietario",
  "dueno",
  "dueño",
  "perfil",
  "profile",
  "account",
  "cuenta",
  "bot",
  "assistant",
];

const PLACEHOLDER_TOKENS = new Set([
  "",
  "demo-anon",
  "null",
  "undefined",
  "none",
]);

export function normalizeEntityToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutBearer = trimmed.startsWith("Bearer ")
    ? trimmed.slice(7).trim()
    : trimmed;
  if (!withoutBearer) return null;
  const candidate = withoutBearer.replace(/^"|"$/g, "").trim();
  if (!candidate) return null;
  if (PLACEHOLDER_TOKENS.has(candidate.toLowerCase())) {
    return null;
  }
  return candidate;
}

function shouldCaptureFromContext(key: string, path: string[]): boolean {
  if (!path.length) {
    return TOKEN_CONTEXT_HINTS.some((hint) => key.toLowerCase().includes(hint));
  }
  const normalizedPath = path.map((segment) => segment.toLowerCase());
  if (normalizedPath.some((segment) => TOKEN_CONTEXT_HINTS.some((hint) => segment.includes(hint)))) {
    return true;
  }
  return TOKEN_CONTEXT_HINTS.some((hint) => key.toLowerCase().includes(hint));
}

function shouldRecurseInto(key: string, depth: number): boolean {
  const normalizedKey = key.toLowerCase();
  if (NESTED_TOKEN_SOURCE_SET.has(normalizedKey)) return true;
  if (
    normalizedKey.includes("token") ||
    normalizedKey.includes("owner") ||
    normalizedKey.includes("widget") ||
    normalizedKey.includes("entity") ||
    normalizedKey.includes("empresa") ||
    normalizedKey.includes("municipio") ||
    normalizedKey.includes("organizacion") ||
    normalizedKey.includes("organization") ||
    normalizedKey.includes("perfil") ||
    normalizedKey.includes("profile") ||
    normalizedKey.includes("account") ||
    normalizedKey.includes("cuenta") ||
    normalizedKey.includes("credencial") ||
    normalizedKey.includes("credential") ||
    normalizedKey.includes("integration") ||
    normalizedKey.includes("integracion")
  ) {
    return true;
  }
  return depth < 1;
}

export function extractEntityToken(source: any, depth = 0, path: string[] = []): string | null {
  if (!source) return null;

  if (Array.isArray(source)) {
    if (depth >= 6) return null;
    for (const item of source) {
      const candidate = extractEntityToken(item, depth + 1, path);
      if (candidate) return candidate;
    }
    return null;
  }

  if (typeof source !== "object") {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const [rawKey, rawValue] of Object.entries(record)) {
    const normalizedKey = rawKey.toLowerCase();
    if (ENTITY_TOKEN_KEY_SET.has(normalizedKey)) {
      const candidate = normalizeEntityToken(rawValue);
      if (candidate) {
        return candidate;
      }
    }

    if (typeof rawValue === "string") {
      const genericKey = GENERIC_TOKEN_KEYS.includes(normalizedKey) || normalizedKey.includes("token");
      if (genericKey && shouldCaptureFromContext(rawKey, path)) {
        const candidate = normalizeEntityToken(rawValue);
        if (candidate) {
          return candidate;
        }
      }
    }
  }

  if (depth >= 6) {
    return null;
  }

  for (const [rawKey, rawValue] of Object.entries(record)) {
    if (!rawValue || typeof rawValue === "string") continue;

    const nextPath = [...path, rawKey];

    if (Array.isArray(rawValue)) {
      const candidate = extractEntityToken(rawValue, depth + 1, nextPath);
      if (candidate) return candidate;
      continue;
    }

    if (typeof rawValue === "object" && shouldRecurseInto(rawKey, depth)) {
      const candidate = extractEntityToken(rawValue, depth + 1, nextPath);
      if (candidate) return candidate;
    }
  }

  return null;
}

export function getStoredEntityToken(): string | null {
  try {
    return normalizeEntityToken(safeLocalStorage.getItem("entityToken"));
  } catch (err) {
    console.warn("entityToken: unable to read from storage", err);
    return null;
  }
}

export function persistEntityToken(token: string | null | undefined): string | null {
  const normalized = normalizeEntityToken(token);
  try {
    if (normalized) {
      safeLocalStorage.setItem("entityToken", normalized);
      return normalized;
    }
    safeLocalStorage.removeItem("entityToken");
    return null;
  } catch (err) {
    console.warn("entityToken: unable to persist token", err);
    return normalized ?? null;
  }
}

export function clearStoredEntityToken() {
  try {
    safeLocalStorage.removeItem("entityToken");
  } catch (err) {
    console.warn("entityToken: unable to clear storage", err);
  }
}
