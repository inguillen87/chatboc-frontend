import { ApiError, apiFetch } from "@/utils/api";

const UPLOAD_ALIAS_RETRY_STATUSES = new Set([404, 405, 501]);

const isCanonicalAttachmentUpload = (endpoint: string) =>
  endpoint.trim().replace(/^\/+/, "").toLowerCase().startsWith("archivos/");

const resolveRootUploadBase = (endpoint: string) =>
  isCanonicalAttachmentUpload(endpoint) && typeof window !== "undefined"
    ? window.location.origin
    : undefined;

const resolveApiAlias = (endpoint: string) => {
  const normalized = endpoint.trim().replace(/^\/+/, "");
  if (!normalized.toLowerCase().startsWith("archivos/")) return null;
  return `/api/${normalized}`;
};

export const uploadChatAttachment = async <T>(
  endpoint: string,
  createFormData: () => FormData,
): Promise<T> => {
  try {
    return await apiFetch<T>(endpoint, {
      method: "POST",
      body: createFormData(),
      isWidgetRequest: true,
      baseUrlOverride: resolveRootUploadBase(endpoint),
    });
  } catch (error) {
    const aliasEndpoint = resolveApiAlias(endpoint);
    if (
      aliasEndpoint &&
      error instanceof ApiError &&
      UPLOAD_ALIAS_RETRY_STATUSES.has(error.status)
    ) {
      return apiFetch<T>(aliasEndpoint, {
        method: "POST",
        body: createFormData(),
        isWidgetRequest: true,
      });
    }
    throw error;
  }
};
