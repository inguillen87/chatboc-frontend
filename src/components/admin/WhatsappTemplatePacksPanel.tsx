import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, getErrorMessage } from "@/utils/api";

type TemplateLifecycle = {
  state?: string;
  production_send_allowed?: boolean;
};

type TemplatePreview = {
  body?: string;
  cta?: { text?: string; url?: string } | null;
};

type TemplatePackItem = {
  intent?: string;
  intent_label?: string;
  name?: string;
  preview?: TemplatePreview | null;
  lifecycle?: TemplateLifecycle;
  blockers?: string[];
  materialized?: boolean;
};

type TemplatePack = {
  vertical: string;
  label?: string;
  pack_id?: string;
  pack_version?: string;
  templates?: TemplatePackItem[];
  summary?: { total?: number; approved?: number; blocked?: number };
};

type TemplatePackCatalog = {
  catalog_version?: string;
  provider_calls_performed?: boolean;
  packs?: TemplatePack[];
  capabilities?: {
    materialize_local_draft?: boolean;
    required_for_mutation?: string;
  };
  endpoints?: {
    materialize_template?: string;
  };
  frontend_contract?: {
    copy?: Record<string, string>;
    lifecycle_labels?: Record<string, string>;
    blocker_labels?: Record<string, string>;
  };
};

type MaterializeResponse = {
  pack?: TemplatePack;
  idempotent_replay?: boolean;
};

const lifecycleTone = (state?: string) => {
  if (state === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "rejected" || state === "stale") return "border-rose-200 bg-rose-50 text-rose-800";
  if (state === "approval_pending" || state === "content_created") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-border/70 bg-muted/40 text-muted-foreground";
};

const newIdempotencyKey = (vertical: string) => {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `template-pack:${vertical}:${random}`;
};

