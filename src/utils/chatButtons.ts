import { BASE_API_URL } from "@/config";
import { Boton } from "@/types/chat";

const baseApiUrl = (BASE_API_URL || "").replace(/\/$/, "");

export const ensureAbsoluteUrl = (value?: string | null): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^(?:[a-z][a-z0-9+\-.]*:|\/\/)/i.test(trimmed)) {
    return trimmed;
  }
  if (baseApiUrl) {
    if (trimmed.startsWith("/")) {
      return `${baseApiUrl}${trimmed}`;
    }
    return `${baseApiUrl}/${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed}`;
};

export const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
};

const extractArray = (source: any): any[] => {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.botones)) return source.botones;
  if (Array.isArray(source?.buttons)) return source.buttons;
  if (Array.isArray(source?.options)) return source.options;
  if (Array.isArray(source?.items)) return source.items;
  return [];
};

const normalizeButton = (raw: any): Boton | null => {
  if (!raw || typeof raw !== "object") return null;
  const texto = pickFirstString(
    raw.texto,
    raw.label,
    raw.title,
    raw.nombre,
    raw.name,
    raw.text,
    raw.caption,
    raw.display_name,
    raw.displayName
  );
  const actionId = pickFirstString(raw.action_id, raw.actionId);
  const action = pickFirstString(raw.action, actionId);
  const accionInterna = pickFirstString(raw.accion_interna, raw.internal_action, raw.internalAction);
  const url = ensureAbsoluteUrl(pickFirstString(raw.url, raw.link, raw.href));
  const payload = raw?.payload ?? raw?.data ?? raw?.extra ?? raw?.meta ?? raw?.parameters ?? raw?.params ?? raw?.value_payload;

  if (!texto && !url && !action && !accionInterna) {
    return null;
  }

  const boton: Boton = {
    texto: texto || action || accionInterna || url || "Opción",
  };

  if (url) {
    boton.url = url;
  }
  if (accionInterna) {
    boton.accion_interna = accionInterna;
  }
  if (action) {
    boton.action = action;
  }
  if (actionId) {
    boton.action_id = actionId;
    if (!boton.action) {
      boton.action = actionId;
    }
  }
  if (payload !== undefined) {
    boton.payload = payload;
  }

  return boton;
};

export const mergeButtons = (...sources: any[]): Boton[] => {
  const seen = new Set<string>();
  const result: Boton[] = [];
  sources.forEach((source) => {
    extractArray(source)
      .map(normalizeButton)
      .forEach((btn) => {
        if (!btn) return;
        const key = `${btn.texto}|${btn.action || ""}|${btn.accion_interna || ""}|${btn.url || ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(btn);
        }
      });
  });
  return result;
};

export const extractButtonsFromResponse = (data: any): Boton[] => {
  if (!data || typeof data !== "object") {
    return [];
  }

  return mergeButtons(
    data.botones,
    data.options_list,
    data.optionsList,
    data.options,
    data.botones_sugeridos,
    data.buttons,
    data.botonesSugeridos,
    data.quick_replies,
    data.metadata
  );
};

export default mergeButtons;
