import { FormEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Copy, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';

import { DictationControl } from '@/components/knowledge/DictationControl';
import { TenantShell } from '@/components/tenant/TenantShell';
import { useTenant } from '@/context/TenantContext';
import { submitTenantTicket } from '@/api/tenant';
import { tenantService } from '@/services/tenantService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/utils/api';
import type { TenantClaimIntakeReceipt, TenantTicketPayload } from '@/types/tenant';

type SubmissionAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};

type ClaimDraft = {
  categoria: string;
  descripcion: string;
  lat: string;
  lng: string;
  receipt: TenantClaimIntakeReceipt | null;
  receiptFingerprint: string | null;
};

type ClaimScope = { slug: string; ready: boolean };
type PendingSubmission = { scope: ClaimScope; controller: AbortController };
type PublishedCategory = { label: string; value: string };
type CategoryLoad = { status: 'loading' | 'ready' | 'error'; categories: PublishedCategory[] };
type ClaimFeedback = { descriptionError: boolean; formError: string | null };

const emptyDraft: ClaimDraft = { categoria: '', descripcion: '', lat: '', lng: '', receipt: null, receiptFingerprint: null };
const emptyFeedback: ClaimFeedback = { descriptionError: false, formError: null };
const normalizeSlug = (value?: string | null) => value?.trim().toLowerCase() || '';