export default function WhatsappTemplatePacksPanel({
  tenantSlug,
}: {
  tenantSlug?: string | null;
  /** Compatibility hint only. The backend capability remains authoritative. */
  canManage?: boolean;
}) {
  const [catalog, setCatalog] = useState<TemplatePackCatalog | null>(null);
  const [catalogScope, setCatalogScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingVertical, setSavingVertical] = useState<string | null>(null);
  const idempotencyKeys = useRef<Record<string, string>>({});
  const loadVersionRef = useRef(0);
  const scopeKey = tenantSlug?.trim().toLowerCase() || "unscoped";
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const scopedCatalog = catalogScope === scopeKey ? catalog : null;

  const load = useCallback(async () => {
    const requestVersion = ++loadVersionRef.current;
    const requestScope = scopeKey;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<TemplatePackCatalog>("/api/admin/whatsapp/template-packs", {
        tenantSlug: tenantSlug || undefined,
      });
      if (loadVersionRef.current !== requestVersion || activeScopeRef.current !== requestScope) return;
      setCatalog(response);
      setCatalogScope(requestScope);
    } catch (requestError) {
      if (loadVersionRef.current !== requestVersion || activeScopeRef.current !== requestScope) return;
      setError(getErrorMessage(requestError, "No se pudieron cargar los packs de WhatsApp."));
    } finally {
      if (loadVersionRef.current === requestVersion && activeScopeRef.current === requestScope) {
        setLoading(false);
      }
    }
  }, [scopeKey, tenantSlug]);

  useEffect(() => {
    idempotencyKeys.current = {};
    setCatalog(null);
    setCatalogScope(null);
    setSavingVertical(null);
    void load();
    return () => {
      loadVersionRef.current += 1;
    };
  }, [load, scopeKey]);

  const materialize = async (pack: TemplatePack) => {
    if (!pack.vertical || !pack.pack_version) return;
    const operationScope = scopeKey;
    const endpointTemplate = scopedCatalog?.endpoints?.materialize_template;
    if (!endpointTemplate) return;
    const endpoint = endpointTemplate.replace("{vertical}", encodeURIComponent(pack.vertical));
    const operationKey = `${operationScope}:${pack.vertical}:${pack.pack_version}`;
    const idempotencyKey =
      idempotencyKeys.current[operationKey] || newIdempotencyKey(pack.vertical);
    idempotencyKeys.current[operationKey] = idempotencyKey;
    setSavingVertical(pack.vertical);
    setError(null);
    try {
      const response = await apiFetch<MaterializeResponse>(endpoint, {
        method: "POST",
        tenantSlug: tenantSlug || undefined,
        headers: { "Idempotency-Key": idempotencyKey },
        body: { pack_version: pack.pack_version },
      });
      if (activeScopeRef.current !== operationScope) return;
      if (response.pack) {
        setCatalog((current) => ({
          ...(current || {}),
          packs: (current?.packs || []).map((item) =>
            item.vertical === response.pack?.vertical ? response.pack : item,
          ),
        }));
      }
      // An acknowledged request is complete. Keep the key only across an
      // ambiguous/failed attempt so an operator retry cannot duplicate work.
      delete idempotencyKeys.current[operationKey];
    } catch (requestError) {
      if (activeScopeRef.current !== operationScope) return;
      setError(getErrorMessage(requestError, "No se pudieron crear los borradores locales."));
    } finally {
      if (activeScopeRef.current === operationScope) setSavingVertical(null);
    }
  };

  const copy = scopedCatalog?.frontend_contract?.copy || {};
  const lifecycleLabels = scopedCatalog?.frontend_contract?.lifecycle_labels || {};
  const blockerLabels = scopedCatalog?.frontend_contract?.blocker_labels || {};
  const packs = Array.isArray(scopedCatalog?.packs) ? scopedCatalog.packs : [];
  const canMaterialize = scopedCatalog?.capabilities?.materialize_local_draft === true;

  return (
    <Card className="border-border/70" data-testid="whatsapp-template-packs">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {copy.title || "Packs de WhatsApp"}
          </CardTitle>
          <CardDescription className="mt-2 max-w-3xl">
            {copy.description || "Plantillas versionadas con estado verificable."}
          </CardDescription>
          {copy.provider_notice ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">{copy.provider_notice}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {scopedCatalog?.catalog_version ? (
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              v{scopedCatalog.catalog_version}
            </span>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}
        {loading && !scopedCatalog ? (
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Cargando packs...
          </div>
        ) : null}
        {!loading && !packs.length ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
            {copy.empty || "No hay packs disponibles."}
          </div>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-3">
          {packs.map((pack) => (
            <section key={pack.pack_id || pack.vertical} className="rounded-2xl border border-border/70 bg-muted/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight">{pack.label || pack.vertical}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pack.pack_id} · v{pack.pack_version}
                  </p>
                </div>
                <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {pack.summary?.total || 0} templates
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {(pack.templates || []).map((template) => {
                  const state = template.lifecycle?.state || "local_draft";
                  const verifiedApproved =
                    state === "approved" && template.lifecycle?.production_send_allowed === true;
                  const displayState = verifiedApproved
                    ? "approved"
                    : state === "approved" || !state
                      ? "unverified"
                      : state;
                  return (
                    <article key={template.name || template.intent} className="rounded-xl border border-border/60 bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-black">{template.intent_label || template.intent}</div>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${lifecycleTone(displayState)}`}>
                          {lifecycleLabels[displayState] || displayState}
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-5 text-foreground">{template.preview?.body}</div>
                      {template.preview?.cta?.text ? (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                          <span className="font-bold">{template.preview.cta.text}</span>
                          {template.preview.cta.url ? (
                            <span className="mt-1 block break-all text-muted-foreground">{template.preview.cta.url}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {(template.blockers || []).length ? (
                        <ul className="mt-2 space-y-1 text-xs text-amber-800">
                          {(template.blockers || []).map((blocker) => (
                            <li key={blocker} className="flex gap-1.5">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{blockerLabels[blocker] || blocker}</span>
                            </li>
                          ))}
                        </ul>
                      ) : verifiedApproved ? (
                        <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {lifecycleLabels.approved || "Aprobada"}
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-700">
                          <AlertTriangle className="h-3 w-3" />
                          {lifecycleLabels.unverified || "Sin verificacion"}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {canMaterialize ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  disabled={
                    savingVertical === pack.vertical
                    || (pack.templates || []).every((template) => template.materialized)
                  }
                  onClick={() => void materialize(pack)}
                >
                  {savingVertical === pack.vertical ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {(pack.templates || []).every((template) => template.materialized)
                    ? copy.materialized || copy.materialize
                    : copy.materialize}
                </Button>
              ) : null}
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
