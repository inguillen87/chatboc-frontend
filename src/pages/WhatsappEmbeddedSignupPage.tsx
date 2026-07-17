import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { getErrorMessage } from "@/utils/api";
import { buildTenantPath } from "@/utils/tenantPaths";

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
  origin === "https://www.facebook.com" ||
  origin === "https://web.facebook.com" ||
  origin === "https://www.facebook.net" ||
  origin.endsWith(".facebook.com") ||
  origin.endsWith(".facebook.net");

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
  const navigate = useNavigate();
  const tenant = readQueryValue(searchParams.get("tenant"));
  const appId = readQueryValue(searchParams.get("app_id"));
  const configId = readQueryValue(searchParams.get("config_id"));
  const [sdkReady, setSdkReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Listo para iniciar el registro con Meta.");
  const [result, setResult] = useState<SignupPayload | null>(null);
  const signupDataRef = useRef<SignupPayload>({});
  const completedRef = useRef(false);

  const missingConfig = useMemo(() => {
    const missing: string[] = [];
    if (!tenant) missing.push("tenant");
    if (!appId) missing.push("app_id");
    if (!configId) missing.push("config_id");
    return missing;
  }, [appId, configId, tenant]);

  const completeSignup = useCallback(
    async (partial: SignupPayload) => {
      signupDataRef.current = {
        ...signupDataRef.current,
        ...partial,
      };

      const payload = signupDataRef.current;
      const waitingForAccountIds = !payload.waba_id || !payload.phone_number_id;
      const waitingForCode = !payload.code;
      if (!tenant || completedRef.current || waitingForAccountIds || waitingForCode) {
        if (tenant && !completedRef.current) {
          if (!waitingForAccountIds && waitingForCode) {
            setStatus("Meta envio la cuenta. Esperando codigo de autorizacion...");
          } else if (waitingForAccountIds && !waitingForCode) {
            setStatus("Meta autorizo el registro. Esperando datos de la cuenta de WhatsApp...");
          }
        }
        return;
      }

      completedRef.current = true;
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
        setResult({
          ...payload,
          event: "FINISH",
        });
        setStatus(response?.next_action === "register_whatsapp_sender_via_senders_api"
          ? "Registro guardado. Falta registrar el sender productivo con Twilio."
          : "Registro guardado correctamente.");
      } catch (err) {
        completedRef.current = false;
        setError(getErrorMessage(err, "No se pudo guardar el registro de WhatsApp Business."));
        setStatus("No se guardaron los cambios. Revisa el error e intenta nuevamente.");
      } finally {
        setSaving(false);
      }
    },
    [tenant],
  );

  useEffect(() => {
    if (missingConfig.length) return;
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
  }, [appId, missingConfig.length]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedMetaOrigin(event.origin)) return;
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

      if (message.event === "FINISH") {
        void completeSignup(nextPayload);
        return;
      }

      if (message.event === "CANCEL") {
        setStarting(false);
        setStatus("El registro fue cancelado antes de finalizar.");
        return;
      }

      if (message.event === "ERROR") {
        setStarting(false);
        setError(data.error_message || "Meta informo un error durante el registro.");
        return;
      }

      if (data.current_step) {
        setStatus(`Meta esta procesando: ${data.current_step}`);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [completeSignup]);

  const startSignup = () => {
    if (!window.FB || !configId) return;
    setStarting(true);
    setError(null);
    setStatus("Abriendo registro embebido de Meta...");

    window.FB.login(
      (response) => {
        setStarting(false);
        const code = response.authResponse?.code ?? null;
        if (code) {
          void completeSignup({ code });
          setStatus("Meta autorizo el registro. Esperando datos de la cuenta de WhatsApp...");
          return;
        }
        if (response.status && response.status !== "connected") {
          setStatus("Meta no completo la autorizacion. Podes intentar nuevamente.");
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  };

  const stages = [
    {
      id: "sdk",
      label: "Preparar registro",
      detail: "SDK de Meta cargado y tenant identificado.",
      done: sdkReady && missingConfig.length === 0,
      active: !sdkReady && missingConfig.length === 0,
      icon: KeyRound,
    },
    {
      id: "meta",
      label: "Autorizar con Meta",
      detail: "La organización selecciona su cuenta y número dentro del flujo oficial.",
      done: Boolean(result?.waba_id && result?.phone_number_id),
      active: sdkReady && !result && !saving,
      icon: ShieldCheck,
    },
    {
      id: "chatboc",
      label: "Guardar en Chatboc",
      detail: "Chatboc recibe IDs, habilita sender y deja trazabilidad.",
      done: Boolean(result),
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
    if (result) params.set("action", "register-sender");
    return `${basePath}?${params.toString()}`;
  }, [result, tenant]);
  const waitingForSdk = !sdkReady && missingConfig.length === 0;
  const startDisabled = missingConfig.length > 0 || !sdkReady || starting || saving || Boolean(result);
  const integrationsLabel = result ? "Continuar activacion" : "Volver a integraciones";
  const startLabel = result
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
              <p className="text-sm font-semibold text-foreground">Progreso de autorizacion</p>
              <p className="mt-1 text-xs text-muted-foreground">{completedStages}/{stages.length} pasos completados</p>
            </div>
            <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{status}</span>
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
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.detail}</p>
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
                {result ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                ) : saving || starting ? (
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                )}
                <div>
                  <p className="font-medium">{status}</p>
                  {result ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      WABA {result.waba_id} - Numero {result.phone_number_id}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button className="w-full sm:w-auto" type="button" onClick={startSignup} disabled={startDisabled} aria-busy={starting || saving || undefined}>
                {waitingForSdk || starting || saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {startLabel}
              </Button>
              <Button className="w-full sm:w-auto" type="button" variant={result ? "default" : "outline"} onClick={() => navigate(integrationsPath)}>
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