const claimDraftPayload = (draft: ClaimDraft, categories?: PublishedCategory[]): TenantTicketPayload => ({
  categoria: categories?.some((category) => category.value === draft.categoria)
    ? draft.categoria
    : undefined,
  descripcion: draft.descripcion.trim(),
  lat: draft.lat.trim() ? Number(draft.lat) : undefined,
  lng: draft.lng.trim() ? Number(draft.lng) : undefined,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads only ticket categories reachable from the backend-published public menu. */
export const readPublishedTicketCategories = (menu: unknown): PublishedCategory[] => {
  if (!isRecord(menu) || !Array.isArray(menu.main_menu) || !isRecord(menu.submenus)) return [];
  const categories: PublishedCategory[] = [];
  const seenCategories = new Set<string>();
  const visitedSubmenus = new Set<string>();
  const walk = (items: unknown[]) => {
    for (const item of items) {
      if (!isRecord(item)) continue;
      if (item.type === 'ticket_category') {
        const label = typeof item.label === 'string' ? item.label : '';
        const value = typeof item.ticket_category === 'string' ? item.ticket_category : '';
        if (label.trim() && value.trim() && !seenCategories.has(value)) {
          seenCategories.add(value);
          categories.push({ label, value });
        }
        continue;
      }
      if (item.type !== 'submenu') continue;
      const submenuId = typeof item.id === 'string' ? item.id.trim() : '';
      if (!submenuId || visitedSubmenus.has(submenuId)) continue;
      visitedSubmenus.add(submenuId);
      const submenu = menu.submenus[submenuId];
      if (Array.isArray(submenu)) walk(submenu);
    }
  };
  walk(menu.main_menu);
  return categories;
};

const claimPayloadFingerprint = (slug: string, payload: TenantTicketPayload) =>
  JSON.stringify({
    slug,
    categoria: payload.categoria ?? null,
    descripcion: payload.descripcion,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
  });

export const createClaimIdempotencyKey = () => {
  const browserCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (browserCrypto?.randomUUID) {
    return `claim-intake-${browserCrypto.randomUUID()}`;
  }

  if (browserCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `claim-intake-${suffix}`;
  }

  throw new Error('Este navegador no ofrece criptografía segura para enviar el reclamo.');
};

const ClaimReceipt = ({
  receipt,
  tenantName,
  onCreateAnother,
}: {
  receipt: TenantClaimIntakeReceipt;
  tenantName: string;
  onCreateAnother: () => void;
}) => {
  const [showPin, setShowPin] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copyAttemptRef = useRef<object | null>(null);
  const mountedRef = useRef(false);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const trackingAction = receipt.actions.find(
    (action) => action.id === 'track_claim' && action.href === receipt.tracking.path,
  );

  useLayoutEffect(() => {
    mountedRef.current = true;
    confirmationHeadingRef.current?.focus();
    return () => {
      mountedRef.current = false;
      copyAttemptRef.current = null;
    };
  }, []);

  const copyReceipt = async () => {
    const copyAttempt = {};
    copyAttemptRef.current = copyAttempt;
    const isCurrent = () => mountedRef.current && copyAttemptRef.current === copyAttempt;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(
        `Código: ${receipt.claim.code}\nPIN: ${receipt.access.pin}`,
      );
      if (isCurrent()) setCopyMessage('Código y PIN copiados.');
    } catch {
      if (isCurrent()) setCopyMessage('No pudimos copiarlo. Guardá el código y el PIN manualmente.');
    }
  };

  return (
    <div className="space-y-6" data-testid="claim-intake-receipt">
      <div
        className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3
            ref={confirmationHeadingRef}
            tabIndex={-1}
            className="tenant-ticket-question text-lg font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Listo, recibimos tu reclamo o pedido
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {receipt.deduplicated
              ? 'Recuperamos el comprobante de tu envío anterior. No se creó otro reclamo.'
              : `El equipo de ${tenantName} ya lo recibió y puede comenzar a gestionarlo.`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Número o referencia</p>
          <p className="mt-1 font-mono text-xl font-bold" data-testid="claim-code">
            {receipt.claim.code}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground">PIN de acceso</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-mono text-xl font-bold" data-testid="claim-pin">
              {showPin ? receipt.access.pin : '•'.repeat(receipt.access.pin.length)}
            </p>
            <Button
              className="min-h-11 gap-2 px-3"
              type="button"
              variant="ghost"
              onClick={() => setShowPin((current) => !current)}
              aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              aria-pressed={showPin}
            >
              {showPin ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span>{showPin ? 'Ocultar PIN' : 'Mostrar PIN'}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="tenant-ticket-question text-lg font-semibold text-foreground">¿Qué podés hacer ahora?</h3>
        <p className="text-sm text-muted-foreground">
          Guardá este comprobante. Vas a necesitar el número y el PIN para consultar los avances de forma segura.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="outline" className="tenant-ticket-control min-h-11" onClick={() => void copyReceipt()}>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          Copiar código y PIN
        </Button>
        {trackingAction ? <Button asChild className="min-h-11">
          <a
            href={trackingAction.href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            {trackingAction.label}
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </Button> : null}
        <Button type="button" variant="ghost" className="min-h-11" onClick={onCreateAnother}>
          Crear otro reclamo
        </Button>
      </div>

      {copyMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
};

const TenantTicketFormPage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug, isLoadingTenant, tenantError } = useTenant();
  const [drafts, setDrafts] = useState(() => new Map<string, ClaimDraft>());
  const [categoryLoads, setCategoryLoads] = useState(() => new Map<string, CategoryLoad>());
  const [feedbackBySlug, setFeedbackBySlug] = useState(() => new Map<string, ClaimFeedback>());
  const [submission, setSubmission] = useState<PendingSubmission | null>(null);
  const [dictationEpoch, setDictationEpoch] = useState(0);
  const submissionAttemptsRef = useRef(new Map<string, SubmissionAttempt>());
  const categoryRequestsRef = useRef(new Map<string, symbol>());
  const categoryCacheRef = useRef(new Map<string, PublishedCategory[]>());
  const locationRequestRef = useRef<symbol | null>(null);
  const activeSubmissionRef = useRef<PendingSubmission | null>(null);
  const currentScopeRef = useRef<ClaimScope | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const descriptionHelpId = useId();
  const descriptionErrorId = useId();
  const dictationStatusId = useId();
  const locationStatusId = useId();

  // The route changes before TenantProvider finishes confirming its new profile.
  const slug = normalizeSlug(params.tenant) || normalizeSlug(currentSlug);
  const tenantReady = Boolean(
    slug && normalizeSlug(tenant?.slug) === slug && normalizeSlug(currentSlug) === slug && !isLoadingTenant && !tenantError,
  );
  const scope = useMemo(() => ({ slug, ready: tenantReady }), [slug, tenantReady]);
  useLayoutEffect(() => {
    currentScopeRef.current = scope;
    return () => {
      if (currentScopeRef.current === scope) currentScopeRef.current = null;
      const retired = activeSubmissionRef.current;
      if (retired?.scope === scope) {
        activeSubmissionRef.current = null;
        retired.controller.abort();
      }
    };
  }, [scope]);

  useEffect(() => {
    if (!slug) return;
    if (categoryCacheRef.current.has(slug)) return;
    const request = Symbol(slug);
    categoryRequestsRef.current.set(slug, request);
    setCategoryLoads((current) => {
      const next = new Map(current);
      next.set(slug, { status: 'loading', categories: [] });
      return next;
    });
    void tenantService.getPublicMenu(slug, 'widget').then(
      (menu) => {
        if (categoryRequestsRef.current.get(slug) !== request) return;
        const publishedCategories = readPublishedTicketCategories(menu);
        categoryCacheRef.current.set(slug, publishedCategories);
        setCategoryLoads((current) => {
          const next = new Map(current);
          next.set(slug, { status: 'ready', categories: publishedCategories });
          return next;
        });
      },
      () => {
        if (categoryRequestsRef.current.get(slug) !== request) return;
        setCategoryLoads((current) => {
          const next = new Map(current);
          next.set(slug, { status: 'error', categories: [] });
          return next;
        });
      },
    );
    return () => {
      if (categoryRequestsRef.current.get(slug) === request) categoryRequestsRef.current.delete(slug);
    };
  }, [slug]);

  const draft = drafts.get(slug) ?? emptyDraft;
  const { categoria, descripcion, lat, lng } = draft;
  const categoryLoad = categoryLoads.get(slug);
  const categories = categoryLoad?.categories ?? [];
  const selectedCategory = categories.some((category) => category.value === categoria) ? categoria : '';
  const feedback = feedbackBySlug.get(slug) ?? emptyFeedback;
  const isSubmitting = submission?.scope === scope;
  const tenantName = tenantReady ? tenant?.nombre ?? 'este espacio' : 'este espacio';
  const receipt = tenantReady ? draft.receipt : null;
  const updateDraft = (update: (current: ClaimDraft) => ClaimDraft) => {
    setDrafts((current) => {
      const next = new Map(current);
      next.set(slug, update(current.get(slug) ?? emptyDraft));
      return next;
    });
  };
  const setField = (field: 'categoria' | 'descripcion' | 'lat' | 'lng', value: string) =>
    updateDraft((current) => ({ ...current, [field]: value }));
  const updateFeedback = (update: (current: ClaimFeedback) => ClaimFeedback) => {
    setFeedbackBySlug((current) => {
      const next = new Map(current);
      next.set(slug, update(current.get(slug) ?? emptyFeedback));
      return next;
    });
  };
  const setCategory = (value: string) => {
    setField('categoria', value);
    updateFeedback((current) => ({ ...current, formError: null }));
  };
  const setDescription = (value: string) => {
    setField('descripcion', value);
    updateFeedback((current) => ({
      descriptionError: value.trim() ? false : current.descriptionError,
      formError: null,
    }));
  };
  const appendDictation = (text: string) => {
    updateDraft((current) => ({
      ...current,
      descripcion: [current.descripcion.trim(), text].filter(Boolean).join(' '),
    }));
    updateFeedback(() => emptyFeedback);
    descriptionRef.current?.focus({ preventScroll: true });
  };

  const [locationState, setLocationState] = useState({ slug: '', locating: false, note: '' });
  const locating = locationState.slug === slug && locationState.locating;
  const locationNote = locationState.slug === slug ? locationState.note : '';
  useEffect(() => {
    locationRequestRef.current = null;
    setLocationState({ slug, locating: false, note: '' });
  }, [scope, slug]);
  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      locationRequestRef.current = null;
      setLocationState({ slug, locating: false, note: 'Este dispositivo no permite compartir la ubicación. Escribí la dirección en la descripción.' });
      return;
    }
    const requestedScope = scope;
    const request = Symbol(slug);
    locationRequestRef.current = request;
    setLocationState({ slug, locating: true, note: '' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (currentScopeRef.current !== requestedScope || locationRequestRef.current !== request) return;
        locationRequestRef.current = null;
        setField('lat', position.coords.latitude.toFixed(6));
        setField('lng', position.coords.longitude.toFixed(6));
        setLocationState({ slug, locating: false, note: 'Ubicación agregada al reclamo.' });
      },
      () => {
        if (currentScopeRef.current !== requestedScope || locationRequestRef.current !== request) return;
        locationRequestRef.current = null;
        setLocationState({ slug, locating: false, note: 'No pudimos obtener tu ubicación. Revisá el permiso o escribí la dirección en la descripción.' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  const resetForm = () => {
    locationRequestRef.current = null;
    updateDraft(() => emptyDraft);
    updateFeedback(() => emptyFeedback);
    setLocationState({ slug, locating: false, note: '' });
    setDictationEpoch((current) => current + 1);
    submissionAttemptsRef.current.delete(slug);
  };

  const createAnotherClaim = () => {
    updateDraft((current) =>
      claimPayloadFingerprint(slug, claimDraftPayload(current, categories)) === current.receiptFingerprint
        ? emptyDraft
        : { ...current, receipt: null, receiptFingerprint: null },
    );
    updateFeedback(() => emptyFeedback);
    submissionAttemptsRef.current.delete(slug);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeSubmissionRef.current?.scope === scope || currentScopeRef.current !== scope) return;

    if (!slug) {
      toast({
        title: 'Seleccioná un espacio',
        description: 'Elegí un espacio desde el encabezado antes de enviar un reclamo.',
        variant: 'destructive',
      });
      return;
    }

    if (!tenantReady) return;

    if (!descripcion.trim()) {
      updateFeedback((current) => ({ ...current, descriptionError: true, formError: null }));
      descriptionRef.current?.focus();
      toast({
        title: 'La descripción es obligatoria',
        description: 'Contanos qué ocurrió para poder ayudarte.',
        variant: 'destructive',
      });
      return;
    }

    updateFeedback((current) => ({ ...current, descriptionError: false, formError: null }));
    const payload = claimDraftPayload(draft, categories);
    const fingerprint = claimPayloadFingerprint(slug, payload);
    const previousAttempt = submissionAttemptsRef.current.get(slug);
    let attempt: SubmissionAttempt;
    try {
      attempt =
        previousAttempt?.fingerprint === fingerprint
          ? previousAttempt
          : { fingerprint, idempotencyKey: createClaimIdempotencyKey() };
    } catch (error) {
      updateFeedback((current) => ({ ...current, formError: getErrorMessage(error) }));
      toast({
        title: 'No pudimos preparar el envío',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return;
    }
    submissionAttemptsRef.current.set(slug, attempt);

    // A retry can reuse the key, but each running request has its own owner.
    const pending = { scope, controller: new AbortController() };
    activeSubmissionRef.current = pending;
    setSubmission(pending);
    const isCurrent = () => currentScopeRef.current === scope && activeSubmissionRef.current === pending;
    try {
      const confirmedReceipt = await submitTenantTicket(slug, payload, attempt.idempotencyKey, {
        signal: pending.controller.signal,
        isCurrent,
      });
      if (isCurrent()) {
        updateFeedback(() => emptyFeedback);
        updateDraft((current) => ({ ...current, receipt: confirmedReceipt, receiptFingerprint: fingerprint }));
      }
    } catch (error) {
      if (isCurrent()) {
        updateFeedback((current) => ({ ...current, formError: getErrorMessage(error) }));
        toast({
          title: 'No pudimos enviar tu reclamo',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    } finally {
      if (isCurrent()) {
        activeSubmissionRef.current = null;
        setSubmission(null);
      }
    }
  };

  const hasCategories = categories.length > 0;
  const totalSteps = hasCategories ? 3 : 2;
  const descriptionStep = hasCategories ? 2 : 1;
  const locationStep = hasCategories ? 3 : 2;
  const descriptionDescribedBy = [
    descriptionHelpId,
    feedback.descriptionError ? descriptionErrorId : null,
    dictationStatusId,
  ].filter(Boolean).join(' ');

  return (
    <TenantShell titleSection="Reclamo o pedido">
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle level={2}>Seleccioná un espacio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Elegí un espacio para registrar reclamos, sugerencias o consultas.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle level={2}>{receipt ? 'Comprobante' : 'Hacer un reclamo o pedido'}</CardTitle>
          </CardHeader>
          <CardContent>
            {receipt ? (
              <ClaimReceipt key={`${slug}:${receipt.request_id}`} receipt={receipt} tenantName={tenantName} onCreateAnother={createAnotherClaim} />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Respondé estas preguntas con tus palabras. El equipo de {tenantName} va a recibir lo que envíes.
                </p>
                {categoryLoad?.status === 'loading' ? (
                  <p className="mt-4 text-sm text-muted-foreground" role="status">Estamos cargando los temas disponibles.</p>
                ) : null}
                {categoryLoad?.status === 'error' ? (
                  <p className="mt-4 text-sm text-muted-foreground" role="status">No pudimos cargar los temas. Podés continuar sin elegir uno.</p>
                ) : null}
                <form onSubmit={handleSubmit} className="mt-6 space-y-0" noValidate>
                  {hasCategories ? (
                    <fieldset className="space-y-3 border-b border-border pb-6">
                      <legend className="w-full">
                        <span className="tenant-ticket-step block text-sm font-medium text-muted-foreground">Paso 1 de {totalSteps}</span>
                        <span className="tenant-ticket-question mt-1 block text-lg font-semibold text-foreground">¿De qué se trata?</span>
                      </legend>
                      {categories.length <= 8 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {categories.map((category) => {
                            const selected = selectedCategory === category.value;
                            return (
                              <Button
                                key={category.value}
                                type="button"
                                variant="outline"
                                className={`tenant-ticket-control tenant-ticket-category h-auto min-h-11 justify-between gap-3 whitespace-normal py-3 text-left active:scale-100 ${selected ? 'border-primary bg-primary/10' : ''}`}
                                aria-label={category.label}
                                aria-pressed={selected}
                                disabled={!tenantReady}
                                onClick={() => setCategory(selected ? '' : category.value)}
                              >
                                <span>{category.label}</span>
                                {selected ? <span className="tenant-ticket-selected tenant-ticket-step text-sm font-medium text-primary" aria-hidden="true">Seleccionado</span> : null}
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="categoria">Tema o categoría (opcional)</Label>
                          <select
                            id="categoria"
                            className="tenant-ticket-control min-h-11 w-full rounded-md border border-input bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={selectedCategory}
                            disabled={!tenantReady}
                            onChange={(event) => setCategory(event.target.value)}
                          >
                            <option value="">Elegí un tema</option>
                            {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                          </select>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">Este paso es opcional.</p>
                    </fieldset>
                  ) : null}

                  <section className={`space-y-3 py-6 ${hasCategories ? '' : 'pt-0'}`} aria-labelledby="claim-description-question">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Paso {descriptionStep} de {totalSteps}</p>
                      <h3 id="claim-description-question" className="mt-1 text-lg font-semibold text-foreground">¿Qué pasó o qué necesitás?</h3>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Label htmlFor="descripcion">Descripción</Label>
                      <p className="text-sm font-medium text-foreground">Obligatorio</p>
                    </div>
                    <Textarea
                      ref={descriptionRef}
                      id="descripcion"
                      className="tenant-ticket-control"
                      value={descripcion}
                      onChange={(event) => setDescription(event.target.value)}
                      aria-required="true"
                      aria-invalid={feedback.descriptionError}
                      aria-describedby={descriptionDescribedBy}
                      rows={6}
                    />
                    <p id={descriptionHelpId} className="text-sm text-muted-foreground">
                      Contá qué pasó, dónde y cuándo. No incluyas datos personales que no hagan falta.
                    </p>
                    {feedback.descriptionError ? (
                      <p id={descriptionErrorId} className="text-sm font-medium text-destructive" role="alert" aria-live="assertive" aria-atomic="true">
                        Contanos qué pasó o qué necesitás para poder ayudarte.
                      </p>
                    ) : null}
                    <div className="tenant-ticket-dictation">
                      <DictationControl
                        key={`${slug}:${tenantReady ? 'ready' : 'waiting'}:${dictationEpoch}`}
                        disabled={!tenantReady}
                        onText={appendDictation}
                        statusId={dictationStatusId}
                        fullLabel
                        copy={{
                          listening: 'Te escucho. Contá qué pasó o qué necesitás.',
                          recognitionError: 'No pudimos escucharte. Probá de nuevo o escribí la descripción.',
                          startError: 'No pudimos iniciar el dictado. Escribí la descripción.',
                        }}
                      />
                    </div>
                  </section>

                  <fieldset className="space-y-3 border-t border-border pt-6">
                    <legend className="w-full">
                      <span className="tenant-ticket-step block text-sm font-medium text-muted-foreground">Paso {locationStep} de {totalSteps}</span>
                      <span className="tenant-ticket-question mt-1 block text-lg font-semibold text-foreground">¿Querés decir dónde pasó?</span>
                    </legend>
                    <p className="text-sm text-muted-foreground">
                      Este paso es opcional. Podés usar la ubicación del dispositivo o escribir la dirección en la descripción.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="button" variant="outline" className="tenant-ticket-control h-auto min-h-11 whitespace-normal" disabled={locating || isSubmitting} onClick={useCurrentLocation} aria-describedby={locationStatusId}>
                        {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        {locating ? 'Buscando ubicación…' : lat && lng ? 'Actualizar mi ubicación' : 'Usar mi ubicación'}
                      </Button>
                      {lat && lng ? (
                        <Button type="button" variant="ghost" className="min-h-11" disabled={isSubmitting} onClick={() => { locationRequestRef.current = null; setField('lat', ''); setField('lng', ''); setLocationState({ slug, locating: false, note: '' }); }}>
                          Quitar ubicación
                        </Button>
                      ) : null}
                    </div>
                    <p id={locationStatusId} role="status" className="text-sm text-muted-foreground">{locationNote || (lat && lng ? 'Ubicación agregada al reclamo.' : '')}</p>
                    <details className="tenant-ticket-control rounded-md border px-3 py-2">
                      <summary className="flex min-h-11 cursor-pointer items-center rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Cargar coordenadas a mano</summary>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="lat">Latitud (opcional)</Label>
                          <Input className="tenant-ticket-control min-h-11" id="lat" type="number" step="any" value={lat} onChange={(event) => setField('lat', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lng">Longitud (opcional)</Label>
                          <Input className="tenant-ticket-control min-h-11" id="lng" type="number" step="any" value={lng} onChange={(event) => setField('lng', event.target.value)} />
                        </div>
                      </div>
                    </details>
                  </fieldset>

                  {feedback.formError ? (
                    <div className="mt-6 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-foreground" role="alert" aria-live="assertive" aria-atomic="true">
                      <p className="font-semibold">No pudimos enviar tu reclamo o pedido.</p>
                      <p className="mt-1 text-sm">{feedback.formError}</p>
                      <p className="mt-1 text-sm">Tu información sigue en el formulario. Revisala y probá de nuevo.</p>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
                    <Button type="submit" className="h-auto min-h-11 whitespace-normal" disabled={isSubmitting || !tenantReady}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                      Enviar reclamo
                    </Button>
                    <Button type="button" variant="outline" className="tenant-ticket-control min-h-11" disabled={isSubmitting} onClick={resetForm}>
                      Limpiar
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </TenantShell>
  );
};

export default TenantTicketFormPage;
