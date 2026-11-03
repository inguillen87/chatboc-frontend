import { ReadableStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number, public body: unknown = null) { super(message); }
  },
}));

import {
  BACKOFFICE_EXPORT_MAX_BYTES,
  downloadPrivateBackofficeExport,
  readPrivateBackofficeExport,
  type ExportFormat,
  type ExportSelection,
  type PrivateBackofficeExport,
} from './backofficeExportDownload';

const encoder = new TextEncoder();
const csv = encoder.encode('contact_id,channel\r\n101,whatsapp\r\n');
const nativeBlob = globalThis.Blob;
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const mimes: Record<ExportFormat, string> = {
  csv: 'text/csv', pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
let createUrl: ReturnType<typeof vi.fn>;
let revokeUrl: ReturnType<typeof vi.fn>;
let windowOpen: ReturnType<typeof vi.spyOn>;
let click: ReturnType<typeof vi.spyOn>;
let blobConstructions: number;

const selection = (format: ExportFormat = 'csv'): ExportSelection => ({
  tenant_slug: 'fixture-a', tenant_id: 11, resource: 'contacts', format,
});

function headers(format: ExportFormat = 'csv', rows = 1): Headers {
  return new Headers({
    'Content-Type': mimes[format] + (format === 'csv' ? '; charset=utf-8' : ''),
    'Content-Disposition': `attachment; filename="contacts-fixture.${format}"`,
    'Cache-Control': 'private, no-store',
    'X-Export-Contract': 'backoffice.export.v2',
    'X-Tenant-Slug': 'fixture-a', 'X-Tenant-Id': '11',
    'X-Export-Resource': 'contacts', 'X-Export-Format': format,
    'X-Export-Total-Rows': String(rows), 'X-Export-Row-Count': String(rows),
    'X-Export-Complete': 'true',
  });
}

function response(body: BodyInit = csv as unknown as BodyInit, format: ExportFormat = 'csv', rows = 1): Response {
  return new Response(body, { status: 200, headers: headers(format, rows) });
}

function pendingResponse(): {
  response: Response;
  controller: ReadableStreamDefaultController<Uint8Array>;
  cancelled: ReturnType<typeof vi.fn>;
} {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancelled = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    cancel: cancelled,
  });
  return { response: response(stream as unknown as BodyInit), controller, cancelled };
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

beforeEach(() => {
  blobConstructions = 0;
  vi.stubGlobal('Blob', class ObservedBlob extends nativeBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      blobConstructions += 1;
    }
  });
  createUrl = vi.fn(() => 'blob:https://fixture.invalid/owned-export');
  revokeUrl = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: createUrl, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeUrl, configurable: true, writable: true });
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate); else delete (URL as any).createObjectURL;
  if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke); else delete (URL as any).revokeObjectURL;
  document.querySelectorAll('a[download]').forEach(anchor => anchor.remove());
});

