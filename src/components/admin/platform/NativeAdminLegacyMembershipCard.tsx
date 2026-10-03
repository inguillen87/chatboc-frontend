import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { hasRequiredRole } from '@/utils/roles';
import { ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { applyNativeAdminLegacyMembership, getNativeAdminLegacyMembership, listNativeAdminLegacyMemberships,
  type NativeAdminLegacyMembership, type NativeAdminTenant } from './nativeAdminLegacyMembership';

const stateLabel = (state: NativeAdminLegacyMembership['state']) => state === 'already_consistent'
  ? 'Vinculación correcta' : state === 'needs_normalization' ? 'Vinculación pendiente de corregir' : 'Corrección no habilitada';
const errorText = (error: unknown, applying: boolean) => error instanceof ApiError && error.status === 412
  ? 'La vinculación cambió. Volvé a consultarla antes de confirmar.'
  : error instanceof ApiError && [401, 403].includes(error.status)
    ? 'No tenés acceso a esta revisión.' : applying
      ? 'No pudimos comprobar el resultado. Volvé a consultar la vinculación antes de realizar otra acción.'
      : 'No pudimos verificar la vinculación. Volvé a consultar.';
const isAccessDenied = (error: unknown) => error instanceof ApiError && [401, 403].includes(error.status);

export function NativeAdminLegacyMembershipCard({ tenant }: { tenant: NativeAdminTenant }) {
  const { user, hasVerifiedSession, organizationProfileVerified } = useUser();
  const verifiedScope = hasVerifiedSession && organizationProfileVerified && hasRequiredRole(user?.rol, ['superadmin'])
    ? buildVerifiedSessionScopeKey({ hasVerifiedSession, user, tenantSlug: tenant.slug }) : null;
  const scope = verifiedScope ? JSON.stringify([verifiedScope, tenant.id, captureChatbocSessionRevision()]) : null;
  const activeScope = useRef(scope); activeScope.current = scope;
  const mounted = useRef(false), sequence = useRef(0), applyingRef = useRef(false);
  const [items, setItems] = useState<NativeAdminLegacyMembership[]>([]);
  const [loading, setLoading] = useState(false), [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null), [review, setReview] = useState<NativeAdminLegacyMembership | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false), [applying, setApplying] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null), [applied, setApplied] = useState(false);
  const currentRequest = useCallback(() => {
    const initiatedScope = scope, epoch = ++sequence.current, sessionRevision = captureChatbocSessionRevision();
    return () => mounted.current && initiatedScope !== null && activeScope.current === initiatedScope &&
      sequence.current === epoch && isChatbocSessionRevisionCurrent(sessionRevision);
  }, [scope]);
  const loadList = useCallback(async () => {
    if (!scope || applyingRef.current) return;
    const isCurrent = currentRequest(); setLoading(true); setListError(null); setItems([]);
    try { const result = await listNativeAdminLegacyMemberships(tenant, isCurrent); if (isCurrent()) setItems(result); }
    catch (error) { if (isCurrent()) setListError(errorText(error, false)); }
    finally { if (isCurrent()) setLoading(false); }
  }, [scope, currentRequest, tenant.id, tenant.slug]);
  useEffect(() => {
    mounted.current = true; sequence.current += 1; applyingRef.current = false;
    setSelectedId(null); setReview(null); setReviewError(null); setApplied(false); setApplying(false); setReviewLoading(false); setItems([]);
    if (scope) void loadList();
    return () => { mounted.current = false; sequence.current += 1; };
  }, [scope, loadList]);
  const loadReview = async (userId: number) => {
    if (!scope || applyingRef.current) return;
    const isCurrent = currentRequest(); setSelectedId(userId); setReview(null); setReviewError(null); setApplied(false); setReviewLoading(true);
    try { const result = await getNativeAdminLegacyMembership(tenant, userId, isCurrent); if (isCurrent()) setReview(result); }
    catch (error) { if (isCurrent()) { setReviewError(errorText(error, false)); if (isAccessDenied(error)) { setItems([]); setListError(errorText(error, false)); } } }
    finally { if (isCurrent()) setReviewLoading(false); }
  };
  const confirm = async () => {
    if (!scope || !review?.can_apply || applyingRef.current) return;
    const isCurrent = currentRequest(), snapshot = review;
    applyingRef.current = true; setApplying(true); setReviewError(null);
    try {
      if (typeof crypto.randomUUID !== 'function') throw new Error('request_identity_unavailable');
      const updated = await applyNativeAdminLegacyMembership(snapshot, crypto.randomUUID(), isCurrent);
      if (!isCurrent()) return;
      setReview(updated); setItems(rows => rows.map(row => row.target.id === updated.target.id ? updated : row)); setApplied(true);
    } catch (error) { if (isCurrent()) { setReview(null); setReviewError(errorText(error, true)); if (isAccessDenied(error)) { setItems([]); setListError(errorText(error, false)); } } }
    finally { if (isCurrent()) { applyingRef.current = false; setApplying(false); } }
  };
  const closeReview = () => { sequence.current += 1; setSelectedId(null); setReview(null); setReviewError(null); setApplied(false); };
  if (!scope) return null;
  return <section className="space-y-3 rounded-md border p-4" aria-label="Administradores existentes">
    <h3 className="text-sm font-medium">Administradores existentes</h3>
    <p className="text-sm text-muted-foreground">Revisá la vinculación de los administradores nativos de esta organización.</p>
    {loading ? <p role="status">Cargando administradores…</p> : listError ? <p role="alert">{listError}</p>
      : !items.length ? <p className="text-sm text-muted-foreground">No hay administradores nativos revisables.</p>
        : <ul className="space-y-3">{items.map(item => <li key={item.target.id} className="space-y-1 rounded-md border p-3">
          <p className="text-sm font-medium">{item.target.name || item.target.email}</p>
          <p className="break-all text-sm text-muted-foreground">{item.target.email} · ID {item.target.id}</p>
          <p className="text-sm">{stateLabel(item.state)}</p>
          <Button type="button" variant="outline" size="sm" disabled={loading || applying} onClick={() => void loadReview(item.target.id)}>
            Revisar vinculación<span className="sr-only"> de {item.target.email}</span>
          </Button>
        </li>)}</ul>}
    <Button type="button" variant="ghost" size="sm" disabled={loading || applying} onClick={() => void loadList()}>Actualizar lista</Button>
    <Dialog open={selectedId !== null} onOpenChange={open => { if (!open && !applying) closeReview(); }}>
      <DialogContent onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('legacy-membership-cancel')?.focus(); }}>
        <DialogHeader><DialogTitle>Revisar vinculación</DialogTitle>
          <DialogDescription>{tenant.nombre || tenant.slug} · administrador ID {selectedId}</DialogDescription></DialogHeader>
        {reviewLoading ? <p role="status">Consultando vinculación…</p> : reviewError ? <p role="alert">{reviewError}</p> : review ? <div className="space-y-2 text-sm">
          <p className="font-medium">{review.target.name || review.target.email}</p><p className="break-all">{review.target.email}</p>
          <p>{stateLabel(review.state)}</p>
          <dl className="space-y-1"><div><dt className="inline font-medium">Referencia actual: </dt><dd className="inline">{review.relation.current_owner_reference ?? 'Sin referencia'}</dd></div>
            <div><dt className="inline font-medium">Referencia esperada: </dt><dd className="inline">{review.relation.expected_owner_reference ?? 'Sin referencia'}</dd></div></dl>
          <p className="text-muted-foreground">La contraseña, el rol y la pertenencia a la organización se conservan.</p>
          {applied && <p role="status">Vinculación corregida y resultado verificado.</p>}
        </div> : null}
        <DialogFooter><Button id="legacy-membership-cancel" type="button" variant="outline" disabled={applying} onClick={closeReview}>Cerrar</Button>
          {reviewError && selectedId !== null ? <Button type="button" disabled={applying || reviewLoading} onClick={() => void loadReview(selectedId)}>Volver a consultar</Button>
            : <Button type="button" disabled={!review?.can_apply || applying || reviewLoading} onClick={() => void confirm()}>{applying ? 'Corrigiendo…' : 'Confirmar corrección de referencia'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
