import { ApiError, apiFetch, captureWidgetRequestAuthority, widgetRequestAuthorityKey } from "@/utils/api";
import type { WidgetConversationHandle } from '@/utils/widgetConversationScope';
import { captureAudioRecoveryOwner, createRecoverableAudioAttempt, type RecoverableAudioAttempt } from './audioRecovery';

const UPLOAD_ALIAS_RETRY_STATUSES = new Set([404, 405, 501]);
const DIRECT_UPLOAD_CONTRACT_VERSION = "chat.attachment.direct.v1";
const LEGACY_MULTIPART_MAX_FILE_BYTES = 4 * 1024 * 1024;

type DirectUploadPrepareResponse = {
  ok: true;
  contract_version: typeof DIRECT_UPLOAD_CONTRACT_VERSION;
  operation: "prepare_direct_upload";
  upload_id: string;
  intent_token: string;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expires_in_seconds: number;
  };
  constraints: {
    max_file_bytes: number;
    exact_size_required: true;
  };
  request_id?: string;
};

export type ChatAttachmentUploadContext = {
  tenantSlug?: string | null;
  demoSessionId?: string | null;
  chatSessionId?: string | null;
  anonId?: string | null;
  conversationOwner?: WidgetConversationHandle;
  skipAuth?: boolean;
  omitCredentials?: boolean;
  /** A retired recording may not start another upload stage or accept its ACK. */
  isCurrent?: () => boolean;
  singleAttempt?: boolean;
};

const assertUploadCurrent = (context: ChatAttachmentUploadContext) => {
  const owner = context.conversationOwner;
  if (context.isCurrent?.() === false || (owner && (
    !owner.isCurrent() || normalizeContextValue(context.tenantSlug) !== owner.tenantSlug ||
    normalizeContextValue(context.chatSessionId) !== owner.sessionId ||
    normalizeContextValue(context.anonId) !== owner.anonId ||
    widgetRequestAuthorityKey(captureWidgetRequestAuthority({
      skipAuth: context.skipAuth, omitCredentials: context.omitCredentials,
    })) !== widgetRequestAuthorityKey(owner.authority)
  ))) {
    throw new DOMException("Upload retired", "AbortError");
  }
};

const normalizeContextValue = (value?: string | null) => value?.trim() || null;

export const resolveBoundChatAttachmentUploadContext = (
  activeTenantSlug: string | null | undefined,
  bootstrapContext: ChatAttachmentUploadContext = {},
): ChatAttachmentUploadContext => {
  const activeTenant = normalizeContextValue(activeTenantSlug);
  const bootstrapTenant = normalizeContextValue(bootstrapContext.tenantSlug);
  const tenantContextMatches = !activeTenant
    || !bootstrapTenant
    || activeTenant === bootstrapTenant;
  return {
    tenantSlug: activeTenant || bootstrapTenant,
    demoSessionId: tenantContextMatches
      ? normalizeContextValue(bootstrapContext.demoSessionId)
      : null,
    chatSessionId: tenantContextMatches
      ? normalizeContextValue(bootstrapContext.chatSessionId)
      : null,
    ...(tenantContextMatches ? {
      ...(bootstrapContext.conversationOwner ? { conversationOwner: bootstrapContext.conversationOwner } : {}),
      ...(bootstrapContext.anonId !== undefined ? { anonId: normalizeContextValue(bootstrapContext.anonId) } : {}),
      ...(bootstrapContext.isCurrent ? { isCurrent: bootstrapContext.isCurrent } : {}),
      ...(bootstrapContext.skipAuth !== undefined ? { skipAuth: bootstrapContext.skipAuth } : {}),
      ...(bootstrapContext.omitCredentials !== undefined ? { omitCredentials: bootstrapContext.omitCredentials } : {}),
      ...(bootstrapContext.singleAttempt !== undefined ? { singleAttempt: bootstrapContext.singleAttempt } : {}),
    } : (bootstrapContext.conversationOwner || bootstrapContext.isCurrent
      ? { isCurrent: () => false } : {})),
  };
};

const captureUploadContext = (context: ChatAttachmentUploadContext): ChatAttachmentUploadContext => ({ ...context });

