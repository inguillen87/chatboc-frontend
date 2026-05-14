import React, { useEffect, useMemo, useState } from 'react';
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
import { persistChatSessionId } from '@/utils/chatSessionId';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

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
  const persisted = persistChatSessionId(session.chat_session_id ?? session.session_id ?? null);
  if (persisted) safeLocalStorage.setItem('chatboc_chat_session_id', persisted);
  if (typeof session.demo_session_id === 'string' && session.demo_session_id.trim()) {
    safeLocalStorage.setItem('chatboc_demo_session_id', session.demo_session_id.trim());
  }
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
  const [error, setError] = useState<LauncherError | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

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
    const selected = options.find((option) => {
      const sectorMatches = initialSector && option.sector && String(option.sector) === String(initialSector);
      const rubroMatches =
        initialRubro &&
        [option.rubro, option.rubro_slug, option.slug, option.value, option.key].some(
          (value) => typeof value === 'string' && value === initialRubro,
        );
      return sectorMatches || rubroMatches;
    });
    return selected ? normalizeOptionKey(selected, options.indexOf(selected)) : null;
  }, [initialRubro, initialSector, options]);

  const selectOption = async (option: DemoWhatsappSandboxOption, index: number) => {
    if (option.disabled) return;
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

  if (loading) {
    return (
      <section className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Cargando sandbox de WhatsApp...</span>
        </div>
      </section>
    );
  }

  if (!launcher && error) {
    return (
      <section className="rounded-3xl border border-destructive/25 bg-destructive/10 p-5 text-sm text-destructive">
        <p className="font-semibold">Sandbox no disponible</p>
        <p className="mt-1">{error.message}</p>
        {error.requestId ? <p className="mt-2 text-xs">request_id: {error.requestId}</p> : null}
      </section>
    );
  }

  if (!launcher?.whatsapp_sandbox) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MessageSquareText className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  WhatsApp sandbox
                </p>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
                Probar por WhatsApp sin login
              </h2>
            </div>
            {maxMessages ? (
              <div className="rounded-2xl border bg-background/70 px-3 py-2 text-right">
                <p className="text-2xl font-black leading-none text-foreground">{maxMessages}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">mensajes</p>
              </div>
            ) : null}
          </div>

          {options.length ? (
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
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
                    disabled={Boolean(option.disabled) || Boolean(loadingOptionKey)}
                    onClick={() => void selectOption(option, index)}
                    className={`min-h-[112px] rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/70 bg-background/70 hover:border-primary/40'
                    } ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      {loadingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : null}
                    </span>
                    {description ? (
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">{description}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
              <p>{error.message}</p>
              {error.requestId ? <p className="mt-1 text-xs">request_id: {error.requestId}</p> : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {displayNumber ? (
              <div className="rounded-2xl border bg-background/70 p-4">
                <Smartphone className="mb-3 h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Numero</p>
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

          {scripts.length ? (
            <div className="mt-5 rounded-2xl border bg-background/70 p-4">
              <p className="text-sm font-semibold text-foreground">Scripts sugeridos</p>
              <div className="mt-3 grid gap-2">
                {scripts.slice(0, 4).map((script, index) => {
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
            <div className="mb-4 rounded-3xl border bg-background/80 p-4 text-center">
              <QrCode className="mx-auto mb-3 h-5 w-5 text-primary" />
              <img
                src={qrUrl}
                alt=""
                className="mx-auto h-44 w-44 rounded-2xl border bg-white object-contain p-2"
                onError={() => setQrFailed(true)}
              />
            </div>
          ) : null}
          {deeplink ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => window.open(deeplink, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {requiresJoinPhrase ? 'Abrir WhatsApp' : 'Abrir WhatsApp directo'}
            </Button>
          ) : null}

          {(catalogResources.length || uploadDemo?.enabled) ? (
            <div className="mt-4 rounded-2xl border bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {readText(uploadDemo?.label, uploadDemo?.title) ?? 'Catalogo'}
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
                    rel="noreferrer"
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
                  rel="noreferrer"
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
