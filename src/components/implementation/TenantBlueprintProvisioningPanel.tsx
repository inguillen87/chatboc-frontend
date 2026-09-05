import React from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import {
  applyTenantBlueprint,
  getTenantBlueprint,
  listTenantBlueprints,
  previewTenantBlueprint,
  type TenantBlueprintApplyContract,
  type TenantBlueprintCatalogContract,
  type TenantBlueprintDetailContract,
  type TenantBlueprintPreviewContract,
} from '@/api/v2/tenantBlueprints';
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

const activationStateLabels: Record<string, string> = {
  configuration_required: 'Requiere configuración',
  evidence_required: 'Requiere evidencia',
  content_required: 'Requiere contenido',
  provider_required: 'Requiere proveedor',
  validation_required: 'Requiere validación',
};

const safeErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const backendMessage = error.body?.error?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim()) return backendMessage.trim();
  }
  return fallback;
};

const isUncertainApplyError = (error: unknown) =>
  error instanceof NetworkError || !(error instanceof ApiError) || error.status >= 500;

const normalizeScopeTenant = (value: string) => value.trim().toLowerCase();
const GOVERNMENT_CORE_BLUEPRINT_ID = 'government-core';

const createIdempotencyKey = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `tenant-blueprint:${uuid}`;

  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  const entropy = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `tenant-blueprint:${Date.now().toString(36)}:${entropy}`;
};

interface TenantBlueprintProvisioningPanelProps {
  tenantSlug: string;
  canApply: boolean;
  compactWhenApplied?: boolean;
  refreshRevision?: number;
  onApplicationStateChange?: (applied: boolean, blueprintId: string) => void;
  onApplied?: () => void;
}

interface TenantBlueprintProvisioningPanelContentProps extends TenantBlueprintProvisioningPanelProps {
  applyAction: typeof applyTenantBlueprint;
}

interface BlueprintWorkflowScope {
  tenantSlug: string;
  blueprintId: string;
  tenantId: string;
  blueprintVersion: string;
  manifestDigest: string;
  reloadRevision: number;
  refreshRevision: number;
}

