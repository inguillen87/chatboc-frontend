import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  MessageSquareText,
  SendHorizontal,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { tenantService } from "@/services/tenantService";
import { cn } from "@/lib/utils";
import { ApiError, getErrorMessage } from "@/utils/api";
import { buildTenantPath, readCanonicalTenantSlugFromPath } from "@/utils/tenantPaths";
import { useUser } from "@/hooks/useUser";
import { hasDirectSignupLabels, useDirectWhatsappSignup, type DirectSignupLabels } from "./useDirectWhatsappSignup";

type FacebookAuthResponse = {
  code?: string;
};

type FacebookLoginResponse = {
  authResponse?: FacebookAuthResponse | null;
  status?: string;
};

type FacebookSdk = {
  init: (options: Record<string, unknown>) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: Record<string, unknown>,
  ) => void;
};

type SignupPayload = {
  event?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  business_id?: string | null;
  session_id?: string | null;
  code?: string | null;
};

const isOnlyWabaCompletion = (event: SignupPayload["event"]) =>
  event === "FINISH_ONLY_WABA";

type MetaSignupMessage = {
  type?: string;
  event?: string;
  data?: {
    waba_id?: string;
    wabaId?: string;
    phone_number_id?: string;
    phoneNumberId?: string;
    business_id?: string;
    businessId?: string;
    session_id?: string;
    sessionId?: string;
    error_message?: string;
    current_step?: string;
  };
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let facebookSdkPromise: Promise<void> | null = null;

const readQueryValue = (value: string | null) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
};

const parseMetaSignupMessage = (raw: unknown): MetaSignupMessage | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw as MetaSignupMessage;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as MetaSignupMessage;
  } catch {
    return null;
  }
};

const isTrustedMetaOrigin = (origin: string) =>
  origin.startsWith("https://") && (origin.endsWith(".facebook.com") || origin.endsWith(".facebook.net"));

const loadFacebookSdk = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("El navegador no esta disponible."));
  }
  if (window.FB) return Promise.resolve();
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("facebook-jssdk");
    const previousInit = window.fbAsyncInit;

    window.fbAsyncInit = () => {
      previousInit?.();
      resolve();
    };

    if (existing) {
      const waitForExistingSdk = () => {
        if (window.FB) {
          resolve();
          return;
        }
        window.setTimeout(waitForExistingSdk, 50);
      };
      waitForExistingSdk();
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/es_LA/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      facebookSdkPromise = null;
      reject(new Error("No se pudo cargar el SDK de Meta."));
    };
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
};

export default function WhatsappEmbeddedSignupPage() {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const routeTenant = readCanonicalTenantSlugFromPath(pathname);
  const queryTenant = readQueryValue(searchParams.get("tenant"));
  const tenant = routeTenant && queryTenant && routeTenant !== queryTenant ? null : routeTenant || queryTenant;
  const appId = readQueryValue(searchParams.get("app_id"));
  const configId = readQueryValue(searchParams.get("config_id"));
  const { user, organizationProfileVerified } = useUser();
  const actorId = organizationProfileVerified ? user?.id ?? null : null;
  const [popupOwner, setPopupOwner] = useState<symbol | null>(null);
  return <SignupForm key={JSON.stringify([pathname, tenant, appId, configId, actorId])}
    tenant={tenant} appId={appId} configId={configId} actorId={actorId} popupOwner={popupOwner} setPopupOwner={setPopupOwner} />;
}

