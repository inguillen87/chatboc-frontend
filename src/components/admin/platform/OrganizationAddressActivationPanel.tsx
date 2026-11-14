import React, { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useUser } from '@/hooks/useUser';
import { hasRequiredRole } from '@/utils/roles';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { ApiError } from '@/utils/api';
import { ViewState } from '@/components/app-shell/ViewState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { activateTenantAddress, getTenantAddresses, normalizeAddressActivationCandidate, planTenantAddressActivation,
  TENANT_ADDRESSES_REFRESH_LABEL, TenantAddressesContractError, tenantAddressesErrorMessage,
  type AddressActivationCandidate, type AddressActivationPlan, type AddressKind, type AddressTenantScope,
  type TenantAddresses } from '@/api/tenantAddresses';

const emptyCandidate = (): AddressActivationCandidate => ({ frontend_deployment: '', frontend_source: '', routes_sha256: '' });
type Busy = 'descriptor' | 'plan' | 'activate' | null;
type Review = { plan: AddressActivationPlan; epoch: number; candidate: AddressActivationCandidate; kind: AddressKind };
const denied = (error: unknown) => error instanceof ApiError && [401, 403].includes(error.status);

/** Platform operator UI only. Branding and descriptor flags never grant a role. */
export function OrganizationAddressActivationPanel({ tenant }: { tenant: AddressTenantScope }) {
  const { user, hasVerifiedSession, organizationProfileVerified } = useUser();
  const revision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const scope = hasVerifiedSession && organizationProfileVerified && hasRequiredRole(user?.rol, ['superadmin'])
    ? buildVerifiedSessionScopeKey({ hasVerifiedSession, user, tenantSlug: tenant.slug }) : null;
  if (!scope || !Number.isSafeInteger(tenant.id) || tenant.id < 1) return null;
  // Re-mount on every committed identity/tenant/session transition, including ABA.
  return <AddressActivationSession key={JSON.stringify([scope, tenant.id, tenant.slug, revision])}
    tenant={tenant} sessionRevision={revision} />;
}

