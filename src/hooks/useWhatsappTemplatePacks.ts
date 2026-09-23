import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch, getErrorMessage } from '@/utils/api';
import { waitForAbort } from '@/utils/waitForAbort';
import { CATALOG_PATH, DRAFT_PATH, TemplatePackContractError, readDraftReceipt,
  readTemplateCatalog, templateDraftKey, type TemplatePack, type TemplatePackCatalog } from '@/components/admin/whatsappTemplatePackContract';

const WAIT_MS = 30000;
const accessFailure = (error: unknown) => error instanceof TemplatePackContractError
  || (error instanceof ApiError && [401, 403, 404].includes(error.status));

/** Mount once per organization. Cancels local waits, not a server transaction. */
export function useWhatsappTemplatePacks(scope: string) {
  const [catalog, setCatalog] = useState<TemplatePackCatalog | null>(null);
  const [loading, setLoading] = useState(Boolean(scope));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingVertical, setSavingVertical] = useState<string | null>(null);
  const active = useRef(true);
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const keys = useRef(new Map<string, string>());
  const mountedCatalog = useRef<TemplatePackCatalog | null>(null);
  // Synchronous authority: retained callbacks cannot reuse a render's old error state.
  const verifiedAuthority = useRef(false);
  const current = (version: number) => active.current && revision.current === version;
  const reading = useRef(false);
  const refresh = useCallback(async () => {
    if (!active.current || !scope || mutation.current) return;
    verifiedAuthority.current = false;
    const version = ++revision.current;
    controller.current?.abort();
    const waiting = new AbortController(); controller.current = waiting;
    const timer = setTimeout(() => waiting.abort(), WAIT_MS);
    reading.current = true; setLoading(true); setError(null); setNotice(null);
    try {
      const value = await waitForAbort(apiFetch<unknown>(CATALOG_PATH, {
        tenantSlug: scope, persistTenantSlug: false, cache: 'no-store',
      }), waiting.signal);
      if (!current(version)) return;
      const verified = readTemplateCatalog(value, scope);
      mountedCatalog.current = verified;
      verifiedAuthority.current = true;
      setCatalog(verified);
    } catch (failure) {
      if (!current(version)) return;
      // Remove visible data and write authority, not an uncertain operation's identity.
      // A denied/malformed read does not prove that an earlier POST was rolled back.
      if (accessFailure(failure)) { setCatalog(null); mountedCatalog.current = null; }
      setError(failure instanceof TemplatePackContractError ? failure.message
        : waiting.signal.aborted ? 'La consulta tardó demasiado. Actualizá para volver a verificar las plantillas.'
        : getErrorMessage(failure, 'No pudimos verificar las plantillas. Actualizá antes de crear borradores.'));
    } finally {
      clearTimeout(timer);
      if (current(version)) { reading.current = false; setLoading(false); }
    }
  }, [scope]);
  useEffect(() => {
    active.current = true; void refresh();
    return () => {
      active.current = false; verifiedAuthority.current = false;
      ++revision.current; controller.current?.abort();
    };
  }, [refresh]);
  const materialize = async (selected: TemplatePack) => {
    const snapshot = mountedCatalog.current;
    const pack = snapshot?.packs.find((item) => item.vertical === selected.vertical);
    if (!active.current || !verifiedAuthority.current || !scope || mutation.current || reading.current || error || !snapshot || !pack
      || snapshot.capabilities?.materialize_local_draft !== true || snapshot.endpoints?.materialize_template !== DRAFT_PATH
      || selected !== pack || selected.pack_id !== pack.pack_id || selected.pack_version !== pack.pack_version
      || !pack.templates.length || pack.templates.every((item) => item.materialized)) return;
    // Include the endpoint's vertical; JSON tuples cannot collide on ':' in metadata.
    // Normalize numeric/string tenant IDs the same way as the verified contract.
    const operationKey = JSON.stringify([scope, String(snapshot.tenant.id), pack.vertical, pack.pack_id, pack.pack_version]);
    let key = keys.current.get(operationKey);
    try { if (!key) { key = templateDraftKey(pack); keys.current.set(operationKey, key); } }
    catch (failure) { verifiedAuthority.current = false; setError((failure as Error).message); return; }
    mutation.current = true; verifiedAuthority.current = false; const version = ++revision.current;
    controller.current?.abort(); const waiting = new AbortController(); controller.current = waiting;
    const timer = setTimeout(() => waiting.abort(), WAIT_MS);
    setSavingVertical(pack.vertical); setError(null); setNotice(null);
    try {
      const response = await waitForAbort(apiFetch<unknown>(DRAFT_PATH.replace('{vertical}', encodeURIComponent(pack.vertical)), {
        method: 'POST', tenantSlug: scope, persistTenantSlug: false, cache: 'no-store', headers: { 'Idempotency-Key': key }, body: { pack_version: pack.pack_version },
      }), waiting.signal);
      if (!current(version)) return;
      const verified = readDraftReceipt(response, snapshot, pack);
      const next = { ...snapshot, packs: snapshot.packs.map((item) => item.vertical === pack.vertical ? verified : item) };
      // Commit local authority before releasing the in-flight guard or React rerenders.
      mountedCatalog.current = next;
      verifiedAuthority.current = true;
      setCatalog(next);
      keys.current.delete(operationKey);
      setNotice('Borradores confirmados. Este paso no envía mensajes ni solicita aprobación a Meta.');
    } catch (failure) {
      if (!current(version)) return;
      if (accessFailure(failure)) { setCatalog(null); mountedCatalog.current = null; }
      // Neither a timeout nor an HTTP status proves that the server rolled back.
      // In particular, 408/409/429 must not silently rotate the idempotency key.
      // Keep it for this mounted workspace until a matching success is verified.
      // A fresh authorized catalogue and an explicit click are still required.
      setError(failure instanceof TemplatePackContractError ? failure.message
        : 'No pudimos confirmar la creación. Actualizá el estado antes de reintentar; no se enviaron mensajes desde este panel.');
    } finally {
      clearTimeout(timer);
      if (current(version)) { mutation.current = false; setSavingVertical(null); }
    }
  };
  return { catalog, loading, error, notice, savingVertical, refresh, materialize,
    canMaterialize: Boolean(scope && catalog?.capabilities?.materialize_local_draft === true
      && catalog.endpoints?.materialize_template === DRAFT_PATH && !loading && !error && !savingVertical) };
}
