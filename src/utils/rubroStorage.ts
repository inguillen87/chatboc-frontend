import { normalizeRubro } from "@/utils/chatEndpoints";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

export interface RubroInfo {
  clave: string | null;
  nombre: string | null;
}

export interface ExtractRubroOptions {
  allowPlainString?: boolean;
  preferRubroKeys?: boolean;
}

const RUBRO_SLUG_KEY = "rubroSeleccionadoClave";
const RUBRO_NAME_KEY = "rubroSeleccionadoNombre";
const RUBRO_LEGACY_KEY = "rubroSeleccionado";

const sanitizeString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const normalizeSlug = (value: unknown): string | null => {
  const str = sanitizeString(value);
  if (!str) return null;
  const normalized = normalizeRubro(str);
  return normalized || str;
};

const isRubroInfoCandidate = (value: unknown): value is RubroInfo => {
  if (!value || typeof value !== "object") return false;
  const maybeInfo = value as Partial<RubroInfo>;
  return (
    typeof maybeInfo.clave !== "undefined" || typeof maybeInfo.nombre !== "undefined"
  );
};

const extractFromObject = (
  source: Record<string, unknown>,
  options: Required<ExtractRubroOptions>,
): RubroInfo => {
  const nestedKeys = ["rubro", "payload", "data"] as const;
  for (const key of nestedKeys) {
    if (source[key]) {
      const nested = extractRubroInfo(source[key], options);
      if (nested.clave || nested.nombre) {
        return nested;
      }
    }
  }

  const slugFromRubroKeys =
    normalizeSlug(source.rubro_clave) ??
    normalizeSlug(source.rubroClave) ??
    normalizeSlug(source.rubro_slug) ??
    normalizeSlug(source.rubroSlug);

  const nameFromRubroKeys =
    sanitizeString(source.rubro_nombre) ??
    sanitizeString(source.rubroNombre) ??
    sanitizeString(source.rubro_label) ??
    sanitizeString(source.rubroLabel);

  let slugCandidate = slugFromRubroKeys;
  let nameCandidate = nameFromRubroKeys;

  if (!slugCandidate) {
    const nestedRubro = source.rubro ? extractRubroInfo(source.rubro, options) : { clave: null, nombre: null };
    slugCandidate = nestedRubro.clave ?? slugCandidate;
    nameCandidate = nameCandidate ?? nestedRubro.nombre ?? null;
  }

  if (!options.preferRubroKeys) {
    if (!slugCandidate) {
      slugCandidate =
        normalizeSlug(source.clave) ??
        normalizeSlug(source.slug) ??
        normalizeSlug(source.value) ??
        normalizeSlug(source.key);
    }
    if (!nameCandidate) {
      nameCandidate =
        sanitizeString(source.nombre) ??
        sanitizeString(source.name) ??
        sanitizeString(source.label) ??
        sanitizeString(source.title) ??
        sanitizeString(source.texto);
    }
  }

  if (slugCandidate || nameCandidate) {
    const resolvedSlug = slugCandidate ?? (nameCandidate ? normalizeSlug(nameCandidate) : null);
    return {
      clave: resolvedSlug ?? null,
      nombre: nameCandidate ?? (resolvedSlug ?? null),
    };
  }

  return { clave: null, nombre: null };
};

export const extractRubroInfo = (
  source: unknown,
  options: ExtractRubroOptions = {},
): RubroInfo => {
  const normalizedOptions: Required<ExtractRubroOptions> = {
    allowPlainString: options.allowPlainString !== false,
    preferRubroKeys: options.preferRubroKeys === true,
  };

  if (source === null || typeof source === "undefined") {
    return { clave: null, nombre: null };
  }

  if (isRubroInfoCandidate(source)) {
    const info = source as Partial<RubroInfo>;
    const clave = normalizeSlug(info.clave);
    const nombre = sanitizeString(info.nombre);
    if (clave || nombre) {
      return {
        clave: clave ?? (nombre ? normalizeSlug(nombre) : null),
        nombre: nombre ?? clave ?? null,
      };
    }
  }

  if (typeof source === "string") {
    if (!normalizedOptions.allowPlainString) {
      return { clave: null, nombre: null };
    }
    const nombre = sanitizeString(source);
    if (!nombre) {
      return { clave: null, nombre: null };
    }
    const clave = normalizeSlug(nombre);
    return { clave, nombre };
  }

  if (typeof source === "number" && Number.isFinite(source)) {
    const nombre = String(source);
    const clave = normalizeSlug(nombre);
    return { clave, nombre };
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const info = extractRubroInfo(item, normalizedOptions);
      if (info.clave || info.nombre) {
        return info;
      }
    }
    return { clave: null, nombre: null };
  }

  if (typeof source === "object") {
    return extractFromObject(source as Record<string, unknown>, normalizedOptions);
  }

  return { clave: null, nombre: null };
};

export const persistRubroSelection = (source: unknown): RubroInfo => {
  const info = isRubroInfoCandidate(source)
    ? {
        clave: normalizeSlug((source as RubroInfo).clave),
        nombre: sanitizeString((source as RubroInfo).nombre),
      }
    : extractRubroInfo(source);

  const finalInfo: RubroInfo = {
    clave: info.clave ?? null,
    nombre: info.nombre ?? null,
  };

  if (finalInfo.clave) {
    safeLocalStorage.setItem(RUBRO_SLUG_KEY, finalInfo.clave);
  } else {
    safeLocalStorage.removeItem(RUBRO_SLUG_KEY);
  }

  if (finalInfo.nombre) {
    safeLocalStorage.setItem(RUBRO_NAME_KEY, finalInfo.nombre);
    safeLocalStorage.setItem(RUBRO_LEGACY_KEY, finalInfo.nombre);
  } else if (finalInfo.clave) {
    safeLocalStorage.removeItem(RUBRO_NAME_KEY);
    safeLocalStorage.setItem(RUBRO_LEGACY_KEY, finalInfo.clave);
  } else {
    safeLocalStorage.removeItem(RUBRO_NAME_KEY);
    safeLocalStorage.removeItem(RUBRO_LEGACY_KEY);
  }

  return finalInfo;
};

export const getStoredRubroInfo = (): RubroInfo => {
  const storedSlug = normalizeSlug(safeLocalStorage.getItem(RUBRO_SLUG_KEY));
  const storedName =
    sanitizeString(safeLocalStorage.getItem(RUBRO_NAME_KEY)) ??
    sanitizeString(safeLocalStorage.getItem(RUBRO_LEGACY_KEY));

  if (storedSlug || storedName) {
    return {
      clave: storedSlug ?? (storedName ? normalizeSlug(storedName) : null),
      nombre: storedName ?? storedSlug ?? null,
    };
  }

  return { clave: null, nombre: null };
};

export const clearStoredRubroSelection = (): void => {
  safeLocalStorage.removeItem(RUBRO_SLUG_KEY);
  safeLocalStorage.removeItem(RUBRO_NAME_KEY);
  safeLocalStorage.removeItem(RUBRO_LEGACY_KEY);
};
