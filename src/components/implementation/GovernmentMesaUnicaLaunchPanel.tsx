import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  applyGovernmentMesaUnicaLaunch,
  previewGovernmentMesaUnicaLaunch,
  type GovernmentLaunchApplyContract,
  type GovernmentLaunchPreviewContract,
} from '@/api/v2/governmentLaunch';
import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  resolveClerkStepUpErrorMessage,
  useClerkStepUpAction,
} from '@/hooks/useClerkStepUpAction';
import { ApiError, NetworkError } from '@/utils/api';

const safeErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const message = error.body?.error?.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
};

const isUncertainApplyError = (error: unknown) =>
  error instanceof NetworkError || !(error instanceof ApiError) || error.status >= 500;

const isConflictError = (error: unknown) => error instanceof ApiError && error.status === 409;

const createIdempotencyKey = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `government-launch:${uuid}`;

  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  const entropy = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `government-launch:${Date.now().toString(36)}:${entropy}`;
};

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

interface GovernmentMesaUnicaLaunchPanelProps {
  tenantSlug: string;
  canApply: boolean;
  onApplied?: () => void;
}

interface GovernmentMesaUnicaLaunchPanelContentProps extends GovernmentMesaUnicaLaunchPanelProps {
  applyAction: typeof applyGovernmentMesaUnicaLaunch;
}

interface ApplyAttempt {
  fingerprint: string;
  key: string;
}

interface TenantRequestScope {
  tenantSlug: string;
  generation: number;
}

