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

export function extractEntityToken(source: any, depth = 0): string | null {
  if (!source || typeof source !== "object") return null;

  for (const key of ENTITY_TOKEN_KEYS) {
    const candidate = normalizeEntityToken((source as Record<string, unknown>)[key]);
    if (candidate) {
      return candidate;
    }
  }

  if (depth >= 3) {
    return null;
  }

  for (const nestedKey of NESTED_TOKEN_SOURCES) {
    const nested = (source as Record<string, unknown>)[nestedKey];
    if (!nested) continue;

    if (Array.isArray(nested)) {
      for (const item of nested) {
        const candidate = extractEntityToken(item, depth + 1);
        if (candidate) return candidate;
      }
      continue;
    }

    if (typeof nested === "object") {
      const candidate = extractEntityToken(nested, depth + 1);
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
