export interface UploadResponsePayload {
  url?: string;
  secure_url?: string;
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  archivo_url?: string;
  public_url?: string;
  publicUrl?: string;
  url_publica?: string;
  urlPublica?: string;
  url_public?: string;
  urlPublic?: string;
  signedUrl?: string;
  signed_url?: string;
  downloadUrl?: string;
  download_url?: string;
  mediaUrl?: string;
  media_url?: string;
  assetUrl?: string;
  asset_url?: string;
  cdnUrl?: string;
  cdn_url?: string;
  href?: string;
  link?: string;
  location?: string;
  uri?: string;
  resourceUrl?: string;
  resource_url?: string;
  permalink?: string;
  permalink_url?: string;
  permalinkUrl?: string;
  webUrl?: string;
  web_url?: string;
  fallbackUrl?: string;
  fallback_url?: string;
  fallbackPublicUrl?: string;
  fallback_public_url?: string;
  fallbackPath?: string;
  fallback_path?: string;
  fallbackPublicPath?: string;
  fallback_public_path?: string;
  relativeUrl?: string;
  relative_url?: string;
  local_url?: string;
  localUrl?: string;
  local_path?: string;
  localPath?: string;
  local_file_path?: string;
  localFilePath?: string;
  local_relative_path?: string;
  localRelativePath?: string;
  local_public_path?: string;
  localPublicPath?: string;
  storageUrl?: string;
  storage_url?: string;
  storagePath?: string;
  storage_path?: string;
  staticUrl?: string;
  static_url?: string;
  staticPath?: string;
  static_path?: string;
  gcsUrl?: string;
  gcs_url?: string;
  bucketUrl?: string;
  bucket_url?: string;
  path?: string;
  fullPath?: string;
  full_path?: string;
  downloadPath?: string;
  download_path?: string;
  webPath?: string;
  web_path?: string;
  publicPath?: string;
  public_path?: string;
  relativePath?: string;
  relative_path?: string;
  original?: string;
  original_url?: string;
  originalUrl?: string;
  urls?: unknown;
  links?: unknown;
  files?: unknown;
  attachments?: unknown;
  sources?: unknown;
  variants?: unknown;
  thumbnails?: unknown;
  thumb?: unknown;
  thumbnail?: unknown;
  preview?: unknown;
  previews?: unknown;
  public?: unknown;
  secure?: unknown;
  signed?: unknown;
  download?: unknown;
  default?: unknown;
  raw?: unknown;

  name?: string;
  filename?: string;
  fileName?: string;
  original_filename?: string;
  originalFilename?: string;
  displayName?: string;
  titulo?: string;
  title?: string;
  label?: string;

  mimeType?: string;
  mime_type?: string;
  contentType?: string;
  content_type?: string;
  fileType?: string;
  file_type?: string;
  type?: string;

  size?: number | string;
  fileSize?: number | string;
  bytes?: number | string;
  file_size?: number | string;
  length?: number | string;

  thumbUrl?: string;
  thumb_url?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  previewUrl?: string;
  preview_url?: string;
  miniatura?: string;
  miniatura_url?: string;
  small?: string;
  small_url?: string;
  smallUrl?: string;
  medium?: string;
  medium_url?: string;
  mediumUrl?: string;
  large?: string;
  large_url?: string;
  largeUrl?: string;
  tiny?: string;
  tiny_url?: string;
  tinyUrl?: string;