describe('readPrivateBackofficeExport', () => {
  it.each([
    ['csv', csv],
    ['pdf', encoder.encode('%PDF-1.7\nfixture export bytes\n%%EOF\n')],
    ['xlsx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03])],
  ] as const)('preserves the authenticated %s response bytes and scoped contract', async (format, bytes) => {
    // This validates the download contract and byte preservation, not a PDF/XLSX parser.
    const source = response(bytes as unknown as BodyInit, format);
    const result = await readPrivateBackofficeExport(source, selection(format), () => true);
    expect(result).toMatchObject({ filename: `contacts-fixture.${format}`, tenantSlug: 'fixture-a',
      tenantId: 11, resource: 'contacts', format, rowCount: 1, totalRows: 1, complete: true });
    expect(source.bodyUsed).toBe(true);
    expect(result.blob.size).toBe(bytes.byteLength);
    expect(result.blob.type).toBe(mimes[format]);
    expect(Array.from(await blobBytes(result.blob))).toEqual(Array.from(bytes));
    expect(createUrl).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('preserves a legitimate zero-row report whose CSV still contains its header', async () => {
    const bytes = encoder.encode('contact_id,channel\r\n');
    const result = await readPrivateBackofficeExport(response(bytes as unknown as BodyInit, 'csv', 0), selection());
    expect(result).toMatchObject({ rowCount: 0, totalRows: 0, complete: true });
    expect(Array.from(await blobBytes(result.blob))).toEqual(Array.from(bytes));
  });

  it.each([
    ['contract', 'X-Export-Contract', 'legacy.v1'],
    ['tenant ID', 'X-Tenant-Id', '22'],
    ['tenant slug', 'X-Tenant-Slug', 'fixture-other'],
    ['resource', 'X-Export-Resource', 'tickets'],
    ['format', 'X-Export-Format', 'pdf'],
    ['MIME', 'Content-Type', 'text/html'],
    ['complete flag', 'X-Export-Complete', 'false'],
    ['row count', 'X-Export-Row-Count', '0'],
    ['invalid total', 'X-Export-Total-Rows', 'unknown'],
    ['filename path', 'Content-Disposition', 'attachment; filename="../contacts.csv"'],
    ['filename extension', 'Content-Disposition', 'attachment; filename="contacts.html"'],
    ['cache policy', 'Cache-Control', 'public, max-age=300'],
  ])('rejects a mismatched %s before consuming response bytes', async (_case, name, value) => {
    const source = response();
    source.headers.set(name, value);
    await expect(readPrivateBackofficeExport(source, selection())).rejects.toMatchObject({ status: 502 });
    expect(source.bodyUsed).toBe(false);
    expect(blobConstructions).toBe(0);
    expect(createUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('rejects a missing tenant ID before consuming response bytes', async () => {
    const source = response();
    source.headers.delete('X-Tenant-Id');
    await expect(readPrivateBackofficeExport(source, selection())).rejects.toMatchObject({ status: 502 });
    expect(source.bodyUsed).toBe(false);
    expect(blobConstructions).toBe(0);
  });

  it('cancels a stream that exceeds the 16 MiB decoded-byte limit without constructing a file', async () => {
    const pending = pendingResponse();
    expect(BACKOFFICE_EXPORT_MAX_BYTES).toBe(16 * 1024 * 1024);
    pending.controller.enqueue(new Uint8Array(16 * 1024 * 1024));
    pending.controller.enqueue(new Uint8Array([1]));
    await expect(readPrivateBackofficeExport(pending.response, selection())).rejects.toMatchObject({ status: 413 });
    expect(pending.cancelled).toHaveBeenCalledTimes(1);
    expect(pending.response.bodyUsed).toBe(true);
    expect(blobConstructions).toBe(0);
    expect(createUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('cancels a scope retired while body reading is pending without constructing a Blob or URL', async () => {
    const pending = pendingResponse();
    let current = true;
    const reading = readPrivateBackofficeExport(pending.response, selection(), () => current);
    const rejected = expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(pending.response.bodyUsed).toBe(true);
    current = false;
    pending.controller.enqueue(csv);
    await rejected;
    expect(pending.cancelled).toHaveBeenCalledTimes(1);
    expect(blobConstructions).toBe(0);
    expect(createUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('times out a stalled body at 30 seconds and cancels its stream', async () => {
    vi.useFakeTimers();
    const pending = pendingResponse();
    const reading = readPrivateBackofficeExport(pending.response, selection());
    const rejected = expect(reading).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(pending.cancelled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(pending.cancelled).toHaveBeenCalledTimes(1);
    expect(blobConstructions).toBe(0);
    expect(createUrl).not.toHaveBeenCalled();
  });
});

describe('downloadPrivateBackofficeExport', () => {
  async function file(): Promise<PrivateBackofficeExport> {
    return readPrivateBackofficeExport(response(), selection());
  }

  it('downloads through a local anchor, removes it and revokes its URL after consumption time', async () => {
    const result = await file();
    vi.useFakeTimers();
    let observed: { href: string; filename: string; attached: boolean } | undefined;
    click.mockImplementation(function(this: HTMLAnchorElement) {
      observed = { href: this.href, filename: this.download, attached: document.body.contains(this) };
    });
    downloadPrivateBackofficeExport(result, () => true);
    expect(createUrl).toHaveBeenCalledWith(result.blob);
    expect(observed).toEqual({ href: 'blob:https://fixture.invalid/owned-export', filename: 'contacts-fixture.csv', attached: true });
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeUrl).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:https://fixture.invalid/owned-export');
  });

  it('discards an already retired export before allocating a URL or clicking', async () => {
    const result = await file();
    expect(() => downloadPrivateBackofficeExport(result, () => false)).toThrow();
    expect(createUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('revokes an allocated URL immediately if scope changes before the click', async () => {
    const result = await file();
    let current = true;
    createUrl.mockImplementation(() => { current = false; return 'blob:https://fixture.invalid/owned-export'; });
    expect(() => downloadPrivateBackofficeExport(result, () => current)).toThrow();
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:https://fixture.invalid/owned-export');
    expect(click).not.toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('removes the anchor and revokes its URL if the browser refuses its click', async () => {
    const result = await file();
    click.mockImplementation(() => { throw new Error('Fixture download refused'); });
    expect(() => downloadPrivateBackofficeExport(result, () => true)).toThrow('Fixture download refused');
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:https://fixture.invalid/owned-export');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('revokes an allocated URL if creating its download anchor fails', async () => {
    const result = await file();
    const sentinel = new Error('Fixture anchor creation refused');
    vi.spyOn(document, 'createElement').mockImplementation(() => { throw sentinel; });
    expect(() => downloadPrivateBackofficeExport(result, () => true)).toThrow(sentinel);
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith('blob:https://fixture.invalid/owned-export');
    expect(click).not.toHaveBeenCalled();
    expect(windowOpen).not.toHaveBeenCalled();
  });
});
