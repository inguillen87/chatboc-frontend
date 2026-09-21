import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWhatsappTemplatePacks } from "@/hooks/useWhatsappTemplatePacks";
import { displayedTemplateState, normalizeTemplateScope, type TemplatePack } from "./whatsappTemplatePackContract";
import { readTemplateWorkspaceUI } from './templateWorkspaceUI';
import WhatsappTemplateWorkspace from './WhatsappTemplateWorkspace';

const lifecycleTone = (state?: string) => {
  if (state === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
  if (state === "rejected" || state === "stale") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  if (state === "approval_pending" || state === "content_created") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  }
  return "border-border/70 bg-muted/40 text-muted-foreground";
};

function TemplatePacksWorkspace({ scope }: { scope: string }) {
  const workspace = useWhatsappTemplatePacks(scope);
  const { catalog: scopedCatalog, loading, error, notice, savingVertical,
    refresh: load, materialize, canMaterialize } = workspace;
  const [selectedVertical, setSelectedVertical] = useState('');
  const [filter, setFilter] = useState('all');
  const copy = scopedCatalog?.frontend_contract?.copy || {};
  const lifecycleLabels = scopedCatalog?.frontend_contract?.lifecycle_labels || {};
  const blockerLabels = scopedCatalog?.frontend_contract?.blocker_labels || {};
  const packs: TemplatePack[] = scopedCatalog?.packs || [];
  const selectedPack = packs.find((pack) => pack.vertical === selectedVertical) || packs[0];
  const states = Array.from(new Set<string>((selectedPack?.templates || []).map(displayedTemplateState)));
  const selectedFilter = states.includes(filter) ? filter : 'all';
  if (!scope) return <Card data-testid="whatsapp-template-packs"><CardContent className="p-5">Elegí una organización autorizada para revisar sus plantillas.</CardContent></Card>;
  const workspaceUI = readTemplateWorkspaceUI(scopedCatalog?.frontend_contract?.workspace_ui);
  if (scopedCatalog && workspaceUI) return <WhatsappTemplateWorkspace key={String(scopedCatalog.tenant.id)}
    catalog={scopedCatalog} ui={workspaceUI} state={workspace} />;
  // Compatibility for a server that does not yet publish the additive workspace contract.
  // A malformed published contract is rejected by readTemplateCatalog, not downgraded here.

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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {scopedCatalog?.catalog_version ? (
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              v{scopedCatalog.catalog_version}
            </span>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || Boolean(savingVertical)}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">{notice}</p> : null}
        {error && scopedCatalog ? <p className="text-sm text-muted-foreground">Vista anterior: no se pueden crear borradores hasta volver a verificar el estado.</p> : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}
        {loading && !scopedCatalog ? (
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin motion-reduce:animate-none" />
            Cargando packs...
          </div>
        ) : null}
        {!loading && !error && !packs.length ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
            {copy.empty || "No hay packs disponibles."}
          </div>
        ) : null}
        {packs.length ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Conjunto de plantillas
            <select value={selectedPack?.vertical || ''} onChange={(event) => { setSelectedVertical(event.target.value); setFilter('all'); }} disabled={Boolean(savingVertical)} className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground">
              {packs.map((pack) => <option key={pack.vertical} value={pack.vertical}>{pack.label || pack.vertical}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Estado de plantilla
            <select value={selectedFilter} onChange={(event) => setFilter(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground">
              <option value="all">Todos los estados</option>
              {states.map((state) => <option key={state} value={state}>{lifecycleLabels[state] || state}</option>)}
            </select>
          </label>
        </div> : null}
        <div className="min-w-0">
          {(selectedPack ? [selectedPack] : []).map((pack) => (
            <section key={pack.pack_id || pack.vertical} className="rounded-2xl border border-border/70 bg-muted/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="break-words text-lg font-bold tracking-tight">{pack.label || pack.vertical}</h3>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {pack.pack_id} · v{pack.pack_version}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {pack.templates.length} plantillas
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {pack.templates.filter((template) => selectedFilter === "all" || displayedTemplateState(template) === selectedFilter).map((template) => {
                  const displayState = displayedTemplateState(template);
                  const verifiedApproved = displayState === 'approved';
                  return (
                    <article key={template.name || template.intent} className="min-w-0 break-words rounded-xl border border-border/60 bg-background p-4">
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
                        <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
                          {(template.blockers || []).map((blocker) => (
                            <li key={blocker} className="flex gap-1.5">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span>{blockerLabels[blocker] || blocker}</span>
                            </li>
                          ))}
                        </ul>
                      ) : verifiedApproved ? (
                        <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          {lifecycleLabels.approved || "Aprobada"}
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          {lifecycleLabels.unverified || "Sin verificacion"}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {scopedCatalog?.capabilities?.materialize_local_draft === true ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 min-h-11 w-full"
                  disabled={
                    !canMaterialize
                    || (pack.templates || []).every((template) => template.materialized)
                  }
                  onClick={() => void materialize(pack)}
                >
                  {savingVertical === pack.vertical ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
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

// Remount on organization changes, including A -> B -> A: old requests cannot
// repopulate a new view even when the same slug is selected again.
export default function WhatsappTemplatePacksPanel({ tenantSlug }: {
  tenantSlug?: string | null; canManage?: boolean;
}) {
  const scope = normalizeTemplateScope(tenantSlug);
  return <TemplatePacksWorkspace key={scope || 'missing-organization'} scope={scope} />;
}