  // Nested nodes that may contain additional metadata
  archivo?: UploadResponsePayload;
  attachment?: UploadResponsePayload;
  file?: UploadResponsePayload;
  data?: UploadResponsePayload;
  result?: UploadResponsePayload;
  resource?: UploadResponsePayload;
  asset?: UploadResponsePayload;
  payload?: UploadResponsePayload;
  info?: UploadResponsePayload;
  metadata?: UploadResponsePayload;
  meta?: UploadResponsePayload;
  record?: UploadResponsePayload;
  entry?: UploadResponsePayload;
  media?: UploadResponsePayload;
  response?: UploadResponsePayload;
  details?: UploadResponsePayload;
  document?: UploadResponsePayload;
  doc?: UploadResponsePayload;
  fileInfo?: UploadResponsePayload;
  file_info?: UploadResponsePayload;
  fileData?: UploadResponsePayload;
  file_data?: UploadResponsePayload;
  analysis?: UploadResponsePayload;
  analisis?: UploadResponsePayload;
  analisisArchivo?: UploadResponsePayload;
  analisis_archivo?: UploadResponsePayload;
  archivoAdjunto?: UploadResponsePayload;
  archivo_adjunto?: UploadResponsePayload;
  adjunto?: UploadResponsePayload;

  [key: string]: unknown;
}

export interface NormalizedUploadMetadata {
  url?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  thumbUrl?: string;
}

const PRIMARY_URL_KEYS: Array<keyof UploadResponsePayload | string> = [
  "url",
  "secure_url",
  "attachmentUrl",
  "attachment_url",
  "fileUrl",
  "file_url",
  "archivo_url",
  "fallbackUrl",
  "fallback_url",
  "fallbackPublicUrl",
  "fallback_public_url",
  "fallbackPath",
  "fallback_path",
  "fallbackPublicPath",
  "fallback_public_path",
  "public_url",
  "publicUrl",
  "url_publica",
  "urlPublica",
  "url_public",
  "urlPublic",
  "relativeUrl",
  "relative_url",
  "signedUrl",
  "signed_url",
  "downloadUrl",
  "download_url",
  "downloadPath",
  "download_path",
  "mediaUrl",
  "media_url",
  "assetUrl",
  "asset_url",
  "cdnUrl",
  "cdn_url",
  "href",
  "link",
  "location",
  "webPath",
  "web_path",
  "staticUrl",
  "static_url",
  "staticPath",
  "static_path",
  "uri",
  "resourceUrl",
  "resource_url",
  "permalink",
  "permalink_url",
  "permalinkUrl",
  "webUrl",
  "web_url",
  "local_url",
  "localUrl",
  "storageUrl",
  "storage_url",
  "storagePath",
  "storage_path",
  "gcsUrl",
  "gcs_url",
  "bucketUrl",
  "bucket_url",
  "local_url",
  "localUrl",
  "local_path",
  "localPath",
  "local_file_path",
  "localFilePath",
  "local_relative_path",
  "localRelativePath",
  "local_public_path",
  "localPublicPath",
  "path",
  "fullPath",
  "full_path",
  "publicPath",
  "public_path",
  "relativePath",
  "relative_path",
  "original",
  "original_url",
  "originalUrl",
  "public",
  "secure",
  "signed",
  "download",
  "default",
  "raw",
];

const NAME_KEYS: Array<keyof UploadResponsePayload | string> = [
  "name",
  "filename",
  "fileName",
  "original_filename",
  "originalFilename",
  "displayName",
  "titulo",
  "title",
  "label",
];

const MIME_KEYS: Array<keyof UploadResponsePayload | string> = [
  "mimeType",
  "mime_type",
  "contentType",
  "content_type",
  "fileType",
  "file_type",
  "type",
];

const SIZE_KEYS: Array<keyof UploadResponsePayload | string> = [
  "size",
  "fileSize",
  "bytes",
  "file_size",
  "length",
];

const THUMB_KEYS: Array<keyof UploadResponsePayload | string> = [
  "thumbUrl",
  "thumb_url",
  "thumbnailUrl",
  "thumbnail_url",
  "previewUrl",
  "preview_url",
  "previewPath",
  "preview_path",
  "fallbackThumbUrl",
  "fallback_thumb_url",
  "miniatura",
  "miniatura_url",
  "small",
  "small_url",
  "smallUrl",
  "medium",
  "medium_url",
  "mediumUrl",
  "large",
  "large_url",
  "largeUrl",
  "tiny",
  "tiny_url",
  "tinyUrl",
  "thumb",
  "thumbnail",
  "preview",
  "previews",
  "thumbnails",
  "variants",
  "sources",
];

