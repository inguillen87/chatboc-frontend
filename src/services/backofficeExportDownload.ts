import { ApiError } from '@/utils/api';

export type ExportResource = 'tickets' | 'orders' | 'contacts' | 'team';
export type ExportFormat = 'pdf' | 'csv' | 'xlsx';

export interface ExportSelection {
  tenant_slug: string;
  tenant_id: number;
  resource: ExportResource;
  format: ExportFormat;
}

export interface PrivateBackofficeExport {
  blob: Blob;
  filename: string;
  tenantSlug: string;
  tenantId: number;
  resource: ExportResource;
  format: ExportFormat;
  rowCount: number;
  totalRows: number;
  complete: true;
}

export const BACKOFFICE_EXPORT_MAX_BYTES = 16 * 1024 * 1024;
const mimeTypes: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const invalidExport = () => new ApiError(
  'No pudimos verificar el reporte. Actualizá el panel e intentá nuevamente.', 502,
  { code: 'private_export_contract_invalid' },
);

const countHeader = (response: Response, name: string): number => {
  const value = response.headers.get(name);
  if (!value || !/^(0|[1-9][0-9]*)$/.test(value)) throw invalidExport();
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw invalidExport();
  return number;
};

export function assertExportCurrent(isCurrent?: () => boolean): void {
  if (isCurrent?.() === false) throw new DOMException('Export scope retired', 'AbortError');
}

/** Read only an authenticated file response whose scope and completeness match. */
export async function readPrivateBackofficeExport(
  response: Response,
  selection: ExportSelection,
  isCurrent?: () => boolean,
): Promise<PrivateBackofficeExport> {
  assertExportCurrent(isCurrent);
  if (!response?.ok || typeof response.headers?.get !== 'function' || !response.body ||
      response.headers.get('X-Export-Contract') !== 'backoffice.export.v2' ||
      response.headers.get('X-Tenant-Slug') !== selection.tenant_slug ||
      response.headers.get('X-Tenant-Id') !== String(selection.tenant_id) ||
      response.headers.get('X-Export-Resource') !== selection.resource ||
      response.headers.get('X-Export-Format') !== selection.format ||
      response.headers.get('X-Export-Complete') !== 'true') throw invalidExport();
  const mime = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const cache = new Set((response.headers.get('Cache-Control') || '').toLowerCase().split(',').map(v => v.trim()));
  if (mime !== mimeTypes[selection.format] || !cache.has('private') || !cache.has('no-store')) throw invalidExport();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /^attachment\s*;\s*filename=(?:"([^"\r\n]+)"|([^;\s]+))\s*$/i.exec(disposition);
  const filename = match?.[1] || match?.[2] || '';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(filename) ||
      !filename.endsWith(`.${selection.format}`)) throw invalidExport();
  const rowCount = countHeader(response, 'X-Export-Row-Count');
  const totalRows = countHeader(response, 'X-Export-Total-Rows');
  if (rowCount !== totalRows) throw invalidExport();

  // Bound decoded bytes, including when HTTP compression changes Content-Length.
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => undefined);
  }, 30_000);
  try {
    while (true) {
      assertExportCurrent(isCurrent);
      const chunk = await reader.read();
      assertExportCurrent(isCurrent);
      if (timedOut) throw new ApiError('La descarga tardó demasiado. Intentá nuevamente.', 504,
        { code: 'private_export_read_timeout' });
      if (chunk.done) break;
      if (!ArrayBuffer.isView(chunk.value)) throw invalidExport();
      size += chunk.value.byteLength;
      if (size > BACKOFFICE_EXPORT_MAX_BYTES) throw new ApiError(
        'El reporte supera el límite de descarga. Reducí los filtros e intentá nuevamente.', 413,
        { code: 'private_export_too_large' },
      );
      const copy = new Uint8Array(chunk.value.byteLength);
      copy.set(chunk.value);
      chunks.push(copy);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
  if (!size) throw invalidExport();
  assertExportCurrent(isCurrent);
  const blob = new Blob(chunks, { type: mimeTypes[selection.format] });
  return { blob, filename, tenantSlug: selection.tenant_slug, tenantId: selection.tenant_id,
    resource: selection.resource, format: selection.format, rowCount, totalRows, complete: true };
}

/** The only navigation is a short-lived local Blob URL, never a server URL. */
export function downloadPrivateBackofficeExport(
  result: PrivateBackofficeExport,
  isCurrent: () => boolean,
): void {
  assertExportCurrent(isCurrent);
  const revoke = URL.revokeObjectURL.bind(URL);
  const url = URL.createObjectURL(result.blob);
  let started = false;
  let anchor: HTMLAnchorElement | undefined;
  try {
    anchor = document.createElement('a');
    assertExportCurrent(isCurrent);
    anchor.href = url;
    anchor.download = result.filename;
    anchor.rel = 'noopener noreferrer';
    anchor.hidden = true;
    document.body.appendChild(anchor);
    assertExportCurrent(isCurrent);
    anchor.click();
    started = true;
  } finally {
    anchor?.remove();
    // Give the browser time to consume the click before releasing its URL.
    if (started) setTimeout(() => revoke(url), 1000);
    else revoke(url);
  }
}
