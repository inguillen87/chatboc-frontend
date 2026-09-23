export type OperationsRefreshMode = 'core' | 'all';
export type OperationsRefreshCause = 'manual' | 'event' | 'timer' | 'resume';
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const operationsTenantSlug = (value: unknown): string | null => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value) ? value : null;
function tenantHints(value: unknown): unknown[] {
  const data = record(value), tenant = record(data.tenant);
  return [data.tenant_slug, typeof data.tenant === 'string' ? data.tenant : undefined, tenant.slug, tenant.tenant_slug].filter((v) => v !== undefined && v !== null);
}
export function operationsEventMatchesTenant(value: unknown, tenantSlug: string): boolean {
  const data = record(value);
  const hints = [...tenantHints(data), ...tenantHints(data.payload)];
  return Boolean(operationsTenantSlug(tenantSlug)) && hints.length > 0 && hints.every((hint) => hint === tenantSlug);
}
export function assertOperationsResponseScope<T>(value: T, tenantSlug: string): T {
  if (!operationsTenantSlug(tenantSlug) || tenantHints(value).some((hint) => hint !== tenantSlug)) {
    throw Object.assign(new Error('La respuesta operativa no corresponde a la organización seleccionada.'), { status: 403 });
  }
  return value;
}
export function visibleOperationsQuery<T extends { data?: unknown; isError: boolean }>(query: T): T {
  return query.isError ? { ...query, data: undefined } : query;
}
export interface OperationsReadSource {
  id: string; label: string; isError: boolean; isFetching: boolean; isLoading: boolean;
  data?: unknown; dataUpdatedAt?: number; fetchStatus?: string;
}
export type OperationsSourceState = 'error' | 'loading' | 'refreshing' | 'ready' | 'empty' | 'paused';
export function operationsSourceState(source: OperationsReadSource): OperationsSourceState {
  if (source.isError) return 'error';
  if (source.fetchStatus === 'paused') return 'paused';
  if (source.isLoading || (source.isFetching && source.data === undefined)) return 'loading';
  if (source.isFetching) return 'refreshing';
  return source.data === null || source.data === undefined ? 'empty' : 'ready';
}
/** One read batch in flight, one trailing batch, visible tabs only. No writes. */
export function createOperationsRefreshCoordinator(options: {
  run: (mode: OperationsRefreshMode) => Promise<unknown>;
  visible: () => boolean;
  onBusy?: (busy: boolean) => void;
  debounceMs?: number;
}) {
  let pending: OperationsRefreshMode | null = null;
  let running = false, disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const delay = options.debounceMs ?? 250;
  const merge = (mode: OperationsRefreshMode) => { pending = pending === 'all' || mode === 'all' ? 'all' : 'core'; };
  const arm = () => {
    if (!disposed && !running && pending && options.visible() && !timer) timer = setTimeout(() => { timer = undefined; void flush(); }, delay);
  };
  async function flush() {
    if (disposed || running || !pending || !options.visible()) return;
    const mode = pending; pending = null; running = true; options.onBusy?.(true);
    try { await options.run(mode); } catch { /* Query state reports failures. Scheduling must not cause unhandled rejections. */ }
    finally { running = false; if (!disposed) { options.onBusy?.(false); arm(); } }
  }
  return {
    request(mode: OperationsRefreshMode, cause: OperationsRefreshCause = 'event') {
      if (disposed || (running && cause === 'manual')) return;
      merge(mode);
      if (cause === 'manual' && options.visible() && !running) {
        if (timer) clearTimeout(timer); timer = undefined; void flush();
      } else arm();
    },
    visibilityChanged() {
      if (!options.visible()) { if (timer) clearTimeout(timer); timer = undefined; return; }
      arm();
    },
    dispose() { disposed = true; pending = null; if (timer) clearTimeout(timer); timer = undefined; },
  };
}