const URL_CONTAINER_KEYS = new Set([
  "urls",
  "links",
  "files",
  "attachments",
  "sources",
  "variants",
  "thumbnails",
  "thumb",
  "thumbnail",
  "preview",
  "previews",
]);

const URL_CONTAINER_PRIORITIES = [
  "public",
  "secure",
  "signed",
  "download",
  "default",
  "raw",
  "url",
  "href",
  "link",
  "location",
  "media",
];

let visitedForExtraction = new WeakSet<object>();

function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(https?:|wss?:|ftp:|data:|blob:|gs:|s3:)/i.test(trimmed)) return true;
  if (trimmed.startsWith("//")) return true;
  if (trimmed.startsWith("/")) return true;
  if (!trimmed.includes(" ") && trimmed.includes("/")) {
    const lastSegment = trimmed.split(/[?#]/)[0].split("/").pop();
    if (lastSegment && lastSegment.includes(".")) {
      return true;
    }
  }
  if (!trimmed.includes(" ") && trimmed.includes("\\")) {
    const lastSegment = trimmed.split(/[?#]/)[0].split(/\\/).pop();
    if (lastSegment && lastSegment.includes(".")) {
      return true;
    }
  }
  return false;
}

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, "/");
}

function sanitizePotentialUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = normalizePathSeparators(value).trim();
  if (!normalized) return undefined;

  if (normalized.startsWith("//")) {
    return normalized;
  }

  const protocolMatch = normalized.match(/^([a-z][a-z0-9+\-.]*):/i);
  if (protocolMatch) {
    const scheme = protocolMatch[1]?.toLowerCase() ?? "";
    if (scheme && scheme.length > 1) {
      return normalized;
    }
    // If it's a single-letter scheme like "C:", treat it as a filesystem path and keep processing.
  }

  const staticMatch = normalized.match(/\/static\/[\w./-]+/i);
  if (staticMatch && staticMatch[0]) {
    const candidate = staticMatch[0];
    return candidate.startsWith("/") ? candidate : `/${candidate}`;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  if (/^(?:static|uploads|media)\//i.test(normalized)) {
    return `/${normalized}`;
  }

  return normalized;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = Number(value);
    if (!Number.isNaN(normalized)) {
      return normalized;
    }
  }
  return undefined;
}

export function coalesceString(
  ...values: Array<string | null | undefined>
): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function coalesceNumber(
  ...values: Array<number | string | null | undefined>
): number | undefined {
  for (const value of values) {
    const normalized = coerceNumber(value);
    if (normalized !== undefined) {
      return normalized;
    }
  }
  return undefined;
}

function collectNodes(root: UploadResponsePayload): UploadResponsePayload[] {
  const nodes: UploadResponsePayload[] = [];
  const queue: unknown[] = [root];
  const visited = new WeakSet<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current as object)) continue;
    visited.add(current as object);
    nodes.push(current as UploadResponsePayload);

    for (const value of Object.values(current as Record<string, unknown>)) {
      if (!value) continue;
      if (typeof value === "object") {
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (entry && typeof entry === "object") {
              queue.push(entry);
            }
          }
        } else {
          queue.push(value);
        }
      }
    }
  }

  return nodes;
}

function extractStringCandidate(
  value: unknown,
  validator?: (value: string) => boolean,
): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (!validator || validator(trimmed)) {
      return trimmed;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractStringCandidate(entry, validator);
      if (candidate) return candidate;
    }
  } else if (typeof value === "object") {
    if (visitedForExtraction.has(value as object)) {
      return undefined;
    }
    visitedForExtraction.add(value as object);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const candidate = extractStringCandidate(nested, validator);
      if (candidate) return candidate;
    }
  }
  return undefined;
}