const GovernmentMesaUnicaLaunchPanelContent: React.FC<GovernmentMesaUnicaLaunchPanelContentProps> = ({
  tenantSlug,
  canApply,
  onApplied,
  applyAction,
}) => {
  const normalizedTenant = normalizeTenantSlug(tenantSlug);
  const activeScopeRef = React.useRef<TenantRequestScope>({
    tenantSlug: normalizedTenant,
    generation: 0,
  });
  if (activeScopeRef.current.tenantSlug !== normalizedTenant) {
    activeScopeRef.current = {
      tenantSlug: normalizedTenant,
      generation: activeScopeRef.current.generation + 1,
    };
  }

  const [preview, setPreview] = React.useState<GovernmentLaunchPreviewContract | null>(null);
  const [applyResult, setApplyResult] = React.useState<GovernmentLaunchApplyContract | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = React.useState<string | null>(null);
  const applyAttemptRef = React.useRef<ApplyAttempt | null>(null);

  React.useEffect(() => {
    setPreview(null);
    setApplyResult(null);
    setPreviewing(false);
    setApplying(false);
    setConfirmOpen(false);
    setActionError(null);
    setRefreshWarning(null);
    applyAttemptRef.current = null;
  }, [normalizedTenant]);

  React.useEffect(() => {
    if (!canApply) setConfirmOpen(false);
  }, [canApply]);

  const scopeIsCurrent = (scope: TenantRequestScope) =>
    activeScopeRef.current.tenantSlug === scope.tenantSlug
    && activeScopeRef.current.generation === scope.generation;

  const runPreview = async () => {
    const scope = activeScopeRef.current;
    if (!scope.tenantSlug || previewing || applying) return;
    setPreviewing(true);
    setActionError(null);
    setRefreshWarning(null);
    try {
      const response = await previewGovernmentMesaUnicaLaunch(scope.tenantSlug);
      if (!scopeIsCurrent(scope)) return;
      setPreview(response);
      applyAttemptRef.current = null;
    } catch (error) {
      if (!scopeIsCurrent(scope)) return;
      setPreview(null);
      setActionError(safeErrorMessage(
        error,
        'No pudimos previsualizar la preparación. No se realizó ninguna escritura.',
      ));
    } finally {
      if (scopeIsCurrent(scope)) setPreviewing(false);
    }
  };

  const refreshAfterApply = async (scope: TenantRequestScope) => {
    try {
      const response = await previewGovernmentMesaUnicaLaunch(scope.tenantSlug);
      if (!scopeIsCurrent(scope)) return;
      setPreview(response);
    } catch {
      if (!scopeIsCurrent(scope)) return;
      setRefreshWarning(
        'La preparación fue confirmada, pero no pudimos actualizar el detalle. Los demás paneles se están sincronizando.',
      );
    }
  };

  const confirmApply = async () => {
    const scope = activeScopeRef.current;
    const snapshot = preview;
    if (
      !canApply
      || !scope.tenantSlug
      || !snapshot
      || snapshot.changes.conflicts.length > 0
      || applyResult
      || !scopeIsCurrent(scope)
    ) return;
    if (normalizeTenantSlug(snapshot.tenant.slug) !== scope.tenantSlug) {
      setPreview(null);
      setConfirmOpen(false);
      applyAttemptRef.current = null;
      setActionError('El espacio de trabajo cambió. Volvé a previsualizar antes de aplicar.');
      return;
    }

    const fingerprint = [
      scope.tenantSlug,
      snapshot.tenant.id,
      snapshot.blueprint.id,
      snapshot.blueprint.version,
      snapshot.blueprint.manifest_digest,
      snapshot.blueprint.application_receipt_id,
      snapshot.launch.id,
      snapshot.launch_digest,
    ].join(':');
    if (!applyAttemptRef.current || applyAttemptRef.current.fingerprint !== fingerprint) {
      applyAttemptRef.current = { fingerprint, key: createIdempotencyKey() };
    }

    const attempt = applyAttemptRef.current;
    setApplying(true);
    setActionError(null);
    setRefreshWarning(null);
    try {
      const response = await applyAction({
        tenantSlug: scope.tenantSlug,
        launchDigest: snapshot.launch_digest,
        idempotencyKey: attempt.key,
        expected: {
          tenantId: snapshot.tenant.id,
          blueprintVersion: snapshot.blueprint.version,
          manifestDigest: snapshot.blueprint.manifest_digest,
          blueprintApplicationReceiptId: snapshot.blueprint.application_receipt_id,
        },
      });
      if (!scopeIsCurrent(scope)) return;
      setApplyResult(response);
      applyAttemptRef.current = null;
      setConfirmOpen(false);
      onApplied?.();
      await refreshAfterApply(scope);
    } catch (error) {
      if (!scopeIsCurrent(scope)) return;
      const stepUpMessage = resolveClerkStepUpErrorMessage(error);
      const uncertainResult = !stepUpMessage && isUncertainApplyError(error);
      if (stepUpMessage || !uncertainResult) applyAttemptRef.current = null;
      if (isConflictError(error)) setPreview(null);
      setConfirmOpen(false);
      setActionError(stepUpMessage || safeErrorMessage(
        error,
        uncertainResult
          ? 'No pudimos confirmar el resultado. Reintentá para consultar la misma operación sin duplicar cambios.'
          : 'La plataforma rechazó la preparación. Volvé a previsualizar antes de intentarlo nuevamente.',
      ));
    } finally {
      if (scopeIsCurrent(scope)) setApplying(false);
    }
  };

  const hasConflicts = Boolean(preview?.changes.conflicts.length);
  const successSummary = applyResult?.changes.summary;

  return (
    <section
      aria-labelledby="government-mesa-unica-title"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      data-testid="government-mesa-unica-launch"
      data-state={applyResult ? 'applied' : preview ? (hasConflicts ? 'conflict' : 'previewed') : 'idle'}
    >
      <div className="border-b border-border/70 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 p-5 text-white sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/15 text-blue-100">
            <Layers3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-blue-300/30 bg-blue-400/15 text-blue-50" variant="outline">
                Paso 2 · Preparación operativa
              </Badge>
              <Badge className="border-white/15 bg-white/10 text-slate-100" variant="outline">
                Mesa Única
              </Badge>
            </div>
            <h2 id="government-mesa-unica-title" className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
              Preparar categorías de atención
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Revisá exactamente qué categorías faltan, cuáles se preservan y qué conflictos requieren intervención antes de preparar la operación.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Alcance permitido</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Sólo categorías de tickets</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Previsualización</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Sin escrituras</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Aplicación</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Superadmin + verificación reciente</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Límites de la preparación">
          <Badge variant="outline">No crea personas</Badge>
          <Badge variant="outline">No crea casos ni datos demo</Badge>
          <Badge variant="outline">No activa canales ni proveedores</Badge>
          <Badge variant="outline">No realiza llamadas externas</Badge>
        </div>

        {actionError ? (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-100">
            <p className="font-semibold">No pudimos completar la acción</p>
            <p className="mt-1 leading-6">{actionError}</p>
          </div>
        ) : null}

        {!preview ? (
          <div className="flex flex-col gap-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Primero revisá el impacto</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  La consulta es explícita y de sólo lectura. Nada se aplica al abrir este panel.
                </p>
              </div>
            </div>
            <Button type="button" className="shrink-0" onClick={() => void runPreview()} disabled={previewing || applying}>
              {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Eye className="mr-2 h-4 w-4" aria-hidden="true" />}
              Previsualizar preparación
            </Button>
          </div>
        ) : (
          <div className="space-y-4" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Crear</p>
                <p className="mt-2 text-3xl font-black text-foreground">{preview.changes.summary.create}</p>
                <p className="mt-1 text-sm text-muted-foreground">Categorías faltantes</p>
              </article>
              <article className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Preservar</p>
                <p className="mt-2 text-3xl font-black text-foreground">{preview.changes.summary.preserve}</p>
                <p className="mt-1 text-sm text-muted-foreground">Categorías existentes</p>
              </article>
              <article className={`rounded-xl border p-4 ${hasConflicts ? 'border-red-500/30 bg-red-500/[0.08]' : 'border-border/70 bg-background/70'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${hasConflicts ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>Conflictos</p>
                <p className="mt-2 text-3xl font-black text-foreground">{preview.changes.summary.conflict}</p>
                <p className="mt-1 text-sm text-muted-foreground">Requieren revisión</p>
              </article>
            </div>

            {hasConflicts ? (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-100">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">La preparación está bloqueada</p>
                  <p className="mt-1 leading-6">Resolvé las categorías ambiguas o incompatibles antes de aplicar.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-sm text-emerald-800 dark:text-emerald-100">
                <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Previsualización verificada · sin escrituras</p>
                  <p className="mt-1 leading-6">El alcance está acotado a {preview.changes.summary.desired} categorías operativas.</p>
                </div>
              </div>
            )}

            <details className="group rounded-xl border border-border/70 bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Ver categorías, conflictos y trazabilidad
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-4 border-t border-border/70 p-4 lg:grid-cols-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">A crear</h4>
                  {preview.changes.to_create.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-foreground">
                      {preview.changes.to_create.map((item) => <li key={item.canonical_name}>{item.name}</li>)}
                    </ul>
                  ) : <p className="mt-2 text-sm text-muted-foreground">No hay categorías nuevas.</p>}
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">A preservar</h4>
                  {preview.changes.already_present.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-foreground">
                      {preview.changes.already_present.map((item) => <li key={item.canonical_name}>{item.category.name}</li>)}
                    </ul>
                  ) : <p className="mt-2 text-sm text-muted-foreground">No hay coincidencias existentes.</p>}
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Conflictos</h4>
                  {preview.changes.conflicts.length ? (
                    <ul className="mt-2 space-y-3 text-sm text-foreground">
                      {preview.changes.conflicts.map((item) => (
                        <li key={item.canonical_name}>
                          <span className="font-semibold">{item.desired_name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.reason_code === 'ambiguous_existing_categories'
                              ? 'Hay más de una categoría equivalente.'
                              : 'La categoría existente tiene un tipo incompatible.'}
                          </span>
                          <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                            {item.matches.map((match) => (
                              <li key={`${String(match.id)}:${match.name}`} className="break-words">
                                Existente: {match.name} · tipo {match.type} · ID {String(match.id)}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-sm text-muted-foreground">Sin conflictos detectados.</p>}
                </div>
                <div className="lg:col-span-3 border-t border-border/60 pt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Huella de previsualización</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{preview.launch_digest}</p>
                </div>
              </div>
            </details>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {canApply
                  ? 'La aplicación requiere confirmación explícita y puede solicitar una verificación adicional de identidad.'
                  : 'Tu rol puede revisar el impacto. Sólo un superadmin puede aplicar esta preparación.'}
              </p>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={previewing || applying}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${previewing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Actualizar revisión
                </Button>
                {canApply && !hasConflicts && !applyResult ? (
                  <Button type="button" onClick={() => setConfirmOpen(true)} disabled={applying || previewing}>
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    Aplicar preparación
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {applyResult ? (
          <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {applyResult.replayed
                ? 'Preparación confirmada sin duplicar cambios'
                : 'Categorías operativas preparadas'}
            </div>
            <p className="mt-1 leading-6">
              {successSummary?.created || 0} creadas · {successSummary?.preserved || 0} preservadas. Personas, casos, canales, proveedores y datos demo permanecen sin cambios.
            </p>
          </div>
        ) : null}

        {refreshWarning ? (
          <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-100">
            {refreshWarning}
          </p>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!applying) setConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar preparación de Mesa Única</AlertDialogTitle>
            <AlertDialogDescription>
              Se crearán {preview?.changes.summary.create || 0} categorías y se preservarán {preview?.changes.summary.preserve || 0}. Esta acción no crea personas, casos o datos demo; tampoco activa canales, proveedores ni llamadas externas. Se requiere identidad de superadmin con verificación reciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void confirmApply(); }}
              disabled={applying || !preview || hasConflicts || !canApply}
            >
              {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Confirmar y preparar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

const ClerkGovernmentMesaUnicaLaunchPanel: React.FC<GovernmentMesaUnicaLaunchPanelProps> = (props) => {
  const applyWithStepUp = useClerkStepUpAction(applyGovernmentMesaUnicaLaunch);
  return <GovernmentMesaUnicaLaunchPanelContent {...props} applyAction={applyWithStepUp} />;
};

const GovernmentMesaUnicaLaunchPanel: React.FC<GovernmentMesaUnicaLaunchPanelProps> = (props) => {
  const clerkRuntime = useClerkRuntime();
  if (clerkRuntime.enabled) {
    return <ClerkGovernmentMesaUnicaLaunchPanel {...props} />;
  }
  return <GovernmentMesaUnicaLaunchPanelContent {...props} applyAction={applyGovernmentMesaUnicaLaunch} />;
};

export default GovernmentMesaUnicaLaunchPanel;
