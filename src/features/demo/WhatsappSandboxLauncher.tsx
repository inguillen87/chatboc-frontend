import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createDemoWhatsappSandbox, getDemoWhatsappSandbox } from './demoApi';
import type {
  DemoSector,
  DemoWhatsappSandboxOption,
  DemoWhatsappSandboxResponse,
  DemoWhatsappSandboxResource,
  DemoWhatsappSandboxScript,
} from './demoTypes';
import { ApiError, getErrorMessage } from '@/utils/api';
import {
  persistDemoRuntimeStorage,
  persistDemoWhatsappProfileSelection,
  readDemoWhatsappProfileSelection,
  subscribeDemoWhatsappProfileSelection,
} from './demoStorage';

type LauncherError = {
  message: string;
  requestId?: string | null;
};

const readText = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const readRequestId = (error: unknown): string | null => {
  if (error instanceof ApiError) return error.requestId ?? error.body?.request_id ?? null;
  if (!error || typeof error !== 'object') return null;
  const value = (error as Record<string, unknown>).request_id ?? (error as Record<string, unknown>).requestId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const buildError = (error: unknown): LauncherError => ({
  message: getErrorMessage(error, 'No se pudo cargar el sandbox de WhatsApp.').replace(
    /\s*\(Req ID: .*?\)\s*$/,
    '',
  ),
  requestId: readRequestId(error),
});

const normalizeOptionKey = (option: DemoWhatsappSandboxOption, index: number) =>
  readText(option.id, option.key, option.value, option.slug, option.rubro_slug, option.rubro, option.label) ??
  `option-${index}`;

const optionLabel = (option: DemoWhatsappSandboxOption) =>
  readText(option.label, option.title, option.name, option.rubro, option.rubro_slug, option.value, option.slug);

const optionDescription = (option: DemoWhatsappSandboxOption) =>
  readText(option.description, option.detail, option.subtitle);

const scriptTitle = (script: DemoWhatsappSandboxScript) =>
  readText(script.label, script.title, script.message, script.text, script.prompt);

const scriptBody = (script: DemoWhatsappSandboxScript) =>
  readText(script.message, script.text, script.prompt, script.description);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readArray = (source: unknown, key: string) => {
  if (!isRecord(source)) return [];
  const value = source[key];
  return Array.isArray(value) ? value : [];
};

const normalizePlaybookScript = (value: unknown, index: number): DemoWhatsappSandboxScript | null => {
  if (typeof value === 'string' && value.trim()) {
    return { id: `playbook-${index}`, label: value.trim(), message: value.trim() };
  }
  if (!isRecord(value)) return null;
  const label = readText(value.label, value.title, value.name, value.text, value.message, value.prompt);
  if (!label) return null;
  return {
    id: readText(value.id, value.key, value.action_id, value.intent) ?? `playbook-${index}`,
    key: readText(value.key, value.action_id, value.intent),
    label,
    title: readText(value.title, value.label),
    message: readText(value.message, value.text, value.prompt, value.description),
    text: readText(value.text, value.message, value.prompt),
    prompt: readText(value.prompt),
    description: readText(value.description, value.detail, value.subtitle),
    raw: value,
  };
};

const collectPlaybookScripts = (launcher: DemoWhatsappSandboxResponse | null) => {
  const sandbox = launcher?.whatsapp_sandbox;
  const candidates = [
    (sandbox as Record<string, unknown> | null | undefined)?.whatsapp_playbook,
    isRecord((sandbox as Record<string, unknown> | null | undefined)?.education)
      ? ((sandbox as Record<string, unknown>).education as Record<string, unknown>).whatsapp_playbook
      : null,
    isRecord((launcher as Record<string, unknown> | null | undefined)?.education)
      ? ((launcher as Record<string, unknown>).education as Record<string, unknown>).whatsapp_playbook
      : null,
    isRecord((launcher as Record<string, unknown> | null | undefined)?.workspace) &&
    isRecord(((launcher as Record<string, unknown>).workspace as Record<string, unknown>).education)
      ? (((launcher as Record<string, unknown>).workspace as Record<string, unknown>).education as Record<string, unknown>)
          .whatsapp_playbook
      : null,
  ];

  const seen = new Set<string>();
  return candidates.flatMap((playbook) =>
    [
      ...readArray(playbook, 'primary_actions'),
      ...readArray(playbook, 'quick_menu'),
      ...readArray(playbook, 'actions'),
      ...readArray(playbook, 'starter_messages'),
    ]
      .map(normalizePlaybookScript)
      .filter((item): item is DemoWhatsappSandboxScript => Boolean(item))
      .filter((item) => {
        const key = readText(item.key, item.id, item.label, item.title);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  );
};

const resourceLabel = (resource: DemoWhatsappSandboxResource) =>
  readText(resource.label, resource.title, resource.id, resource.key, resource.type, resource.kind);

const resourceHref = (resource: DemoWhatsappSandboxResource) => readText(resource.url, resource.href);

const readPositiveNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const persistSandboxSession = (response: DemoWhatsappSandboxResponse | null) => {
  const session = response?.session;
  if (!session) return;
  persistDemoRuntimeStorage(session);
};

export default function WhatsappSandboxLauncher({
  initialSector,
  initialRubro,
  initialTenantSlug,
}: {
  initialSector?: DemoSector | string | null;
  initialRubro?: string | null;
  initialTenantSlug?: string | null;
}) {
  const [launcher, setLauncher] = useState<DemoWhatsappSandboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOptionKey, setLoadingOptionKey] = useState<string | null>(null);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(() =>
    readDemoWhatsappProfileSelection({
      sector: readText(initialSector),
      tenantSlug: readText(initialTenantSlug),
    }),
  );
  const [error, setError] = useState<LauncherError | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const headingId = useId();
  const optionsLabelId = useId();
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeDemoWhatsappProfileSelection(() => {
        setSelectedOptionKey(
          readDemoWhatsappProfileSelection({
            sector: readText(initialSector),
            tenantSlug: readText(initialTenantSlug),
          }),
        );
      }),
    [initialSector, initialTenantSlug],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getDemoWhatsappSandbox({
      sector: initialSector ?? undefined,
      rubro: initialRubro ?? undefined,
      tenant_slug: initialTenantSlug ?? undefined,
      source: 'public_demo_profile',
    })
      .then((response) => {
        if (!active) return;
        setLauncher(response);
        persistSandboxSession(response);
      })
      .catch((err) => {
        if (!active) return;
        setLauncher(null);
        setError(buildError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialRubro, initialSector, initialTenantSlug]);

  const sandbox = launcher?.whatsapp_sandbox?.sandbox ?? null;
  const trialPolicy = launcher?.whatsapp_sandbox?.trial_policy ?? null;
  const options = launcher?.whatsapp_sandbox?.rubro_options ?? [];
  const scripts = (launcher?.whatsapp_sandbox?.scenario_scripts ?? []).filter((script) => scriptTitle(script));
  const playbookScripts = collectPlaybookScripts(launcher);
  const displayScripts = [...playbookScripts, ...scripts].filter((script, index, all) => {
    const key = readText(script.key, script.id, script.label, script.title) ?? `script-${index}`;
    return all.findIndex((candidate, candidateIndex) => {
      const candidateKey =
        readText(candidate.key, candidate.id, candidate.label, candidate.title) ?? `script-${candidateIndex}`;
      return candidateKey === key;
    }) === index;
  });
  const catalog = launcher?.whatsapp_sandbox?.catalog ?? null;
  const catalogResources = Array.isArray(catalog?.resources)
    ? catalog.resources.filter((resource) => resourceLabel(resource))
    : [];
  const uploadDemo = catalog?.pdf_excel_upload_demo ?? null;
  const surveysVotings = launcher?.whatsapp_sandbox?.surveys_votings ?? null;
  const maxMessages = readPositiveNumber(trialPolicy?.max_messages, launcher?.session?.max_messages);
  const freeInputs = Array.isArray(trialPolicy?.free_inputs)
    ? trialPolicy.free_inputs.filter((input): input is string => typeof input === 'string' && input.trim().length > 0)
    : [];
  const joinPhrase = readText(sandbox?.join_phrase);
  const activationMessage = readText(sandbox?.activation_message);
  const requiresJoinPhrase = sandbox?.requires_join_phrase === false ? false : Boolean(joinPhrase);
  const displayNumber = readText(sandbox?.display_number);
  const deeplink = readText(sandbox?.wa_deeplink);
  const qrUrl = readText(sandbox?.qr_url);
  const surveyUrl = readText(surveysVotings?.url, surveysVotings?.href, surveysVotings?.endpoint);

  useEffect(() => {
    setQrFailed(false);
  }, [qrUrl]);

  const selectedKey = useMemo(() => {
    if (
      selectedOptionKey &&
      options.some((option, index) => normalizeOptionKey(option, index) === selectedOptionKey)
    ) {
      return selectedOptionKey;
    }

    const normalizedRubro = readText(initialRubro)?.toLocaleLowerCase();
    if (normalizedRubro) {
      const selectedByRubro = options.find((option) =>
        [option.id, option.rubro, option.rubro_slug, option.slug, option.value, option.key].some(
          (value) => readText(value)?.toLocaleLowerCase() === normalizedRubro,
        ),
      );
      if (selectedByRubro) {
        return normalizeOptionKey(selectedByRubro, options.indexOf(selectedByRubro));
      }
    }

    const normalizedSector = readText(initialSector)?.toLocaleLowerCase();
    if (!normalizedSector) return null;
    const sectorMatches = options
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => readText(option.sector)?.toLocaleLowerCase() === normalizedSector);
    return sectorMatches.length === 1
      ? normalizeOptionKey(sectorMatches[0].option, sectorMatches[0].index)
      : null;
  }, [initialRubro, initialSector, options, selectedOptionKey]);

  useEffect(() => {
    const container = optionsContainerRef.current;
    if (!container || !selectedKey || typeof container.scrollTo !== 'function') return;
    const selectedOption = Array.from(container.children).find(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element.dataset.optionKey === selectedKey,
    );
    if (!selectedOption) return;
    const centeredLeft = selectedOption.offsetLeft - (container.clientWidth - selectedOption.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, centeredLeft), behavior: 'auto' });
  }, [options.length, selectedKey]);

  const selectOption = async (option: DemoWhatsappSandboxOption, index: number) => {
    if (option.disabled || loading) return;
    const key = normalizeOptionKey(option, index);
    setLoadingOptionKey(key);
    setError(null);
    try {
      const response = await createDemoWhatsappSandbox({
        sector: readText(option.sector, initialSector),
        rubro: readText(option.rubro, option.rubro_slug, option.slug, option.value, option.key),
        tenant_slug: readText(option.tenant_slug, initialTenantSlug),
        source: 'public_demo_profile',
      });
      setLauncher(response);
      persistDemoWhatsappProfileSelection({
        key,
        sector: readText(option.sector, initialSector),
        tenantSlug: readText(option.tenant_slug, initialTenantSlug),
      });
      setSelectedOptionKey(key);
      persistSandboxSession(response);
    } catch (err) {
      setError(buildError(err));
    } finally {
      setLoadingOptionKey(null);
    }
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue((current) => (current === value ? null : current)), 1800);
    } catch {
      setCopiedValue(null);
    }
  };

  if (loading && !launcher) {
    return (
      <section className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Cargando sandbox de WhatsApp...</span>
        </div>
      </section>
    );
  }

  if (!launcher && error) {
    return (
      <section
        className="rounded-3xl border border-destructive/25 bg-destructive/10 p-5 text-sm text-destructive"
        role="alert"
      >
        <p className="font-semibold">Sandbox no disponible</p>
        <p className="mt-1">{error.message}</p>
        {error.requestId ? <p className="mt-2 text-xs">request_id: {error.requestId}</p> : null}
      </section>
    );
  }

  if (!launcher?.whatsapp_sandbox) return null;

  return (
    <section
      className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-sm"
      aria-labelledby={headingId}
      aria-busy={loading}
    >
      <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="mb-5 grid gap-3 min-[380px]:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MessageSquareText className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  WhatsApp sandbox
                </p>
              </div>
              <h2 id={headingId} className="mt-3 text-2xl font-black tracking-tight text-foreground">
                Probar por WhatsApp sin login
              </h2>
            </div>
            {maxMessages ? (
              <div className="flex w-fit items-baseline gap-1.5 rounded-2xl border bg-background/70 px-3 py-2 text-left min-[380px]:block min-[380px]:text-right">
                <p className="text-xl font-black leading-none text-foreground min-[380px]:text-2xl">{maxMessages}</p>
                <p className="text-[11px] text-muted-foreground min-[380px]:mt-1">mensajes</p>
              </div>
            ) : null}
          </div>

          {options.length ? (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p id={optionsLabelId} className="text-sm font-semibold text-foreground">
                  Elegí un perfil
                </p>
                {options.length > 1 ? (
                  <p className="text-[11px] text-muted-foreground sm:hidden">Deslizá para ver más</p>
                ) : null}
              </div>
              <div
                ref={optionsContainerRef}
                className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0"
                role="group"
                aria-labelledby={optionsLabelId}
              >
                {options.map((option, index) => {
                  const key = normalizeOptionKey(option, index);
                  const label = optionLabel(option);
                  const description = optionDescription(option);
                  const isSelected = key === selectedKey;
                  const loadingThis = loadingOptionKey === key;
                  if (!label) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={Boolean(option.disabled) || loading || Boolean(loadingOptionKey)}
                      onClick={() => void selectOption(option, index)}
                      aria-pressed={isSelected}
                      aria-busy={loadingThis}
                      data-option-key={key}
                      className={`min-h-24 w-[calc(100%-1.5rem)] max-w-80 shrink-0 snap-start rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:min-h-[112px] sm:w-auto sm:max-w-none sm:hover:-translate-y-0.5 sm:hover:shadow-sm sm:motion-reduce:transform-none ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border/70 bg-background/70 hover:border-primary/40'
                      } ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                        {loadingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                        ) : isSelected ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                        ) : null}
                      </span>
                      {description ? (
                        <span
                          className={`mt-2 block text-xs leading-5 ${
                            isSelected ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {description}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <p>{error.message}</p>
              {error.requestId ? <p className="mt-1 text-xs">request_id: {error.requestId}</p> : null}
            </div>
          ) : null}

          {deeplink ? (
            <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <Button asChild className="w-full shadow-sm">
                <a
                  href={deeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={requiresJoinPhrase ? 'Abrir WhatsApp' : 'Abrir WhatsApp directo'}
                >
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span aria-hidden="true" className="sm:hidden">Abrir WhatsApp</span>
                  <span aria-hidden="true" className="hidden sm:inline">
                    {requiresJoinPhrase ? 'Abrir WhatsApp' : 'Abrir WhatsApp directo'}
                  </span>
                </a>
              </Button>
              <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
                Se abrirá WhatsApp con esta demo lista para probar.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {displayNumber ? (
              <div className="rounded-2xl border bg-background/70 p-4">
                <Smartphone className="mb-3 h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Número</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{displayNumber}</p>
              </div>
            ) : null}
            {requiresJoinPhrase && joinPhrase ? (
              <div className="rounded-2xl border bg-background/70 p-4">
                <Clipboard className="mb-3 h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Frase</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{joinPhrase}</p>
                  <button
                    type="button"
                    className="rounded-lg border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => void copyValue(joinPhrase)}
                  >
                    {copiedValue === joinPhrase ? 'OK' : 'Copiar'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {!requiresJoinPhrase && activationMessage ? (
            <div className="mt-4 rounded-2xl border bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">Mensaje inicial</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{activationMessage}</p>
            </div>
          ) : null}

          {freeInputs.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {freeInputs.map((input) => (
                <span key={input} className="rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                  {input}
                </span>
              ))}
            </div>
          ) : null}

          {displayScripts.length ? (
            <div className="mt-5 rounded-2xl border bg-background/70 p-4">
              <p className="text-sm font-semibold text-foreground">Scripts sugeridos</p>
              <div className="mt-3 grid gap-2">
                {displayScripts.slice(0, 4).map((script, index) => {
                  const title = scriptTitle(script);
                  const body = scriptBody(script);
                  if (!title) return null;
                  return (
                    <div key={readText(script.id, script.key, title) ?? index} className="rounded-xl bg-muted/50 p-3">
                      <p className="text-sm font-medium text-foreground">{title}</p>
                      {body && body !== title ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="border-t border-border/70 bg-muted/25 p-5 lg:border-l lg:border-t-0">
          {qrUrl && !qrFailed ? (
            <div className="hidden rounded-3xl border bg-background/80 p-4 text-center lg:block">
              <QrCode className="mx-auto mb-3 h-5 w-5 text-primary" aria-hidden="true" />
              <img
                src={qrUrl}
                alt="Código QR para abrir la demo de WhatsApp"
                className="mx-auto h-44 w-44 rounded-2xl border bg-white object-contain p-2"
                onError={() => setQrFailed(true)}
              />
            </div>
          ) : null}

          {qrUrl && !qrFailed ? (
            <details className="group rounded-2xl border bg-background/80 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
                <span className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
                  Mostrar código QR
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Opcional</span>
              </summary>
              <div className="border-t p-4 text-center">
                <img
                  src={qrUrl}
                  alt="Código QR para abrir la demo de WhatsApp"
                  className="mx-auto h-44 w-44 rounded-2xl border bg-white object-contain p-2"
                  onError={() => setQrFailed(true)}
                />
              </div>
            </details>
          ) : null}

          {(catalogResources.length || uploadDemo?.enabled) ? (
            <div className="mt-4 rounded-2xl border bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {readText(uploadDemo?.label, uploadDemo?.title) ?? 'Catálogo'}
                </p>
              </div>
              {uploadDemo?.description ? (
                <p className="mb-3 text-xs leading-5 text-muted-foreground">{uploadDemo.description}</p>
              ) : null}
              {catalogResources.map((resource, index) => {
                const label = resourceLabel(resource);
                const href = resourceHref(resource);
                if (!label) return null;
                return href ? (
                  <a
                    key={readText(resource.id, resource.key, label) ?? index}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block rounded-xl border bg-card px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40"
                  >
                    {label}
                  </a>
                ) : (
                  <p
                    key={readText(resource.id, resource.key, label) ?? index}
                    className="mt-2 rounded-xl border bg-card px-3 py-2 text-xs font-medium text-foreground"
                  >
                    {label}
                  </p>
                );
              })}
            </div>
          ) : null}

          {surveysVotings?.enabled ? (
            <div className="mt-4 rounded-2xl border bg-background/70 p-4">
              <p className="text-sm font-semibold text-foreground">
                {readText(surveysVotings.label, surveysVotings.title) ?? 'Encuestas'}
              </p>
              {surveysVotings.description ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{surveysVotings.description}</p>
              ) : null}
              {surveyUrl ? (
                <a
                  href={surveyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
                >
                  Abrir
                </a>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