const normalizeEndpointPath = (endpoint: string) => {
  const trimmed = endpoint.trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).pathname.replace(/^\/+/, "").toLowerCase();
    }
  } catch {
    return "";
  }

  return trimmed
    .split(/[?#]/, 1)[0]
    .replace(/^\/+/, "")
    .toLowerCase();
};

const isCanonicalAttachmentUpload = (endpoint: string) =>
  normalizeEndpointPath(endpoint).startsWith("archivos/");

const supportsDirectChatAttachmentUpload = (endpoint: string) => {
  const path = normalizeEndpointPath(endpoint).replace(/^api\//, "");
  return path === "archivos/upload/chat_attachment";
};

const resolveRootUploadBase = (endpoint: string) =>
  isCanonicalAttachmentUpload(endpoint) && typeof window !== "undefined"
    ? window.location.origin
    : undefined;

const resolveApiAlias = (endpoint: string) => {
  const normalized = endpoint.trim().replace(/^\/+/, "");
  if (!normalized.toLowerCase().startsWith("archivos/")) return null;
  return `/api/${normalized}`;
};

const postUploadApi = async <T>(
  endpoint: string,
  body: FormData | Record<string, unknown>,
  context: ChatAttachmentUploadContext = {},
): Promise<T> => {
  assertUploadCurrent(context);
  const demoSessionId = context.demoSessionId?.trim() || "";
  const tenantSlug = context.tenantSlug?.trim() || undefined;
  const isCurrent = context.conversationOwner ? () => {
    try { assertUploadCurrent(context); return true; } catch { return false; }
  } : context.isCurrent;
  const headers = demoSessionId
    ? { "X-Demo-Session-Id": demoSessionId }
    : undefined;
  try {
    const response = await apiFetch<T>(endpoint, {
      method: "POST",
      body,
      headers,
      isWidgetRequest: true,
      tenantSlug,
      persistTenantSlug: false,
      chatSessionId: context.chatSessionId,
      anonId: context.anonId,
      skipAuth: context.skipAuth,
      omitCredentials: context.omitCredentials,
      baseUrlOverride: resolveRootUploadBase(endpoint),
      ...(isCurrent ? { isCurrent } : {}),
      singleAttempt: context.singleAttempt,
    });
    assertUploadCurrent(context);
    return response;
  } catch (error) {
    assertUploadCurrent(context);
    const aliasEndpoint = resolveApiAlias(endpoint);
    if (
      aliasEndpoint && !context.singleAttempt &&
      error instanceof ApiError &&
      UPLOAD_ALIAS_RETRY_STATUSES.has(error.status)
    ) {
      const response = await apiFetch<T>(aliasEndpoint, {
        method: "POST",
        body,
        headers,
        isWidgetRequest: true,
        tenantSlug,
        persistTenantSlug: false,
        chatSessionId: context.chatSessionId,
        anonId: context.anonId,
        skipAuth: context.skipAuth,
        omitCredentials: context.omitCredentials,
        ...(isCurrent ? { isCurrent } : {}),
      });
      assertUploadCurrent(context);
      return response;
    }
    throw error;
  }
};

/** Recovery keeps a signed intent in memory. A lost completion ACK must never
 * start another prepare or repeat the object PUT. Legacy/uncertain PUTs are
 * deliberately not offered a retry. */
export const createChatAttachmentUploadAttempt = <T>(
  endpoint: string,
  createFormData: () => FormData,
  context: ChatAttachmentUploadContext = {},
): RecoverableAudioAttempt<T> => {
  const owner = captureAudioRecoveryOwner(context.isCurrent, context.conversationOwner);
  const frozenContext = { ...context, isCurrent: owner, singleAttempt: true };
  const initialFormData = createFormData();
  const file = readUploadFile(initialFormData);
  let phase: 'prepare' | 'put' | 'complete' | 'legacy' = 'prepare';
  let prepared: DirectUploadPrepareResponse | null = null;
  return createRecoverableAudioAttempt(async () => {
    if (!file || !supportsDirectChatAttachmentUpload(endpoint) || !file.name.trim() || !normalizeMimeType(file.type)) {
      phase = 'legacy';
      return postUploadApi<T>(endpoint, initialFormData, frozenContext);
    }
    if (!prepared) {
      try { prepared = await prepareDirectUpload(endpoint, file, frozenContext); }
      catch (error) {
        if (file.size <= LEGACY_MULTIPART_MAX_FILE_BYTES && isDirectUploadCompatibilityError(error)) {
          phase = 'legacy';
          return postUploadApi<T>(endpoint, initialFormData, frozenContext);
        }
        throw error;
      }
      phase = 'put';
      await putDirectlyToObjectStorage(prepared, file, frozenContext);
      phase = 'complete';
    }
    return postUploadApi<T>(endpoint, { operation: 'complete_direct_upload', intent_token: prepared.intent_token }, frozenContext);
  }, owner, error => {
    if (phase === 'legacy' || phase === 'put' || (error as Error)?.name === 'AbortError') return false;
    if (error instanceof ApiError && (error.status < 500 ||
      (error.body as Record<string, unknown> | null)?.code === 'invalid_direct_upload_contract')) return false;
    return phase === 'prepare' || phase === 'complete';
  });
};

const uploadWithLegacyMultipart = <T>(
  endpoint: string,
  createFormData: () => FormData,
  context: ChatAttachmentUploadContext,
) => postUploadApi<T>(endpoint, createFormData(), context);

const readUploadFile = (formData: FormData): File | null => {
  const candidate = formData.get("file");
  return typeof File !== "undefined" && candidate instanceof File ? candidate : null;
};

const normalizeMimeType = (mimeType: string) =>
  mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

const readErrorText = (body: unknown): string => {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";

  const payload = body as Record<string, unknown>;
  for (const key of ["error", "message", "detail"]) {
    if (typeof payload[key] === "string") return payload[key];
  }
  return "";
};

const isLegacyMissingMultipartFileError = (error: ApiError) => {
  if (error.status !== 400) return false;
  const normalized = readErrorText(error.body)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("campo de archivo") && normalized.includes("file");
};

const isDirectUploadCompatibilityError = (error: unknown) =>
  error instanceof ApiError &&
  (UPLOAD_ALIAS_RETRY_STATUSES.has(error.status) || isLegacyMissingMultipartFileError(error));

const directUploadProtocolError = (message: string) =>
  new ApiError(message, 502, {
    code: "invalid_direct_upload_contract",
    contract_version: DIRECT_UPLOAD_CONTRACT_VERSION,
  });

const parsePrepareResponse = (value: unknown, file: File): DirectUploadPrepareResponse => {
  if (!value || typeof value !== "object") {
    throw directUploadProtocolError("El servidor devolvio una preparacion de carga invalida.");
  }

  const payload = value as Partial<DirectUploadPrepareResponse>;
  const upload = payload.upload;
  const constraints = payload.constraints;

  if (
    payload.ok !== true ||
    payload.contract_version !== DIRECT_UPLOAD_CONTRACT_VERSION ||
    payload.operation !== "prepare_direct_upload" ||
    typeof payload.upload_id !== "string" ||
    !payload.upload_id.trim() ||
    typeof payload.intent_token !== "string" ||
    !payload.intent_token.trim() ||
    !upload ||
    upload.method !== "PUT" ||
    typeof upload.url !== "string" ||
    !upload.url.trim() ||
    !upload.headers ||
    typeof upload.headers !== "object" ||
    typeof upload.expires_in_seconds !== "number" ||
    !Number.isFinite(upload.expires_in_seconds) ||
    upload.expires_in_seconds <= 0 ||
    !constraints ||
    constraints.exact_size_required !== true ||
    typeof constraints.max_file_bytes !== "number" ||
    !Number.isFinite(constraints.max_file_bytes) ||
    constraints.max_file_bytes <= 0
  ) {
    throw directUploadProtocolError("El servidor devolvio una preparacion de carga incompleta.");
  }

  let uploadUrl: URL;
  try {
    uploadUrl = new URL(upload.url);
  } catch {
    throw directUploadProtocolError("El servidor devolvio una URL de carga invalida.");
  }
  if (uploadUrl.protocol !== "https:") {
    throw directUploadProtocolError("La carga directa requiere una URL HTTPS segura.");
  }

  if (file.size > constraints.max_file_bytes) {
    throw new ApiError("El archivo supera el limite de carga permitido.", 413, {
      code: "file_too_large",
      max_file_bytes: constraints.max_file_bytes,
    });
  }

  return payload as DirectUploadPrepareResponse;
};

const resolveSignedUploadHeaders = (
  prepared: DirectUploadPrepareResponse,
  file: File,
) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(prepared.upload.headers)) {
    const normalizedName = name.trim().toLowerCase();
    if (["authorization", "cookie", "proxy-authorization"].includes(normalizedName)) {
      throw directUploadProtocolError("La preparacion de carga incluyo credenciales no permitidas.");
    }
    if (typeof value !== "string" || !name.trim()) {
      throw directUploadProtocolError("La preparacion de carga incluyo encabezados invalidos.");
    }
    headers.set(name, value);
  }

  const signedContentType = headers.get("Content-Type");
  if (!signedContentType || signedContentType !== normalizeMimeType(file.type)) {
    throw directUploadProtocolError("El tipo de archivo firmado no coincide con el archivo seleccionado.");
  }

  return headers;
};