function AddressActivationSession({ tenant, sessionRevision }: { tenant: AddressTenantScope; sessionRevision: number }) {
  const id = useId(), alive = useRef(false), epoch = useRef(0);
  const flight = useRef<symbol | null>(null);
  const [descriptor, setDescriptor] = useState<TenantAddresses | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [kind, setKind] = useState<AddressKind>('platform');
  const [fields, setFields] = useState<AddressActivationCandidate>(emptyCandidate);
  const fieldsRef = useRef(fields), kindRef = useRef(kind);
  const [versionReviewed, setVersionReviewed] = useState(false);
  const reviewedRef = useRef(false);
  const [review, setReview] = useState<Review | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<keyof NonNullable<TenantAddresses['operator_ui']>['messages'] | null>(null);
  const [requiresStatusCheck, setRequiresStatusCheck] = useState(false);
  const [readError, setReadError] = useState<unknown>(null);
  const ui = descriptor?.operator_ui;
  const mountedCurrent = () => alive.current && isChatbocSessionRevisionCurrent(sessionRevision);
  const retireReview = () => {
    epoch.current += 1; setReview(null); setConfirmOpen(false); setMessage(null);
    if (busy === 'activate') setRequiresStatusCheck(true);
  };
  const begin = (phase: Exclude<Busy, null>) => {
    if (!mountedCurrent() || flight.current) return null;
    const token = Symbol(phase), started = ++epoch.current;
    flight.current = token; setBusy(phase);
    return { token, current: () => mountedCurrent() && epoch.current === started };
  };
  const finish = (token: symbol) => {
    if (mountedCurrent() && flight.current === token) { flight.current = null; setBusy(null); }
  };
  const clearDenied = () => {
    setDescriptor(null); fieldsRef.current = emptyCandidate(); setFields(fieldsRef.current);
    reviewedRef.current = false; setVersionReviewed(false);
  };
  const refresh = async () => {
    const request = begin('descriptor'); if (!request) return;
    setReview(null); setConfirmOpen(false); setMessage(null);
    reviewedRef.current = false; setVersionReviewed(false);
    try {
      const next = await getTenantAddresses(tenant, request.current);
      if (request.current()) { setDescriptor(next); setReadError(null); setRequiresStatusCheck(false); }
    } catch (error) {
      if (request.current()) { if (denied(error)) clearDenied(); setReadError(error); setMessage('descriptor_error'); setRequiresStatusCheck(true); }
    } finally { finish(request.token); }
  };
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; epoch.current += 1; }; }, []);
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!review) return;
    const expire = () => { epoch.current += 1; setReview(null); setConfirmOpen(false); setRequiresStatusCheck(true); setMessage('expired'); };
    const remaining = review.plan.valid_until * 1000 - Date.now();
    if (remaining <= 0) { expire(); return; }
    const timer = window.setTimeout(expire, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [review]);

  const changeField = (field: keyof AddressActivationCandidate, value: string) => {
    retireReview(); reviewedRef.current = false; setVersionReviewed(false);
    fieldsRef.current = { ...fieldsRef.current, [field]: value }; setFields(fieldsRef.current);
  };
  const changeKind = (value: string) => {
    if (value !== 'platform' && value !== 'custom') return;
    retireReview(); kindRef.current = value; setKind(value);
    reviewedRef.current = false; setVersionReviewed(false);
  };
  const capability = descriptor?.capabilities.activation;
  const slot = descriptor?.[kind];
  const candidate = normalizeAddressActivationCandidate(fields);
  const ready = Boolean(ui && capability?.available && capability.mode === 'platform_operator' &&
    !descriptor?.capabilities.writes_blocked && descriptor?.capabilities[kind].eligible && slot?.host && slot.status === 'pending_platform');
  const canPlan = ready && capability?.can_plan === true && Boolean(candidate) && versionReviewed && !requiresStatusCheck && !busy;
  const currentReview = review && review.epoch === epoch.current && review.kind === kind &&
    review.plan.plan.revision === descriptor?.revision && review.plan.valid_until * 1000 > Date.now();
  const canActivate = ready && capability?.can_activate === true && currentReview && !requiresStatusCheck && !busy;

  const plan = async () => {
    const current = descriptor, selectedKind = kindRef.current;
    const selectedCandidate = normalizeAddressActivationCandidate(fieldsRef.current);
    if (!canPlan || !current || !selectedCandidate || !reviewedRef.current) return;
    const request = begin('plan'); if (!request) return;
    setReview(null); setConfirmOpen(false); setMessage(null);
    const started = epoch.current;
    try {
      const result = await planTenantAddressActivation(tenant, current, selectedKind, selectedCandidate, request.current);
      if (request.current()) { setReview({ plan: result, epoch: started, candidate: selectedCandidate, kind: selectedKind }); setMessage('not_ready'); }
    } catch (error) {
      if (request.current()) {
        if (denied(error)) { clearDenied(); setReadError(error); }
        if (error instanceof ApiError && [409, 412, 428].includes(error.status)) setRequiresStatusCheck(true);
        setReview(null); setMessage('plan_error');
      }
    } finally { finish(request.token); }
  };
  const activate = async () => {
    const current = descriptor, snapshot = review;
    if (!canActivate || !current || !snapshot || snapshot.epoch !== epoch.current || !reviewedRef.current) return;
    const selectedCandidate = normalizeAddressActivationCandidate(fieldsRef.current);
    if (!selectedCandidate || JSON.stringify(selectedCandidate) !== JSON.stringify(snapshot.candidate) || kindRef.current !== snapshot.kind) {
      retireReview(); setMessage('descriptor_changed'); return;
    }
    const request = begin('activate'); if (!request) return;
    setMessage(null);
    try {
      const next = await activateTenantAddress(tenant, current, snapshot.kind, snapshot.candidate, snapshot.plan, request.current);
      if (request.current()) { setDescriptor(next); setReview(null); setConfirmOpen(false); setRequiresStatusCheck(false); setMessage('success'); }
    } catch (error) {
      if (request.current()) {
        if (denied(error)) { clearDenied(); setReadError(error); }
        // A sent request cannot be undone. Only a fresh GET can reconcile it.
        setReview(null); setConfirmOpen(false); setRequiresStatusCheck(true); setMessage('uncertain');
      }
    } finally { finish(request.token); }
  };

  // A missing/invalid presentation contract never enables the new operator flow.
  if (!ui) {
    const loading = busy === 'descriptor' || (!descriptor && !readError);
    return <ViewState status={loading ? 'loading' : descriptor ? 'partial' : 'error'}
      description={loading ? undefined : tenantAddressesErrorMessage(readError ?? new TenantAddressesContractError())}
      action={loading ? undefined : <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void refresh()}>
        {TENANT_ADDRESSES_REFRESH_LABEL}
      </Button>} />;
  }
  const reason = capability?.reason_code;
  const unavailable = reason && Object.prototype.hasOwnProperty.call(ui.messages, reason)
    ? ui.messages[reason as keyof typeof ui.messages] : ui.messages.not_ready;
  const statusText = busy ? ui.labels[busy === 'descriptor' ? 'loading' : busy === 'plan' ? 'planning' : 'activating'] : null;
  const planData = review?.plan;
  return <section className="space-y-4 rounded-xl border p-4" aria-labelledby={id + '-title'} aria-busy={Boolean(busy)}>
    <h3 id={id + '-title'} className="font-semibold">{ui.labels.title}</h3>
    <p className="text-sm text-muted-foreground">{ui.labels.description}</p>
    <div className="space-y-2">
      <Label htmlFor={id + '-kind'}>{ui.labels.kind}</Label>
      <select id={id + '-kind'} className="min-h-11 w-full rounded-md border bg-background px-3" value={kind}
        disabled={busy === 'activate'} onChange={event => changeKind(event.target.value)}>
        <option value="platform">{ui.labels.platform}</option><option value="custom">{ui.labels.custom}</option>
      </select>
      {slot?.host ? <p className="break-all font-mono text-sm">{slot.host}</p> : null}
      {slot ? <p className="text-sm text-muted-foreground">{slot.scope_note}</p> : null}
      {slot?.active ? <p role="status">{ui.labels.active}</p> : !ready ? <p role="status">{slot?.status === 'pending_platform' ? unavailable : ui.messages.not_pending}</p> : null}
    </div>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-medium">{ui.labels.advanced_title}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">{ui.labels.advanced_description}</p>
        {(['frontend_deployment', 'frontend_source', 'routes_sha256'] as const).map((field, index) => <div key={field} className="space-y-1">
          <Label htmlFor={id + '-' + field}>{[ui.labels.deployment, ui.labels.source, ui.labels.routes][index]}</Label>
          <Input id={id + '-' + field} value={fields[field]} autoComplete="off" spellCheck={false}
            disabled={busy === 'activate'} maxLength={field === 'frontend_deployment' ? 132 : field === 'frontend_source' ? 40 : 64}
            onChange={event => changeField(field, event.target.value)} />
        </div>)}
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={versionReviewed} disabled={busy === 'activate'}
            onChange={event => { retireReview(); reviewedRef.current = event.target.checked; setVersionReviewed(event.target.checked); }} />
          <span>{ui.labels.reviewed_version}</span>
        </label>
      </div>
    </details>
    {!candidate && ready ? <p className="text-sm">{ui.messages.input_invalid}</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void refresh()}>{ui.labels.refresh}</Button>
      <Button type="button" disabled={!canPlan} onClick={() => void plan()}>{ui.labels.plan}</Button>
    </div>
    {statusText ? <p role="status">{statusText}</p> : null}
    {message && message !== 'not_ready' ? <p role={requiresStatusCheck ? 'alert' : 'status'}>{ui.messages[message]}</p> : null}
    {planData ? <div className="space-y-3 rounded-lg border p-3">
      <h4 className="font-medium">{ui.labels.review_title}</h4><p role="status">{ui.labels.plan_ready}</p>
      <dl className="space-y-2 text-sm">
        {[[ui.labels.tenant, tenant.slug], [ui.labels.host, planData.plan.host], [ui.labels.revision, planData.plan.revision],
          [ui.labels.deployment, planData.plan.frontend_deployment], [ui.labels.source, planData.plan.frontend_source],
          [ui.labels.backend_source, planData.plan.backend_source], [ui.labels.routes, planData.plan.routes_sha256],
          [ui.labels.digest, planData.plan_sha256], [ui.labels.observed, new Date(planData.observed_at * 1000).toLocaleString('es-AR')],
          [ui.labels.expires, new Date(planData.valid_until * 1000).toLocaleString('es-AR')]].map(([label, value]) =>
          <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-mono">{value}</dd></div>)}
      </dl>
      <Button type="button" disabled={!canActivate} onClick={() => { if (canActivate) setConfirmOpen(true); }}>{ui.labels.confirm_title}</Button>
    </div> : null}
    <AlertDialog open={confirmOpen && Boolean(canActivate || busy === 'activate')} onOpenChange={open => { if (busy !== 'activate') setConfirmOpen(open); }}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader><AlertDialogTitle>{ui.labels.confirm_title}</AlertDialogTitle>
          <AlertDialogDescription>{ui.labels.confirm_description}</AlertDialogDescription></AlertDialogHeader>
        {planData ? <p className="break-all font-mono text-sm">{tenant.slug} · {planData.plan.host} · {planData.plan_sha256}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy === 'activate'}>{ui.labels.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={!canActivate} onClick={event => { event.preventDefault(); void activate(); }}>{ui.labels.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