function SignupForm({ tenant, appId, configId, actorId, popupOwner, setPopupOwner }: {
  tenant: string | null; appId: string | null; configId: string | null;
  actorId: number | null;
  popupOwner: symbol | null; setPopupOwner: (owner: symbol | null) => void;
}) {
  const navigate = useNavigate();
  const [formId] = useState(() => Symbol());
  const mounted = useRef(false);
  const attempt = useRef<symbol | null>(null);
  // The SDK's global messages carry no Chatboc tenant. Isolate a new
  // registration if another form still has an outstanding popup in this tab.
  const needsNewTab = popupOwner !== null && popupOwner !== formId;
  const [sdkReady, setSdkReady] = useState(false);
  const actionButton = useRef<HTMLButtonElement>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const restoreActionFocus = useRef(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Listo para iniciar el registro con Meta.");
  const [result, setResult] = useState<{
    event: SignupPayload["event"];
    waba_id: SignupPayload["waba_id"];
    phone_number_id: SignupPayload["phone_number_id"];
    registerSender: boolean;
  } | null>(null);
  const [needsStatusCheck, setNeedsStatusCheck] = useState(false);
  const signupDataRef = useRef<SignupPayload>({});
  const completedRef = useRef(false);
  const [mode, setMode] = useState<"legacy" | "direct" | null>(null);
  const [directLabels, setDirectLabels] = useState<DirectSignupLabels | null>(null);
  const storageKey = tenant && actorId && appId && configId
    ? `chatboc.metaSignup.v1.${JSON.stringify([tenant, actorId, appId, configId])}` : null;
  const direct = useDirectWhatsappSignup(tenant, storageKey, mounted);
  const { submit: submitDirect, reset: resetDirect } = direct;
  const sessionExpiry = direct.expiresAt;

  useEffect(() => {
    if (mode !== "direct" || !starting) return;
    const popup = attempt.current;
    const timer = window.setTimeout(() => {
      if (!popup || attempt.current !== popup) return;
      attempt.current = null;
      signupDataRef.current = {};
      setStarting(false);
      // The old popup can still send unscoped events. Start the next attempt in a new tab.
      setPopupOwner(Symbol());
      resetDirect("new_authorization");
    }, Math.max(0, sessionExpiry.current - Date.now()));
    return () => window.clearTimeout(timer);
  }, [mode, starting, sessionExpiry, setPopupOwner, resetDirect]);

  useEffect(() => {
    if (!tenant || !appId || !configId) return;
    let active = true;
    tenantService.getWhatsappTechProvider(tenant).then(contract => {
      if (!active) return;
      if (contract?.contract_version !== "twilio.tech_provider.v1" || contract.tenant?.slug !== tenant) {
        throw new Error("invalid_contract");
      }
      if (contract.direct_embedded_signup === undefined) {
        setMode("legacy");
        return;
      }
      const capability = contract.direct_embedded_signup;
      if (!storageKey || capability?.enabled !== true || capability.app_id !== appId || capability.configuration_id !== configId ||
          !hasDirectSignupLabels(capability.labels)) {
        throw new Error("invalid_direct_config");
      }
      setDirectLabels(capability.labels);
      setMode("direct");
    }).catch(() => {
      if (active) setError("No pudimos preparar el registro con Meta.");
    });
    return () => { active = false; };
  }, [tenant, appId, configId, storageKey]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attempt.current = null;
      signupDataRef.current = {};
    };
  }, []);

  const missingConfig = useMemo(() => {
    const missing: string[] = [];
    if (!tenant) missing.push("tenant");
    if (!appId) missing.push("app_id");
    if (!configId) missing.push("config_id");
    return missing;
  }, [appId, configId, tenant]);

  const completeSignup = useCallback(
    async (partial: SignupPayload) => {
      if (!tenant || !mounted.current || !attempt.current || completedRef.current) return;
      signupDataRef.current = {
        ...signupDataRef.current,
        ...partial,
      };

      const payload = signupDataRef.current;
      if (mode === "direct" && partial.event && (
        partial.event !== "FINISH" || !payload.waba_id || !payload.phone_number_id
      )) {
        attempt.current = null;
        signupDataRef.current = {};
        setPopupOwner(null);
        setStarting(false);
        resetDirect("choose_phone");
        return;
      }
      const waitingForAccountIds =
        !payload.waba_id || (!isOnlyWabaCompletion(payload.event) && !payload.phone_number_id);
      const waitingForCode = !payload.code;
      if (waitingForAccountIds || waitingForCode) {
        if (!waitingForAccountIds && waitingForCode) {
          setStatus("Meta envio la cuenta. Esperando codigo de autorizacion...");
        } else if (waitingForAccountIds && !waitingForCode) {
          setStatus("Meta autorizo el registro. Esperando datos de la cuenta de WhatsApp...");
        }
        return;
      }

      if (mode === "direct" && payload.code && payload.phone_number_id && payload.waba_id) {
        attempt.current = null;
        signupDataRef.current = {};
        setPopupOwner(null);
        setStarting(false);
        await submitDirect({ code: payload.code, phone_number_id: payload.phone_number_id, waba_id: payload.waba_id,
          session_id: payload.session_id, business_id: payload.business_id, event: payload.event ?? "FINISH" });
        return;
      }

      completedRef.current = true;
      attempt.current = null;
      setPopupOwner(null);
      setStarting(false);
      setSaving(true);
      setError(null);
      setStatus("Guardando cuenta de WhatsApp Business en Chatboc...");
      try {
        const response = await tenantService.completeWhatsappEmbeddedSignup(tenant, {
          waba_id: payload.waba_id,
          phone_number_id: payload.phone_number_id,
          session_id: payload.session_id,
          code: payload.code,
          event: payload.event ?? "FINISH",
          business_id: payload.business_id,
        });
        if (!mounted.current) return;
        if (response?.ok !== true || response.status !== "accepted" || response.persisted !== true || response.tenant?.slug !== tenant) {
          throw new Error("El servidor no confirmó el registro de esta organización.");
        }
        const registerSender = response.next_action === "register_whatsapp_sender_via_senders_api";
        setResult({ event: payload.event, waba_id: payload.waba_id, phone_number_id: payload.phone_number_id, registerSender });
        setStatus(registerSender
          ? "Registro guardado. Falta habilitar el número para enviar y recibir mensajes."
          : "Registro guardado. Consultá el estado del número en Integraciones.");
      } catch (err) {
        if (!mounted.current) return;
        const rejected = err instanceof ApiError && err.status === 422 ? err.body : null;
        const mayCorrect = rejected?.contract_version === "twilio.tech_provider.embedded_signup.v1" &&
          rejected.ok === false && rejected.status === "rejected" && rejected.tenant?.slug === tenant &&
          rejected.persisted === false && rejected.state_unchanged === true &&
          rejected.provider_calls_performed === false && rejected.retryable_after_correction === true;
        completedRef.current = !mayCorrect;
        setNeedsStatusCheck(!mayCorrect);
        setError(getErrorMessage(err, "No se pudo guardar el registro de WhatsApp Business."));
        setStatus(mayCorrect ? "Revisá los datos e iniciá el registro nuevamente." :
          "No pudimos confirmar el resultado. Vuelve a integraciones y actualiza el estado antes de intentarlo nuevamente.");
      } finally {
        signupDataRef.current = {};
        if (mounted.current) setSaving(false);
      }
    },
    [tenant, mode, setPopupOwner, submitDirect, resetDirect],
  );

  const needsSdk = mode === "legacy" || (mode === "direct" && direct.phase !== "resume" && direct.phase !== "connected");
  useEffect(() => {
    if (missingConfig.length || !needsSdk) return;
    let mounted = true;
    loadFacebookSdk()
      .then(() => {
        if (!mounted) return;
        window.FB?.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: "v25.0",
        });
        setSdkReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getErrorMessage(err, "No se pudo cargar el SDK de Meta."));
        setStatus("No pudimos preparar el registro con Meta.");
      });
    return () => {
      mounted = false;
    };
  }, [appId, missingConfig.length, needsSdk]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!mounted.current || !attempt.current || !isTrustedMetaOrigin(event.origin)) return;
      const message = parseMetaSignupMessage(event.data);
      if (!message || message.type !== "WA_EMBEDDED_SIGNUP") return;

      const data = message.data ?? {};
      const nextPayload: SignupPayload = {
        event: message.event ?? null,
        waba_id: data.waba_id ?? data.wabaId ?? null,
        phone_number_id: data.phone_number_id ?? data.phoneNumberId ?? null,
        business_id: data.business_id ?? data.businessId ?? null,
        session_id: data.session_id ?? data.sessionId ?? null,
      };

      if (message.event === "FINISH" || message.event === "FINISH_ONLY_WABA" ||
          (mode === "direct" && typeof message.event === "string" && message.event.startsWith("FINISH_"))) {
        void completeSignup(nextPayload);
        return;
      }

      if (message.event === "CANCEL") {
        attempt.current = null;
        signupDataRef.current = {};
        setPopupOwner(null);
        setStarting(false);
        setStatus("El registro fue cancelado antes de finalizar.");
        if (mode === "direct") resetDirect("cancelled");
        return;
      }

      if (message.event === "ERROR") {
        attempt.current = null;
        signupDataRef.current = {};
        setPopupOwner(null);
        setStarting(false);
        if (mode === "direct") resetDirect("provider_error");
        else setError(data.error_message || "Meta informo un error durante el registro.");
        return;
      }

      if (data.current_step) {
        setStatus(`Meta esta procesando: ${data.current_step}`);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [completeSignup, setPopupOwner, mode, resetDirect]);

  const startSignup = () => {
    if (!mode || needsNewTab || attempt.current || completedRef.current) return;
    if (mode === "direct") {
      if (direct.busy || direct.phase === "connected") return;
      restoreActionFocus.current = document.activeElement === actionButton.current;
      if (direct.phase === "resume") { void direct.submit(); return; }
      if (direct.phase === "ready" || Date.now() >= direct.expiresAt.current) { void direct.prepare(); return; }
    }
    if (!window.FB || !configId) return;
    const currentAttempt = Symbol();
    attempt.current = currentAttempt;
    setPopupOwner(formId);
    setStarting(true);
    setError(null);
    setStatus("Abriendo registro embebido de Meta...");

    window.FB.login(
      (response) => {
        if (!mounted.current || attempt.current !== currentAttempt) return;
        const code = response.authResponse?.code ?? null;
        if (code) {
          void completeSignup({ code });
          return;
        }
        attempt.current = null;
        signupDataRef.current = {};
        setPopupOwner(null);
        setStarting(false);
        setStatus("Meta no completo la autorizacion. Podes intentar nuevamente.");
        if (mode === "direct") resetDirect("not_authorized");
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: mode === "direct" ? { setup: {} } : {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  };

  const isDirect = mode === "direct";
  const directConnected = isDirect && direct.phase === "connected";
  const displayStatus = isDirect && !starting && direct.message ? directLabels?.[direct.message] : status;
  const stages = [
    {
      id: "sdk",
      label: "Preparar registro",
      detail: "SDK de Meta cargado y tenant identificado.",
      done: directConnected || (sdkReady && missingConfig.length === 0),
      active: needsSdk && !sdkReady && missingConfig.length === 0,
      icon: KeyRound,
    },
    {
      id: "meta",
      label: "Autorizar con Meta",
      detail: "La organización selecciona su cuenta y número dentro del flujo oficial.",
      done: directConnected || Boolean(
        result?.waba_id &&
          (isOnlyWabaCompletion(result.event) || result.phone_number_id),
      ),
      active: sdkReady && !result && !saving,
      icon: ShieldCheck,
    },
    {
      id: "chatboc",
      label: "Guardar en Chatboc",
      detail: "Guarda los datos del registro de la cuenta. La activación del número se consulta en Integraciones.",
      done: directConnected || Boolean(result),
      active: saving,
      icon: SendHorizontal,
    },
  ];
  const completedStages = stages.filter((stage) => stage.done).length;
  const progress = Math.round((completedStages / stages.length) * 100);
  const integrationsPath = useMemo(() => {
    const basePath = tenant ? buildTenantPath("/integracion", tenant) : "/integracion";
    const params = new URLSearchParams({
      channel: "whatsapp",
    });
    if (result?.registerSender) params.set("action", "register-sender");
    return `${basePath}?${params.toString()}`;
  }, [result, tenant]);
  const waitingForSdk = needsSdk && !sdkReady && missingConfig.length === 0;
  const startDisabled = missingConfig.length > 0 || !mode || (!sdkReady && !(isDirect && direct.phase === "resume")) ||
    starting || saving || needsStatusCheck || Boolean(result) || (isDirect && (direct.busy || directConnected));
  useLayoutEffect(() => {
    if (!restoreActionFocus.current || (startDisabled && !directConnected)) return;
    restoreActionFocus.current = false;
    if (document.activeElement === document.body || document.activeElement === actionButton.current) {
      (directConnected ? returnButton.current : actionButton.current)?.focus();
    }
  }, [directConnected, startDisabled]);
  const integrationsLabel = result?.registerSender ? "Continuar activación" : "Volver a integraciones";
  const startLabel = directConnected ? directLabels?.done
    : isDirect && direct.phase === "resume" ? directLabels?.resume
    : isDirect && direct.phase === "ready" ? directLabels?.prepare
    : result
    ? "Registro guardado"
    : missingConfig.length > 0
      ? "Parametros incompletos"
      : "Iniciar registro con Meta";

  return (
    <main aria-labelledby="whatsapp-signup-title" className="min-h-screen bg-background px-4 py-6 text-foreground sm:py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Chatboc Connect</p>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Meta Tech Provider
                </span>
              </div>
              <h1 id="whatsapp-signup-title" className="mt-1 text-2xl font-semibold">Autorizar WhatsApp Business</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Conecta la cuenta de la organizacion desde Meta. Chatboc guarda la autorizacion y te devuelve al siguiente paso de activacion.
              </p>
            </div>
          </div>
          <div className="rounded-xl border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Flujo oficial</p>
            <p>Meta Embedded Signup</p>
          </div>
        </header>

        <div className="rounded-2xl border bg-card/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Progreso de autorización</p>
              <p className="mt-1 text-xs text-muted-foreground">{completedStages}/{stages.length} pasos completados</p>
            </div>
            <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{displayStatus}</span>
            </div>
          </div>
          <Progress value={progress} aria-label={`Autorizacion de WhatsApp: ${progress}% completado`} className="mt-3 h-2" />
          <ol aria-label="Pasos del registro con Meta" className="mt-4 grid gap-2 md:grid-cols-3">
            {stages.map((stage) => (
              <li
                key={stage.id}
                aria-current={stage.active ? "step" : undefined}
                className={cn(
                  "rounded-xl border bg-background/70 p-3",
                  stage.done
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : stage.active
                      ? "border-primary/45 bg-primary/10"
                      : "border-border/80",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      stage.done
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-600"
                        : stage.active
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground",
                    )}
                  >
                    {stage.done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : React.createElement(stage.icon, { className: "h-4 w-4", "aria-hidden": true })}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      <span className="sr-only">{stage.done ? "Completado" : stage.active ? "Paso actual" : "Pendiente"}: </span>
                      {stage.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-foreground/80">{stage.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {missingConfig.length ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Faltan parametros de inicio</AlertTitle>
            <AlertDescription>
              La plataforma no envio todos los datos necesarios. Volve a integraciones e inicia el registro nuevamente.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No se pudo completar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Registro seguro con Meta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Tenant</p>
                <p className="mt-1 font-medium">{tenant ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Meta App</p>
                <p className="mt-1 font-medium">{appId ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Config</p>
                <p className="mt-1 font-medium">{configId ?? "-"}</p>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                {result || directConnected ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                ) : saving || starting ? (
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                )}
                <div>
                  <p className="font-medium">{displayStatus}</p>
                  {result ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      WABA {result.waba_id}
                      {result.phone_number_id
                        ? ` - Número ${result.phone_number_id}`
                        : " - Número pendiente de registro"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {needsNewTab && tenant && appId && configId ? <Button asChild className="w-full sm:w-auto">
                <a href={`/integracion/whatsapp/connect?${new URLSearchParams({ tenant, app_id: appId, config_id: configId })}`}
                  target="_blank" rel="noopener noreferrer">Iniciar registro en otra pestaña</a>
              </Button> : <Button ref={actionButton} className="w-full sm:w-auto" type="button" onClick={startSignup} disabled={startDisabled} aria-busy={starting || saving || direct.busy || undefined}>
                {waitingForSdk || starting || saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {startLabel}
              </Button>}
              <Button ref={returnButton} className="w-full sm:w-auto" type="button" variant={result ? "default" : "outline"} onClick={() => navigate(integrationsPath)}>
                {result ? <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" /> : null}
                {integrationsLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
