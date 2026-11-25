import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Lock,
  Palette,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  organizationBrandingService,
  type OrganizationBrandingService,
} from '@/services/organizationBrandingService';
import {
  calculateBrandingColorPair,
  formatContrastLabel,
  isValidBrandingHex,
  normalizeBrandingHex,
  readReadOnlyMessage,
  resolveBrandingError,
  sameBrandingValues,
  type OrganizationBrandingPreset,
  type OrganizationBrandingSnapshot,
  type OrganizationBrandingValues,
} from '@/utils/organizationBranding';

type FeedbackTone = 'success' | 'warning' | 'error' | 'info';

interface FeedbackState {
  tone: FeedbackTone;
  title?: string;
  message: string;
}

export interface OrganizationPaletteCardProps {
  tenantSlug: string;
  initialBranding?: OrganizationBrandingSnapshot | null;
  service?: OrganizationBrandingService;
  onBrandingUpdated?: (next: OrganizationBrandingSnapshot) => void;
}

const DEFAULT_FALLBACK_HEX = '#0055AA';

export default function OrganizationPaletteCard({
  tenantSlug,
  initialBranding = null,
  service = organizationBrandingService,
  onBrandingUpdated,
}: OrganizationPaletteCardProps) {
  const [snapshot, setSnapshot] = useState<OrganizationBrandingSnapshot | null>(
    initialBranding,
  );
  const [loadingInitial, setLoadingInitial] = useState<boolean>(!initialBranding);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrganizationBrandingValues>(() =>
    initialBranding
      ? { ...initialBranding.values }
      : { enabled: false, primary_color: '#346600', accent_color: '#98C400' },
  );
  const [primaryInput, setPrimaryInput] = useState<string>(
    initialBranding?.values.primary_color ?? '#346600',
  );
  const [accentInput, setAccentInput] = useState<string>(
    initialBranding?.values.accent_color ?? '#98C400',
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const mountedRef = useRef(true);
  const initialKey = initialBranding
    ? `${initialBranding.tenant.slug}:${initialBranding.revision}`
    : null;
  const syncedKeyRef = useRef<string | null>(initialKey);
  const lastPropKeyRef = useRef<string | null>(initialKey);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync only when the parent actually supplies a new `initialBranding` prop,
  // without clobbering a preserved draft after our own 412 reload.
  useEffect(() => {
    if (!initialBranding) return;
    const incomingKey = `${initialBranding.tenant.slug}:${initialBranding.revision}`;
    if (lastPropKeyRef.current === incomingKey) return;
    lastPropKeyRef.current = incomingKey;
    if (syncedKeyRef.current === incomingKey) return;
    const previousSlug = syncedKeyRef.current?.split(':')[0] ?? null;
    const tenantChanged = previousSlug !== initialBranding.tenant.slug;
    syncedKeyRef.current = incomingKey;
    setSnapshot(initialBranding);
    setLoadingInitial(false);
    setLoadError(null);
    if (tenantChanged) {
      setDraft({ ...initialBranding.values });
      setPrimaryInput(initialBranding.values.primary_color);
      setAccentInput(initialBranding.values.accent_color);
      setFeedback(null);
    }
  }, [initialBranding]);

  // Self-load only when rendered without initialBranding from Perfil.tsx.
  useEffect(() => {
    if (initialBranding || !tenantSlug) return;
    let cancelled = false;
    setLoadingInitial(true);
    setLoadError(null);
    service
      .getBranding(tenantSlug)
      .then((loaded) => {
        if (cancelled || !mountedRef.current) return;
        syncedKeyRef.current = `${loaded.tenant.slug}:${loaded.revision}`;
        setSnapshot(loaded);
        setDraft({ ...loaded.values });
        setPrimaryInput(loaded.values.primary_color);
        setAccentInput(loaded.values.accent_color);
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        setLoadError(resolveBrandingError(err).message);
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialBranding, service, tenantSlug]);

  const headingId = useId();
  const enabledSwitchId = useId();
  const primaryPickerId = useId();
  const primaryHexId = useId();
  const primaryErrorId = useId();
  const accentPickerId = useId();
  const accentHexId = useId();
  const accentErrorId = useId();
  const presetsLabelId = useId();
  const historyHeadingId = useId();

  const primaryValid = isValidBrandingHex(primaryInput);
  const accentValid = isValidBrandingHex(accentInput);
  const primaryNormalized = normalizeBrandingHex(primaryInput);
  const accentNormalized = normalizeBrandingHex(accentInput);

  const primaryPair = useMemo(
    () => (primaryNormalized ? calculateBrandingColorPair(primaryNormalized) : null),
    [primaryNormalized],
  );
  const accentPair = useMemo(
    () => (accentNormalized ? calculateBrandingColorPair(accentNormalized) : null),
    [accentNormalized],
  );

  const sortedHistory = useMemo(
    () =>
      snapshot
        ? [...snapshot.history].sort((a, b) => b.version - a.version)
        : [],
    [snapshot],
  );

  if (loadingInitial) {
    return (
      <section
        aria-busy="true"
        aria-label="Paleta del espacio"
        className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
        data-testid="organization-palette-card"
      >
        <p className="text-sm text-muted-foreground">
          Cargando la paleta del espacio…
        </p>
      </section>
    );
  }

  if (loadError || !snapshot) {
    return (
      <section
        aria-label="Paleta del espacio"
        className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
        data-testid="organization-palette-card"
      >
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>No pudimos cargar la paleta del espacio</AlertTitle>
          <AlertDescription>
            {loadError || 'Volvé a intentar en unos segundos.'}
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const canEdit = snapshot.can_edit === true;
  const isReadOnly = !canEdit;
  const readOnlyMessage = isReadOnly ? readReadOnlyMessage(snapshot) : '';

  const effectiveDraft: OrganizationBrandingValues = {
    enabled: draft.enabled,
    primary_color: primaryNormalized ?? draft.primary_color,
    accent_color: accentNormalized ?? draft.accent_color,
  };

  const hasRawHexDiff =
    primaryInput.trim().toUpperCase() !==
      snapshot.values.primary_color.toUpperCase() ||
    accentInput.trim().toUpperCase() !==
      snapshot.values.accent_color.toUpperCase();
  const isDirty =
    hasRawHexDiff || !sameBrandingValues(snapshot.values, effectiveDraft);
  const canPublish =
    canEdit && !submitting && isDirty && primaryValid && accentValid;
  const canDiscard = canEdit && !submitting && isDirty;

  const pickerPrimaryValue =
    primaryNormalized ??
    normalizeBrandingHex(draft.primary_color) ??
    DEFAULT_FALLBACK_HEX;
  const pickerAccentValue =
    accentNormalized ??
    normalizeBrandingHex(draft.accent_color) ??
    DEFAULT_FALLBACK_HEX;

  const handleToggleEnabled = (checked: boolean) => {
    if (isReadOnly || submitting) return;
    setDraft((prev) => ({ ...prev, enabled: checked }));
    setFeedback(null);
  };

  const handlePrimaryHexChange = (value: string) => {
    if (isReadOnly || submitting) return;
    setPrimaryInput(value);
    const normalized = normalizeBrandingHex(value);
    if (normalized) {
      setDraft((prev) => ({ ...prev, primary_color: normalized }));
    }
    setFeedback(null);
  };

  const handleAccentHexChange = (value: string) => {
    if (isReadOnly || submitting) return;
    setAccentInput(value);
    const normalized = normalizeBrandingHex(value);
    if (normalized) {
      setDraft((prev) => ({ ...prev, accent_color: normalized }));
    }
    setFeedback(null);
  };

  const handleApplyPreset = (preset: OrganizationBrandingPreset) => {
    if (isReadOnly || submitting) return;
    const primary = preset.primary_color.toUpperCase();
    const accent = preset.accent_color.toUpperCase();
    setPrimaryInput(primary);
    setAccentInput(accent);
    setDraft((prev) => ({
      ...prev,
      primary_color: primary,
      accent_color: accent,
    }));
    setFeedback(null);
  };

  const handleDiscard = () => {
    if (!canDiscard) return;
    setDraft({ ...snapshot.values });
    setPrimaryInput(snapshot.values.primary_color);
    setAccentInput(snapshot.values.accent_color);
    setFeedback({
      tone: 'info',
      message: 'Cambios descartados. Se restauraron los valores publicados.',
    });
  };

  const reloadPreservingDraft = async (conflictMessage: string) => {
    try {
      const latest = await service.getBranding(
        snapshot.tenant.slug,
        snapshot.tenant.id,
      );
      if (!mountedRef.current) return;
      syncedKeyRef.current = `${latest.tenant.slug}:${latest.revision}`;
      setSnapshot(latest);
      onBrandingUpdated?.(latest);
      setFeedback({
        tone: 'warning',
        title: 'Otra persona cambió la marca',
        message: conflictMessage,
      });
    } catch {
      if (!mountedRef.current) return;
      setFeedback({
        tone: 'warning',
        title: 'Otra persona cambió la marca',
        message:
          'Otra persona cambió la marca. Conservamos tu borrador, pero no pudimos recargar la versión vigente; volvé a actualizar antes de publicar.',
      });
    }
  };

  const handlePublish = async () => {
    if (!canPublish || !primaryNormalized || !accentNormalized) return;
    setSubmitting(true);
    setFeedback(null);
    const payloadValues: OrganizationBrandingValues = {
      enabled: draft.enabled,
      primary_color: primaryNormalized,
      accent_color: accentNormalized,
    };
    try {
      const updated = await service.publishBranding(
        snapshot.tenant.slug,
        snapshot.revision,
        payloadValues,
        {
          saveEndpoint: snapshot.save_endpoint,
          expectedTenantId: snapshot.tenant.id,
        },
      );
      if (!mountedRef.current) return;
      syncedKeyRef.current = `${updated.tenant.slug}:${updated.revision}`;
      setSnapshot(updated);
      setDraft({ ...updated.values });
      setPrimaryInput(updated.values.primary_color);
      setAccentInput(updated.values.accent_color);
      onBrandingUpdated?.(updated);
      setFeedback({
        tone: 'success',
        message: `Paleta publicada correctamente (versión ${updated.version}).`,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const resolved = resolveBrandingError(err);
      if (resolved.kind === 'conflict' || resolved.kind === 'precondition') {
        await reloadPreservingDraft(resolved.message);
      } else {
        setFeedback({
          tone: 'error',
          message: resolved.message,
        });
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const handleRestore = async (version: number) => {
    if (isReadOnly || submitting) return;
    setSubmitting(true);
    setRestoringVersion(version);
    setFeedback(null);
    try {
      const updated = await service.restoreBranding(
        snapshot.tenant.slug,
        snapshot.revision,
        version,
        {
          saveEndpoint: snapshot.save_endpoint,
          expectedTenantId: snapshot.tenant.id,
        },
      );
      if (!mountedRef.current) return;
      syncedKeyRef.current = `${updated.tenant.slug}:${updated.revision}`;
      setSnapshot(updated);
      setDraft({ ...updated.values });
      setPrimaryInput(updated.values.primary_color);
      setAccentInput(updated.values.accent_color);
      onBrandingUpdated?.(updated);
      setFeedback({
        tone: 'success',
        message: `Versión ${version} restaurada correctamente (ahora versión ${updated.version}).`,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const resolved = resolveBrandingError(err);
      if (resolved.kind === 'conflict' || resolved.kind === 'precondition') {
        await reloadPreservingDraft(resolved.message);
      } else {
        setFeedback({
          tone: 'error',
          message: resolved.message,
        });
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
        setRestoringVersion(null);
      }
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 text-card-foreground shadow-sm"
      data-testid="organization-palette-card"
    >
      {/* Cabecera */}
      <div className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Palette className="h-4 w-4" />
            </span>
            <h4
              id={headingId}
              className="text-base font-semibold tracking-tight text-foreground"
            >
              {snapshot.heading}
            </h4>
            <Badge
              variant={snapshot.values.enabled ? 'default' : 'secondary'}
              className="rounded-md"
            >
              {snapshot.values.enabled ? 'Publicada activa' : 'Publicada inactiva'}
            </Badge>
            <Badge variant="outline" className="rounded-md font-mono text-xs">
              v{snapshot.version}
            </Badge>
          </div>
          <p className="text-sm leading-5 text-muted-foreground">
            {snapshot.scope_note}
          </p>
        </div>
        {isDirty && canEdit ? (
          <Badge
            variant="outline"
            className="w-fit shrink-0 rounded-md border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          >
            Borrador sin publicar
          </Badge>
        ) : null}
      </div>

      {/* Aviso de solo lectura */}
      {isReadOnly ? (
        <Alert
          className="border-amber-500/40 bg-amber-500/10 text-foreground"
          data-testid="palette-readonly-notice"
        >
          <Lock
            className="h-4 w-4 text-amber-700 dark:text-amber-300"
            aria-hidden="true"
          />
          <AlertTitle>Solo lectura</AlertTitle>
          <AlertDescription>{readOnlyMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* Región aria-live para resultados y errores */}
      <div aria-live="polite" aria-atomic="true" className="min-h-0">
        {feedback ? (
          <Alert
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            variant={feedback.tone === 'error' ? 'destructive' : 'default'}
            className={cn(
              feedback.tone === 'success' &&
                'border-emerald-600/40 bg-emerald-500/10 text-foreground',
              feedback.tone === 'warning' &&
                'border-amber-600/50 bg-amber-500/10 text-foreground',
            )}
            data-testid="palette-feedback"
          >
            {feedback.tone === 'success' ? (
              <CheckCircle2
                className="h-4 w-4 text-emerald-700 dark:text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className={cn(
                  'h-4 w-4',
                  feedback.tone === 'warning' &&
                    'text-amber-700 dark:text-amber-300',
                )}
                aria-hidden="true"
              />
            )}
            {feedback.title ? <AlertTitle>{feedback.title}</AlertTitle> : null}
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {/* 1. Interruptor principal */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3.5">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor={enabledSwitchId}
            className="cursor-pointer text-sm font-semibold text-foreground"
          >
            Usar la paleta de la organización
          </Label>
          <p className="text-xs leading-5 text-muted-foreground">
            {draft.enabled
              ? 'Al publicar, los botones y pestañas del portal público usarán estos colores.'
              : 'Desactivada: el portal público mantiene la apariencia estándar de la plataforma.'}
          </p>
        </div>
        <Switch
          id={enabledSwitchId}
          checked={draft.enabled}
          onCheckedChange={handleToggleEnabled}
          disabled={isReadOnly || submitting}
          aria-describedby={undefined}
        />
      </div>

      {/* 2. Color primario y color de acento */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Color primario */}
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
          <div className="space-y-2">
            <Label htmlFor={primaryHexId} className="text-sm font-semibold">
              Color primario
            </Label>
            <div className="flex items-center gap-2.5">
              <div className="shrink-0">
                <label htmlFor={primaryPickerId} className="sr-only">
                  Selector visual de color primario
                </label>
                <input
                  id={primaryPickerId}
                  type="color"
                  value={pickerPrimaryValue}
                  onChange={(event) => handlePrimaryHexChange(event.target.value)}
                  disabled={isReadOnly || submitting}
                  className="h-11 w-12 cursor-pointer rounded-lg border border-input bg-background p-1 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Input
                id={primaryHexId}
                type="text"
                value={primaryInput}
                onChange={(event) => handlePrimaryHexChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
                disabled={isReadOnly || submitting}
                readOnly={isReadOnly}
                maxLength={7}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder="#346600"
                aria-invalid={!primaryValid}
                aria-describedby={!primaryValid ? primaryErrorId : undefined}
                className={cn(
                  'font-mono uppercase',
                  !primaryValid && 'border-destructive focus-visible:ring-destructive',
                )}
              />
            </div>
            {!primaryValid ? (
              <p
                id={primaryErrorId}
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                Ingresá un color hexadecimal válido en formato #RRGGBB (ej. #346600).
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
            {primaryPair ? (
              <>
                <span
                  data-testid="palette-preview-primary"
                  style={{
                    backgroundColor: primaryPair.background,
                    color: primaryPair.foreground,
                  }}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-black/10 dark:ring-white/15"
                >
                  Botón primario
                </span>
                <div
                  className="min-w-0 text-xs leading-5"
                  data-testid="palette-contrast-primary"
                >
                  <p className="font-semibold text-foreground">
                    {formatContrastLabel(primaryPair.contrast)}
                  </p>
                  <p className="text-muted-foreground">
                    {primaryPair.foreground === '#FFFFFF'
                      ? 'Texto blanco (#FFFFFF)'
                      : 'Texto negro (#000000)'}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Corregí el código #RRGGBB para ver la vista previa y el contraste.
              </p>
            )}
          </div>
        </div>

        {/* Color de acento */}
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
          <div className="space-y-2">
            <Label htmlFor={accentHexId} className="text-sm font-semibold">
              Color de acento
            </Label>
            <div className="flex items-center gap-2.5">
              <div className="shrink-0">
                <label htmlFor={accentPickerId} className="sr-only">
                  Selector visual de color de acento
                </label>
                <input
                  id={accentPickerId}
                  type="color"
                  value={pickerAccentValue}
                  onChange={(event) => handleAccentHexChange(event.target.value)}
                  disabled={isReadOnly || submitting}
                  className="h-11 w-12 cursor-pointer rounded-lg border border-input bg-background p-1 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Input
                id={accentHexId}
                type="text"
                value={accentInput}
                onChange={(event) => handleAccentHexChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
                disabled={isReadOnly || submitting}
                readOnly={isReadOnly}
                maxLength={7}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder="#98C400"
                aria-invalid={!accentValid}
                aria-describedby={!accentValid ? accentErrorId : undefined}
                className={cn(
                  'font-mono uppercase',
                  !accentValid && 'border-destructive focus-visible:ring-destructive',
                )}
              />
            </div>
            {!accentValid ? (
              <p
                id={accentErrorId}
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                Ingresá un color hexadecimal válido en formato #RRGGBB (ej. #98C400).
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
            {accentPair ? (
              <>
                <span
                  data-testid="palette-preview-accent"
                  style={{
                    backgroundColor: accentPair.background,
                    color: accentPair.foreground,
                  }}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-black/10 dark:ring-white/15"
                >
                  Botón de acento
                </span>
                <div
                  className="min-w-0 text-xs leading-5"
                  data-testid="palette-contrast-accent"
                >
                  <p className="font-semibold text-foreground">
                    {formatContrastLabel(accentPair.contrast)}
                  </p>
                  <p className="text-muted-foreground">
                    {accentPair.foreground === '#FFFFFF'
                      ? 'Texto blanco (#FFFFFF)'
                      : 'Texto negro (#000000)'}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Corregí el código #RRGGBB para ver la vista previa y el contraste.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Presets como chips */}
      {snapshot.presets.length > 0 ? (
        <div className="space-y-2.5" role="group" aria-labelledby={presetsLabelId}>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <p
              id={presetsLabelId}
              className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Presets
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {snapshot.presets.map((preset) => {
              const selected =
                primaryNormalized === preset.primary_color &&
                accentNormalized === preset.accent_color;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isReadOnly || submitting}
                  aria-pressed={selected}
                  onClick={() => handleApplyPreset(preset)}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    selected
                      ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                      : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted/40',
                  )}
                >
                  <span className="inline-flex items-center -space-x-1" aria-hidden="true">
                    <span
                      className="h-4 w-4 rounded-full border border-black/15 dark:border-white/25"
                      style={{ backgroundColor: preset.primary_color }}
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-black/15 dark:border-white/25"
                      style={{ backgroundColor: preset.accent_color }}
                    />
                  </span>
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 4. Acciones Publicar y Descartar */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border/60 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleDiscard}
          disabled={!canDiscard}
          className="min-h-10"
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Descartar
        </Button>
        <Button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish}
          className="min-h-10"
        >
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          {submitting && restoringVersion === null ? 'Publicando…' : 'Publicar'}
        </Button>
      </div>

      {/* 5. Historial de versiones */}
      <div
        className="space-y-3 border-t border-border/60 pt-4"
        aria-labelledby={historyHeadingId}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h5
            id={historyHeadingId}
            className="text-sm font-semibold text-foreground"
          >
            Historial de versiones
          </h5>
        </div>

        {sortedHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay versiones anteriores registradas.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="palette-history-list">
            {sortedHistory.map((entry) => {
              const isRestoringThis = restoringVersion === entry.version;
              return (
                <li
                  key={entry.version}
                  className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/15 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-xs">
                    <span className="font-semibold text-foreground">
                      Versión {entry.version}
                    </span>
                    <Badge
                      variant={entry.values.enabled ? 'secondary' : 'outline'}
                      className="rounded-md"
                    >
                      {entry.values.enabled ? 'Activa' : 'Inactiva'}
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                      <span
                        className="h-3.5 w-3.5 rounded border border-black/15 dark:border-white/25"
                        style={{ backgroundColor: entry.values.primary_color }}
                        aria-hidden="true"
                      />
                      {entry.values.primary_color}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                      <span
                        className="h-3.5 w-3.5 rounded border border-black/15 dark:border-white/25"
                        style={{ backgroundColor: entry.values.accent_color }}
                        aria-hidden="true"
                      />
                      {entry.values.accent_color}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isReadOnly || submitting}
                    onClick={() => void handleRestore(entry.version)}
                    className="min-h-9 w-fit shrink-0"
                  >
                    {isRestoringThis ? 'Restaurando…' : 'Restaurar'}
                    <span className="sr-only"> versión {entry.version}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