function pickStringFromNodes(
  nodes: UploadResponsePayload[],
  keys: Array<keyof UploadResponsePayload | string>,
  validator?: (value: string) => boolean,
): string | undefined {
  visitedForExtraction = new WeakSet<object>();
  for (const node of nodes) {
    for (const key of keys) {
      if (!(key in node)) continue;
      const raw = node[key as keyof UploadResponsePayload];
      const candidate = extractStringCandidate(raw, validator);
      if (candidate) return candidate;
    }
  }
  return undefined;
}

function pickNumberFromNodes(
  nodes: UploadResponsePayload[],
  keys: Array<keyof UploadResponsePayload | string>,
): number | undefined {
  for (const node of nodes) {
    for (const key of keys) {
      if (!(key in node)) continue;
      const raw = node[key as keyof UploadResponsePayload];
      if (raw === undefined || raw === null) continue;
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          const numeric = coerceNumber(entry);
          if (numeric !== undefined) {
            return numeric;
          }
        }
      } else {
        const numeric = coerceNumber(raw);
        if (numeric !== undefined) {
          return numeric;
        }
      }
    }
  }
  return undefined;
}

function searchUrlContainers(nodes: UploadResponsePayload[]): string | undefined {
  visitedForExtraction = new WeakSet<object>();
  for (const node of nodes) {
    for (const key of Object.keys(node)) {
      if (!URL_CONTAINER_KEYS.has(key)) continue;
      const raw = (node as Record<string, unknown>)[key];
      if (!raw) continue;
      if (typeof raw === "string") {
        if (isLikelyUrl(raw)) return raw.trim();
        continue;
      }
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          const candidate = extractStringCandidate(entry, isLikelyUrl);
          if (candidate) return candidate;
        }
        continue;
      }
      if (typeof raw === "object") {
        for (const priority of URL_CONTAINER_PRIORITIES) {
          const nested = (raw as Record<string, unknown>)[priority];
          const candidate = extractStringCandidate(nested, isLikelyUrl);
          if (candidate) {
            return candidate;
          }
        }
        for (const nested of Object.values(raw as Record<string, unknown>)) {
          const candidate = extractStringCandidate(nested, isLikelyUrl);
          if (candidate) return candidate;
        }
      }
    }
  }
  return undefined;
}

export function normalizeUploadResponse(
  raw: unknown,
): NormalizedUploadMetadata {
  if (!raw) {
    return {};
  }

  if (typeof raw === "string") {
    const candidate = sanitizePotentialUrl(raw);
    return candidate ? { url: candidate, name: decodeMaybe(candidate.split(/[?#]/)[0].split("/").pop() || "") } : {};
  }

  if (typeof raw !== "object") {
    return {};
  }

  const nodes = collectNodes(raw as UploadResponsePayload);
  if (!nodes.length) {
    return {};
  }

  const rawUrlCandidate =
    pickStringFromNodes(nodes, PRIMARY_URL_KEYS, isLikelyUrl) ||
    searchUrlContainers(nodes);
  const url = sanitizePotentialUrl(rawUrlCandidate);

  const name = pickStringFromNodes(nodes, NAME_KEYS, (value) => value.length > 0);
  const mimeType = pickStringFromNodes(nodes, MIME_KEYS, (value) => value.includes("/"));
  const size = pickNumberFromNodes(nodes, SIZE_KEYS);
  const rawThumbCandidate =
    pickStringFromNodes(nodes, THUMB_KEYS, isLikelyUrl) ||
    searchUrlContainers(
      nodes.filter((node) =>
        Object.keys(node).some((key) => URL_CONTAINER_KEYS.has(key)),
      ),
    );
  const thumbUrl = sanitizePotentialUrl(rawThumbCandidate);

  const derivedName =
    name ||
    (url
      ? decodeMaybe(url.split(/[?#]/)[0].split("/").pop() || "")
      : undefined);

  return {
    url: url || undefined,
    name: derivedName || undefined,
    mimeType: mimeType || undefined,
    size: size || undefined,
    thumbUrl: thumbUrl || undefined,
  };
}