const putDirectlyToObjectStorage = async (
  prepared: DirectUploadPrepareResponse,
  file: File,
  context: ChatAttachmentUploadContext,
) => {
  assertUploadCurrent(context);
  const response = await fetch(prepared.upload.url, {
    method: "PUT",
    body: file,
    headers: resolveSignedUploadHeaders(prepared, file),
    credentials: "omit",
    cache: "no-store",
    mode: "cors",
    referrerPolicy: "no-referrer",
  });

  // A dispatched PUT is not replayed or undone. Retirement prevents completion.
  assertUploadCurrent(context);

  if (!response.ok) {
    throw new ApiError("No se pudo transferir el archivo al almacenamiento seguro.", response.status, {
      code: "direct_upload_failed",
      phase: "put_object",
    });
  }
};

const prepareDirectUpload = async (
  endpoint: string,
  file: File,
  context: ChatAttachmentUploadContext,
) => {
  const preparedRaw = await postUploadApi<unknown>(
    endpoint,
    {
      operation: "prepare_direct_upload",
      filename: file.name,
      mime_type: normalizeMimeType(file.type),
      size_bytes: file.size,
    },
    context,
  );
  return parsePrepareResponse(preparedRaw, file);
};

export const uploadChatAttachment = async <T>(
  endpoint: string,
  createFormData: () => FormData,
  context: ChatAttachmentUploadContext = {},
): Promise<T> => {
  context = captureUploadContext(context);
  assertUploadCurrent(context);
  if (!supportsDirectChatAttachmentUpload(endpoint)) {
    return uploadWithLegacyMultipart<T>(endpoint, createFormData, context);
  }

  const initialFormData = createFormData();
  const file = readUploadFile(initialFormData);
  if (!file) {
    return postUploadApi<T>(endpoint, initialFormData, context);
  }
  if (!file.name.trim() || !normalizeMimeType(file.type)) {
    if (file.size <= LEGACY_MULTIPART_MAX_FILE_BYTES) {
      return postUploadApi<T>(endpoint, initialFormData, context);
    }
    throw new ApiError("El archivo necesita un nombre y tipo validos para la carga segura.", 400, {
      code: "direct_upload_metadata_required",
    });
  }

  let prepared: DirectUploadPrepareResponse;
  try {
    prepared = await prepareDirectUpload(endpoint, file, context);
  } catch (error) {
    assertUploadCurrent(context);
    if (
      file.size <= LEGACY_MULTIPART_MAX_FILE_BYTES &&
      isDirectUploadCompatibilityError(error)
    ) {
      return uploadWithLegacyMultipart<T>(endpoint, createFormData, context);
    }
    throw error;
  }

  await putDirectlyToObjectStorage(prepared, file, context);

  return postUploadApi<T>(
    endpoint,
    {
      operation: "complete_direct_upload",
      intent_token: prepared.intent_token,
    },
    context,
  );
};