const TenantBlueprintProvisioningPanelContent: React.FC<TenantBlueprintProvisioningPanelContentProps> = ({
  tenantSlug,
  canApply,
  compactWhenApplied = false,
  refreshRevision = 0,
  onApplicationStateChange,
  onApplied,
  applyAction,
}) => {
  const [catalog, setCatalog] = React.useState<TenantBlueprintCatalogContract | null>(null);
  const [selectedBlueprintId, setSelectedBlueprintId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<TenantBlueprintDetailContract | null>(null);
  const [preview, setPreview] = React.useState<TenantBlueprintPreviewContract | null>(null);
  const [applyResult, setApplyResult] = React.useState<TenantBlueprintApplyContract | null>(null);
  const [loadingCatalog, setLoadingCatalog] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reloadRevision, setReloadRevision] = React.useState(0);
  const applyAttemptRef = React.useRef<{ fingerprint: string; key: string } | null>(null);
  const loadedDetailScopeRef = React.useRef<BlueprintWorkflowScope | null>(null);
  const activeWorkflowRef = React.useRef<BlueprintWorkflowScope | null>(null);

  const loadedScope = loadedDetailScopeRef.current;
  activeWorkflowRef.current = detail
    && loadedScope
    && normalizeScopeTenant(loadedScope.tenantSlug) === normalizeScopeTenant(tenantSlug)
    && loadedScope.blueprintId === selectedBlueprintId
    && loadedScope.reloadRevision === reloadRevision
    && loadedScope.tenantId === String(detail.tenant.id)
    && loadedScope.blueprintVersion === detail.blueprint.version
    && loadedScope.manifestDigest === detail.blueprint.manifest_digest
    && loadedScope.refreshRevision === refreshRevision
      ? loadedScope
      : null;

  const workflowIsCurrent = (scope: BlueprintWorkflowScope) => {
    const active = activeWorkflowRef.current;
    return Boolean(
      active
      && active.tenantSlug === scope.tenantSlug
      && active.blueprintId === scope.blueprintId
      && active.tenantId === scope.tenantId
      && active.blueprintVersion === scope.blueprintVersion
      && active.manifestDigest === scope.manifestDigest
      && active.reloadRevision === scope.reloadRevision
      && active.refreshRevision === scope.refreshRevision,
    );
  };

  React.useEffect(() => {
    let cancelled = false;
    setLoadingCatalog(true);
    setLoadError(null);
    setCatalog(null);
    setSelectedBlueprintId(null);
    setDetail(null);
    setPreview(null);
    setApplyResult(null);
    setPreviewing(false);
    setApplying(false);
    setConfirmOpen(false);
    setActionError(null);
    setRefreshWarning(null);
    applyAttemptRef.current = null;
    loadedDetailScopeRef.current = null;

    void listTenantBlueprints()
      .then((response) => {
        if (cancelled) return;
        setCatalog(response);
        const governmentCore = response.blueprints.find(
          (blueprint) => blueprint.id === GOVERNMENT_CORE_BLUEPRINT_ID,
        );
        setSelectedBlueprintId(governmentCore?.id || response.blueprints[0]?.id || null);
        if (!governmentCore) onApplicationStateChange?.(false, GOVERNMENT_CORE_BLUEPRINT_ID);
      })
      .catch((error) => {
        if (cancelled) return;
        onApplicationStateChange?.(false, GOVERNMENT_CORE_BLUEPRINT_ID);
        setLoadError(safeErrorMessage(
          error,
          'No pudimos cargar las configuraciones base. Reintentá cuando el servicio esté disponible.',
        ));
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onApplicationStateChange, refreshRevision, reloadRevision, tenantSlug]);

  React.useEffect(() => {
    if (!selectedBlueprintId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setLoadError(null);
    setDetail(null);
    setPreview(null);
    setApplyResult(null);
    setActionError(null);
    setRefreshWarning(null);
    setPreviewing(false);
    setApplying(false);
    setConfirmOpen(false);
    applyAttemptRef.current = null;
    loadedDetailScopeRef.current = null;

    void getTenantBlueprint(tenantSlug, selectedBlueprintId)
      .then((response) => {
        if (cancelled) return;
        loadedDetailScopeRef.current = {
          tenantSlug: normalizeScopeTenant(tenantSlug),
          blueprintId: response.blueprint.id,
          tenantId: String(response.tenant.id),
          blueprintVersion: response.blueprint.version,
          manifestDigest: response.blueprint.manifest_digest,
          reloadRevision,
          refreshRevision,
        };
        setDetail(response);
        onApplicationStateChange?.(Boolean(response.application_receipt), response.blueprint.id);
      })
      .catch((error) => {
        if (cancelled) return;
        onApplicationStateChange?.(false, selectedBlueprintId);
        setLoadError(safeErrorMessage(
          error,
          'No pudimos validar esta configuración para la organización seleccionada.',
        ));
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onApplicationStateChange, refreshRevision, reloadRevision, selectedBlueprintId, tenantSlug]);

  const runPreview = async () => {
    const scope = activeWorkflowRef.current;
    if (!detail || !scope || !workflowIsCurrent(scope)) return;
    setPreviewing(true);
    setActionError(null);
    setRefreshWarning(null);
    try {
      const response = await previewTenantBlueprint(scope.tenantSlug, scope.blueprintId, {
        tenantId: scope.tenantId,
        blueprintVersion: scope.blueprintVersion,
        manifestDigest: scope.manifestDigest,
      });
      if (!workflowIsCurrent(scope)) return;
      setPreview(response);
      applyAttemptRef.current = null;
    } catch (error) {
      if (!workflowIsCurrent(scope)) return;
      setPreview(null);
      setActionError(safeErrorMessage(
        error,
        'No pudimos previsualizar los cambios. No se escribió ninguna configuración.',
      ));
    } finally {
      if (workflowIsCurrent(scope)) setPreviewing(false);
    }
  };

  const refreshAfterApply = async (scope: BlueprintWorkflowScope) => {
    try {
      const refreshedDetail = await getTenantBlueprint(scope.tenantSlug, scope.blueprintId);
      if (!workflowIsCurrent(scope)) return;
      if (
        String(refreshedDetail.tenant.id) !== scope.tenantId
        || refreshedDetail.blueprint.version !== scope.blueprintVersion
        || refreshedDetail.blueprint.manifest_digest !== scope.manifestDigest
      ) {
        throw new Error('tenant_blueprint_version_mismatch');
      }
      setDetail(refreshedDetail);

      const refreshedPreview = await previewTenantBlueprint(scope.tenantSlug, scope.blueprintId, {
        tenantId: scope.tenantId,
        blueprintVersion: scope.blueprintVersion,
        manifestDigest: scope.manifestDigest,
      });
      if (!workflowIsCurrent(scope)) return;
      setPreview(refreshedPreview);
    } catch {
      if (!workflowIsCurrent(scope)) return;
      setRefreshWarning(
        'La aplicación fue confirmada, pero parte del estado visible no pudo actualizarse. Podés recargar sin repetir cambios.',
      );
    }
  };

  const confirmApply = async () => {
    const scope = activeWorkflowRef.current;
    if (
      !canApply
      || !detail
      || !preview
      || detail.application_receipt
      || applyResult?.receipt
      || !scope
      || !workflowIsCurrent(scope)
    ) return;
    if (
      String(preview.tenant.id) !== scope.tenantId
      || preview.blueprint.id !== scope.blueprintId
      || preview.blueprint.version !== scope.blueprintVersion
      || preview.blueprint.manifest_digest !== scope.manifestDigest
    ) {
      setPreview(null);
      setConfirmOpen(false);
      setActionError('La base cambió desde la previsualización. Actualizá y volvé a revisar los cambios.');
      return;
    }
    const fingerprint = [
      scope.tenantSlug,
      scope.tenantId,
      scope.blueprintId,
      scope.blueprintVersion,
      scope.manifestDigest,
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
        blueprintId: scope.blueprintId,
        manifestDigest: scope.manifestDigest,
        idempotencyKey: attempt.key,
        expectedTenantId: scope.tenantId,
        expectedBlueprintVersion: scope.blueprintVersion,
      });
      if (!workflowIsCurrent(scope)) return;
      setApplyResult(response);
      setDetail((current) => current ? { ...current, application_receipt: response.receipt } : current);
      onApplicationStateChange?.(true, scope.blueprintId);
      applyAttemptRef.current = null;
      setConfirmOpen(false);
      await refreshAfterApply(scope);
      onApplied?.();
    } catch (error) {
      if (!workflowIsCurrent(scope)) return;
      const stepUpMessage = resolveClerkStepUpErrorMessage(error);
      const uncertainResult = !stepUpMessage && isUncertainApplyError(error);
      if (stepUpMessage || !uncertainResult) applyAttemptRef.current = null;
      setConfirmOpen(false);
      setActionError(stepUpMessage || safeErrorMessage(
        error,
        uncertainResult
          ? 'No pudimos confirmar el resultado. Reintentá: se conservará la misma identidad para evitar duplicados.'
          : 'La plataforma rechazó la aplicación. Actualizá la previsualización antes de volver a intentar.',
      ));
    } finally {
      if (workflowIsCurrent(scope)) setApplying(false);
    }
  };

  const workflowReady = Boolean(activeWorkflowRef.current);
  const applied = workflowReady && Boolean(detail?.application_receipt || applyResult?.receipt);

  if (compactWhenApplied && detail && applied) {
    return (
      <section
        aria-labelledby="tenant-blueprint-title"
        className="rounded-2xl border border-emerald-500/25 bg-card shadow-sm"
        data-testid="tenant-blueprint-panel"
        data-state="applied-compact"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="tenant-blueprint-title" className="text-base font-semibold text-foreground">
                  {applyResult?.replayed
                    ? 'Solicitud confirmada sin duplicar cambios'
                    : 'Configuración base aplicada'}
                </h2>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                  Base validada
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.blueprint.label} · Versión {detail.blueprint.version}. Los módulos y proveedores continúan sujetos a su activación y validación.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setReloadRevision((value) => value + 1)}
            disabled={loadingCatalog || loadingDetail}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(loadingCatalog || loadingDetail) ? 'animate-spin' : ''}`} />
            Actualizar base
          </Button>
        </div>

        {refreshWarning ? (
          <p role="alert" className="mx-4 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100 sm:mx-5">
            {refreshWarning}
          </p>
        ) : null}

        <details className="group border-t border-border/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
            Ver detalle de la base
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 border-t border-border/60 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
            {detail.blueprint.modules.map((module) => (
              <article key={module.id} className="rounded-lg border border-border/70 bg-background/80 p-3">
                <h3 className="text-sm font-semibold text-foreground">{module.label}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.summary}</p>
              </article>
            ))}
          </div>
        </details>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="tenant-blueprint-title"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      data-testid="tenant-blueprint-panel"
    >
      <div className="border-b border-border/70 bg-gradient-to-r from-blue-500/[0.08] via-background to-background p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200">
                Configuración reutilizable
              </Badge>
              {detail && workflowReady ? (
                <Badge
                  variant="outline"
                  className={applied
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                    : 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200'}
                >
                  {applied ? 'Base aplicada' : 'Base no aplicada'}
                </Badge>
              ) : null}
            </div>
            <h2 id="tenant-blueprint-title" className="mt-3 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Diseño inicial de la solución
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Revisá una base institucional antes de preparar cada frente operativo. Aplicarla sólo incorpora valores
              faltantes: no habilita módulos, proveedores, WhatsApp ni ejecución en producción.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setReloadRevision((value) => value + 1)}
            disabled={loadingCatalog || loadingDetail}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(loadingCatalog || loadingDetail) ? 'animate-spin' : ''}`} />
            Actualizar base
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {loadingCatalog ? (
          <div aria-live="polite" className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Consultando configuraciones disponibles…
          </div>
        ) : null}

        {loadError ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-100">
            <p className="font-semibold">No se pudo validar la base institucional</p>
            <p className="mt-1 leading-6">{loadError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setReloadRevision((value) => value + 1)}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {!loadingCatalog && !loadError && catalog?.blueprints.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-sm text-muted-foreground">
            La plataforma todavía no publicó una configuración base para esta organización.
          </div>
        ) : null}

        {catalog && catalog.blueprints.length > 1 ? (
          <label className="block max-w-lg text-sm font-medium text-foreground">
            Configuración base
            <select
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedBlueprintId || ''}
              onChange={(event) => setSelectedBlueprintId(event.target.value)}
            >
              {catalog.blueprints.map((blueprint) => (
                <option key={blueprint.id} value={blueprint.id}>{blueprint.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        {loadingDetail ? (
          <div aria-live="polite" className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Validando alcance y estado aplicado…
          </div>
        ) : null}

        {detail && workflowReady ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{detail.blueprint.label}</h3>
                  <Badge variant="secondary">Versión {detail.blueprint.version}</Badge>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{detail.blueprint.description}</p>
              </div>
              <Button type="button" onClick={() => void runPreview()} disabled={previewing || applying}>
                {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                {preview ? 'Actualizar previsualización' : 'Previsualizar cambios'}
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <h3 className="text-sm font-semibold text-foreground">Frentes incluidos</h3>
                <Badge variant="secondary">{detail.blueprint.modules.length}</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {detail.blueprint.modules.map((module) => (
                  <article key={module.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{module.label}</h4>
                      <Badge variant="outline" className="shrink-0 text-[10px] text-slate-700 dark:text-slate-200">
                        Pendiente
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">{module.summary}</p>
                    <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                      {activationStateLabels[module.activation_state] || 'Requiere preparación'}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {actionError ? (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-100">
                {actionError}
              </div>
            ) : null}

            {preview ? (
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.05] p-4 sm:p-5" aria-live="polite">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                      <h3 className="font-semibold text-foreground">Previsualización verificada</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Se agregarían {preview.changes.apply_count} valores faltantes y se conservarían {preview.changes.preserve_count} valores existentes.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Sin escrituras</Badge>
                    <Badge variant="outline">Sin llamadas externas</Badge>
                    <Badge variant="outline">Sin activación runtime</Badge>
                  </div>
                </div>

                <details className="group mt-4 rounded-lg border border-border/70 bg-background/70">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Ver detalle de cambios
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-4 border-t border-border/70 p-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Valores a incorporar</h4>
                      {preview.changes.apply_paths.length ? (
                        <ul className="mt-2 space-y-1.5 text-xs text-foreground">
                          {preview.changes.apply_paths.map((path) => <li key={path} className="break-all font-mono">{path}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-muted-foreground">No hay valores nuevos.</p>}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Valores preservados</h4>
                      {preview.changes.preserve_paths.length ? (
                        <ul className="mt-2 space-y-1.5 text-xs text-foreground">
                          {preview.changes.preserve_paths.map((path) => <li key={path} className="break-all font-mono">{path}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-muted-foreground">No hay valores existentes para preservar.</p>}
                    </div>
                  </div>
                </details>

                <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                    Cada frente seguirá pendiente hasta completar su configuración, evidencia y validación correspondiente.
                  </div>
                  {canApply && !applied ? (
                    <Button type="button" onClick={() => setConfirmOpen(true)} disabled={applying}>
                      Aplicar configuración base
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!canApply && !applied ? (
              <p className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Tu rol puede revisar y previsualizar. La aplicación queda reservada a un administrador autorizado de la plataforma.
              </p>
            ) : null}

            {applyResult ? (
              <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  {applyResult.replayed
                    ? 'Solicitud confirmada sin duplicar cambios'
                    : 'Configuración base aplicada'}
                </div>
                <p className="mt-1 leading-6">Los módulos y proveedores continúan pendientes de activación y validación.</p>
              </div>
            ) : null}

            {refreshWarning ? (
              <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-100">
                {refreshWarning}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!applying) setConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar configuración base</AlertDialogTitle>
            <AlertDialogDescription>
              Se incorporarán únicamente los valores faltantes informados en la previsualización. La configuración
              existente se preservará y ningún módulo, proveedor o canal quedará activo por esta acción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmApply(); }} disabled={applying}>
              {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar aplicación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

const ClerkTenantBlueprintProvisioningPanel: React.FC<TenantBlueprintProvisioningPanelProps> = (props) => {
  const applyWithStepUp = useClerkStepUpAction(applyTenantBlueprint);
  return <TenantBlueprintProvisioningPanelContent {...props} applyAction={applyWithStepUp} />;
};

const TenantBlueprintProvisioningPanel: React.FC<TenantBlueprintProvisioningPanelProps> = (props) => {
  const clerkRuntime = useClerkRuntime();
  if (clerkRuntime.enabled) {
    return <ClerkTenantBlueprintProvisioningPanel {...props} />;
  }
  return <TenantBlueprintProvisioningPanelContent {...props} applyAction={applyTenantBlueprint} />;
};

export default TenantBlueprintProvisioningPanel;
