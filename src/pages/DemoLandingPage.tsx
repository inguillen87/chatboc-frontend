import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import DemoWorkspace from "@/features/demo/DemoWorkspace";
import { createDemoSession } from "@/features/demo/demoApi";
import type { DemoSector, DemoSessionResponse } from "@/features/demo/demoTypes";
import { ApiError, getErrorMessage } from "@/utils/api";
import { CHATBOC_ORBIT_AVATAR } from "@/utils/brandAssets";
import { clearDemoRuntimeStorage } from "@/features/demo/demoStorage";

type DemoPageError = {
  message: string;
  requestId?: string | null;
};

const readRequestId = (error: unknown): string | null => {
  if (error instanceof ApiError) {
    return error.requestId ?? error.body?.request_id ?? null;
  }
  if (!error || typeof error !== "object") return null;
  const source = error as Record<string, unknown>;
  const value = source.request_id ?? source.requestId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const buildDemoPageError = (error: unknown): DemoPageError => ({
  message: getErrorMessage(error, "No pudimos iniciar esta demo. Intenta nuevamente en unos minutos.").replace(
    /\s*\(Req ID: .*?\)\s*$/,
    "",
  ),
  requestId: readRequestId(error),
});

const normalizeSector = (value?: string | null): DemoSector | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("educ") || normalized.includes("coleg") || normalized.includes("escuela")) {
    return "educacion";
  }
  if (normalized.includes("gob") || normalized.includes("muni") || normalized.includes("public")) {
    return "gobierno";
  }
  if (normalized.includes("empresa") || normalized.includes("pyme") || normalized.includes("comerc")) {
    return "empresas";
  }
  return normalized as DemoSector;
};

const readSessionSector = (session: DemoSessionResponse | null): DemoSector | null => {
  if (!session) return null;
  const payload = session.workspace?.chat_bootstrap?.payload ?? session.chat_bootstrap?.payload ?? {};
  const query = session.workspace?.chat_bootstrap?.query ?? session.chat_bootstrap?.query ?? {};
  const candidates = [
    payload.vertical,
    payload.sector,
    payload.pillar,
    query.vertical,
    query.sector,
    query.pillar,
    session.tenant?.tipo,
    session.tenant_slug,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const sector = normalizeSector(candidate);
    if (sector) return sector;
  }

  return null;
};

const readDemoTitle = (session: DemoSessionResponse | null, slug?: string | null) => {
  const candidates = [
    session?.workspace?.title,
    session?.tenant?.nombre,
    session?.tenant_slug,
    slug,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() ?? "Demo Chatboc";
};

export default function DemoLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<DemoSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DemoPageError | null>(null);

  const sector = useMemo(() => readSessionSector(session), [session]);
  const title = useMemo(() => readDemoTitle(session, slug), [session, slug]);

  useEffect(() => {
    clearDemoRuntimeStorage();
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      if (!slug?.trim()) {
        navigate("/demo", { replace: true });
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await createDemoSession({ tenant_slug: slug.trim() });
        if (cancelled) return;
        setSession(response);
      } catch (err) {
        if (!cancelled) {
          setSession(null);
          setError(buildDemoPageError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [navigate, slug]);

  const retry = () => {
    setSession(null);
    setError(null);
    setLoading(true);
    queueMicrotask(async () => {
      try {
        if (!slug?.trim()) {
          navigate("/demo", { replace: true });
          return;
        }
        const response = await createDemoSession({ tenant_slug: slug.trim() });
        setSession(response);
      } catch (err) {
        setError(buildDemoPageError(err));
      } finally {
        setLoading(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
          <p className="text-base font-semibold">Preparando la demo...</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Estamos abriendo una sesion operativa real para esta experiencia.
          </p>
        </main>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold">No pudimos abrir esta demo</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {error?.message ?? "La experiencia solicitada no esta disponible en este momento."}
          </p>
          {error?.requestId ? (
            <p className="mt-3 text-xs text-muted-foreground">request_id: {error.requestId}</p>
          ) : null}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => navigate("/demo")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ver demos
            </Button>
            <Button onClick={retry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Button variant="ghost" className="px-2" onClick={() => navigate("/demo")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Demos
          </Button>
          <img src={CHATBOC_ORBIT_AVATAR} alt="Chatboc" className="h-10 w-10 rounded-full" />
        </div>

        <section className="mb-8 rounded-[24px] border bg-card/70 p-5 shadow-sm md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Demo operativa</p>
          <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-normal md:text-5xl">
                {title}
              </h1>
              {session.workspace?.welcome_message ? (
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  {session.workspace.welcome_message}
                </p>
              ) : null}
            </div>
            {session.chat_session_id ? (
              <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                sesion activa
              </span>
            ) : null}
          </div>
        </section>

        <DemoWorkspace
          tenantSlug={session.tenant_slug ?? slug ?? null}
          sector={sector}
          rubro={session.tenant?.tipo ?? null}
          workspace={session.workspace ?? null}
        />
      </main>
    </div>
  );
}
