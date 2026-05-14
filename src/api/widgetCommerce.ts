import { apiFetch } from "@/utils/api";
import type {
  WidgetCommerceCartSnapshot,
  WidgetCommerceHistory,
  WidgetCommerceSession,
  WidgetUserRegisterPayload,
  WidgetUserRegisterResponse,
} from "@/types/widgetCommerce";

export type WidgetCommerceRequest = {
  tenantSlug?: string | null;
  widgetToken?: string | null;
  chatSessionId?: string | null;
  anonId?: string | null;
  widgetSessionToken?: string | null;
};

const addParam = (params: URLSearchParams, key: string, value?: string | null) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized) params.set(key, normalized);
};

const withQuery = (path: string, request: WidgetCommerceRequest) => {
  const params = new URLSearchParams();
  addParam(params, "tenant_slug", request.tenantSlug);
  addParam(params, "tenant", request.tenantSlug);
  addParam(params, "widget_token", request.widgetToken);
  addParam(params, "chat_session_id", request.chatSessionId);
  addParam(params, "anon_id", request.anonId);
  addParam(params, "widget_session_token", request.widgetSessionToken);

  const query = params.toString();
  if (!query) return path;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
};

const widgetHeaders = (request: WidgetCommerceRequest): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (request.tenantSlug) headers["X-Tenant-Slug"] = request.tenantSlug;
  if (request.widgetToken) headers["X-Widget-Token"] = request.widgetToken;
  if (request.chatSessionId) headers["X-Chat-Session-Id"] = request.chatSessionId;
  if (request.anonId) headers["X-Anon-Id"] = request.anonId;
  if (request.widgetSessionToken) headers["X-Widget-Session-Token"] = request.widgetSessionToken;
  return headers;
};

const publicWidgetOptions = (request: WidgetCommerceRequest) => ({
  skipAuth: true,
  isWidgetRequest: true,
  omitCredentials: true,
  omitEntityToken: true,
  sendAnonId: true,
  tenantSlug: request.tenantSlug,
  headers: widgetHeaders(request),
});

export async function getWidgetCommerceSession(
  request: WidgetCommerceRequest,
): Promise<WidgetCommerceSession> {
  return apiFetch<WidgetCommerceSession>(
    withQuery("/api/public/widget-commerce-session", request),
    publicWidgetOptions(request),
  );
}

export async function getWidgetTenantHistory(
  endpoint: string | null | undefined,
  request: WidgetCommerceRequest,
): Promise<WidgetCommerceHistory> {
  const path = typeof endpoint === "string" && endpoint.trim()
    ? endpoint.trim()
    : "/api/public/widget-user/tenant-history";
  return apiFetch<WidgetCommerceHistory>(
    withQuery(path, request),
    publicWidgetOptions(request),
  );
}

export async function getWidgetCartSnapshot(
  endpoint: string | null | undefined,
  request: WidgetCommerceRequest,
): Promise<WidgetCommerceCartSnapshot> {
  const path = typeof endpoint === "string" && endpoint.trim()
    ? endpoint.trim()
    : "/api/pwa/public/cart/summary";
  return apiFetch<WidgetCommerceCartSnapshot>(
    withQuery(path, request),
    publicWidgetOptions(request),
  );
}

export async function registerWidgetUser(
  request: WidgetCommerceRequest,
  payload: WidgetUserRegisterPayload,
  endpoint?: string | null,
): Promise<WidgetUserRegisterResponse> {
  const path = typeof endpoint === "string" && endpoint.trim()
    ? endpoint.trim()
    : "/api/public/widget-user/register";
  return apiFetch<WidgetUserRegisterResponse>(
    withQuery(path, request),
    {
      ...publicWidgetOptions(request),
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function linkWidgetSession(
  request: WidgetCommerceRequest,
  payload: Record<string, unknown> = {},
  endpoint?: string | null,
): Promise<WidgetUserRegisterResponse> {
  const path = typeof endpoint === "string" && endpoint.trim()
    ? endpoint.trim()
    : "/api/public/widget-user/link-session";
  return apiFetch<WidgetUserRegisterResponse>(
    withQuery(path, request),
    {
      ...publicWidgetOptions(request),
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
