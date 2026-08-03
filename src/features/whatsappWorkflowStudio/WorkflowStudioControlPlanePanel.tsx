import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileJson2,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

import {
  WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK,
  createWhatsappWorkflowIdempotencyKey,
  getWhatsappWorkflowLedger,
  listWhatsappWorkflowLedgers,
  parseWhatsappWorkflowDraftJson,
  publishWhatsappWorkflow,
  reconcileWhatsappWorkflowDurableScope,
  reviewWhatsappWorkflow,
  rollbackWhatsappWorkflow,
  saveWhatsappWorkflowDraft,
  type WhatsappWorkflowLedger,
  type WhatsappWorkflowLedgerList,
  type WhatsappWorkflowReview,
} from "@/api/v2/whatsappWorkflowStudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/utils/api";

const NEW_WORKFLOW_VALUE = "__new_workflow__";

const DEFAULT_DRAFT = JSON.stringify(
  {
    schema_version: "whatsapp.workflow_draft.v1",
  },
  null,
  2,
);

type MutationKind = "draft" | "review" | "publish" | "rollback";

const shortId = (value: string | null | undefined) =>
  value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";

const formatDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

const selectClasses =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const readContractText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h4 className="text-sm font-bold text-foreground">{children}</h4>
);

export interface WorkflowStudioControlPlanePanelProps {
  contract: unknown;
  expectedTenantSlug: string | null | undefined;
}

export default function WorkflowStudioControlPlanePanel({
  contract,
  expectedTenantSlug,
}: WorkflowStudioControlPlanePanelProps) {
  const durableContract = useMemo(
    () => reconcileWhatsappWorkflowDurableScope(contract, expectedTenantSlug),
    [contract, expectedTenantSlug],
  );
  const tenantSlug = durableContract?.tenant.slug ?? "";
  const scopeKey = durableContract ? `${durableContract.tenant.id}:${tenantSlug}` : "disabled";
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const requestEpochRef = useRef(0);
  const lastScopeKeyRef = useRef(scopeKey);
  const scopeGenerationRef = useRef(0);
  if (lastScopeKeyRef.current !== scopeKey) {
    lastScopeKeyRef.current = scopeKey;
    scopeGenerationRef.current += 1;
  }
  const [listing, setListing] = useState<WhatsappWorkflowLedgerList | null>(null);
  const [ledger, setLedger] = useState<WhatsappWorkflowLedger | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(NEW_WORKFLOW_VALUE);
  const [draftJson, setDraftJson] = useState(DEFAULT_DRAFT);
  const [reviewOperation, setReviewOperation] = useState<"publish" | "rollback">("publish");
  const [reviewSubjectId, setReviewSubjectId] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote] = useState("");
  const [publicationReviewId, setPublicationReviewId] = useState("");
  const [rollbackTargetId, setRollbackTargetId] = useState("");
  const [rollbackReviewId, setRollbackReviewId] = useState("");
  const [acknowledgement, setAcknowledgement] = useState("");
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState<MutationKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mutationKeys = useRef<Partial<Record<MutationKind, string>>>({});

  const keyFor = (kind: MutationKind) => {
    const existing = mutationKeys.current[kind];
    if (existing) return existing;
    const created = createWhatsappWorkflowIdempotencyKey();
    mutationKeys.current[kind] = created;
    return created;
  };

  const resetKey = (kind: MutationKind) => {
    delete mutationKeys.current[kind];
  };

  const clearMutationFeedback = (kind: MutationKind) => {
    resetKey(kind);
    setError(null);
    setNotice(null);
  };

  const loadLedger = async (workflowId: string, requestEpoch: number) => {
    if (!durableContract || !workflowId || workflowId === NEW_WORKFLOW_VALUE) {
      setLedger(null);
      return null;
    }
    const requestedScope = scopeKey;
    const nextLedger = await getWhatsappWorkflowLedger(
      durableContract,
      tenantSlug,
      workflowId,
    );
    if (
      activeScopeRef.current !== requestedScope ||
      requestEpochRef.current !== requestEpoch
    ) {
      return null;
    }
    setLedger(nextLedger);
    setDraftJson(JSON.stringify(nextLedger.latest_draft_revision.draft, null, 2));
    return nextLedger;
  };

  const refresh = async (preferredWorkflowId?: string, existingEpoch?: number) => {
    if (!durableContract) return;
    const requestEpoch = existingEpoch ?? ++requestEpochRef.current;
    const requestedScope = scopeKey;
    setLoading(true);
    setError(null);
    try {
      const nextListing = await listWhatsappWorkflowLedgers(durableContract, tenantSlug);
      if (
        activeScopeRef.current !== requestedScope ||
        requestEpochRef.current !== requestEpoch
      ) {
        return;
      }
      setListing(nextListing);
      const workflowId = preferredWorkflowId ?? selectedWorkflowId;
      if (
        workflowId !== NEW_WORKFLOW_VALUE &&
        nextListing.workflows.some((workflow) => workflow.workflow_id === workflowId)
      ) {
        await loadLedger(workflowId, requestEpoch);
      } else if (workflowId !== NEW_WORKFLOW_VALUE) {
        setSelectedWorkflowId(NEW_WORKFLOW_VALUE);
        setLedger(null);
        setDraftJson(DEFAULT_DRAFT);
      }
    } catch (cause) {
      if (
        activeScopeRef.current !== requestedScope ||
        requestEpochRef.current !== requestEpoch
      ) {
        return;
      }
      setListing(null);
      setLedger(null);
      setError(getErrorMessage(cause, "No se pudo verificar el ledger durable."));
    } finally {
      if (
        activeScopeRef.current === requestedScope &&
        requestEpochRef.current === requestEpoch
      ) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const requestEpoch = ++requestEpochRef.current;
    mutationKeys.current = {};
    setError(null);
    setNotice(null);
    setAcknowledgement("");
    setReviewOperation("publish");
    setReviewSubjectId("");
    setReviewDecision("approved");
    setReviewNote("");
    setPublicationReviewId("");
    setRollbackTargetId("");
    setRollbackReviewId("");
    setMutating(null);
    if (!durableContract) {
      setListing(null);
      setLedger(null);
      setSelectedWorkflowId(NEW_WORKFLOW_VALUE);
      setDraftJson(DEFAULT_DRAFT);
      setLoading(false);
      return;
    }
    setListing(null);
    setLedger(null);
    setSelectedWorkflowId(NEW_WORKFLOW_VALUE);
    setDraftJson(DEFAULT_DRAFT);
    void refresh(NEW_WORKFLOW_VALUE, requestEpoch);
    // The reconciled scope key is the capability boundary. A same-scope parent
    // rerender must not erase an in-flight operation or its idempotency key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const reviewSubjects = useMemo(() => {
    if (!ledger) return [];
    return reviewOperation === "publish"
      ? [
          {
            id: ledger.latest_draft_revision.draft_revision_id,
            label: `Borrador r${ledger.latest_draft_revision.revision} · ${shortId(
              ledger.latest_draft_revision.draft_revision_id,
            )}`,
          },
        ]
      : ledger.published_versions.map((version) => ({
          id: version.version_id,
          label: `Versión ${version.version} · ${version.version_kind} · ${shortId(version.version_id)}`,
        }));
  }, [ledger, reviewOperation]);

  useEffect(() => {
    const firstSubject = reviewSubjects[0]?.id ?? "";
    if (!reviewSubjects.some((subject) => subject.id === reviewSubjectId)) {
      setReviewSubjectId(firstSubject);
      resetKey("review");
    }
  }, [reviewSubjectId, reviewSubjects]);

  const approvedReviews = useMemo(() => {
    if (!ledger) return [];
    const latestBySubject = new Map<string, WhatsappWorkflowReview>();
    ledger.reviews.forEach((review) => {
      const key = `${review.operation}:${review.subject_id}:${review.subject_digest}`;
      const current = latestBySubject.get(key);
      if (!current || review.subject_sequence > current.subject_sequence) {
        latestBySubject.set(key, review);
      }
    });
    return Array.from(latestBySubject.values()).filter((review) => review.decision === "approved");
  }, [ledger]);

  const publishReviews = useMemo(
    () =>
      approvedReviews.filter(
        (review) =>
          review.operation === "publish" &&
          review.subject_id === ledger?.latest_draft_revision.draft_revision_id,
      ),
    [approvedReviews, ledger?.latest_draft_revision.draft_revision_id],
  );
  const rollbackReviews = useMemo(
    () =>
      approvedReviews.filter(
        (review) => review.operation === "rollback" && review.subject_id === rollbackTargetId,
      ),
    [approvedReviews, rollbackTargetId],
  );

  useEffect(() => {
    if (!publishReviews.some((review) => review.review_id === publicationReviewId)) {
      setPublicationReviewId(publishReviews[0]?.review_id ?? "");
      resetKey("publish");
    }
  }, [publicationReviewId, publishReviews]);

  useEffect(() => {
    if (!rollbackReviews.some((review) => review.review_id === rollbackReviewId)) {
      setRollbackReviewId(rollbackReviews[0]?.review_id ?? "");
      resetKey("rollback");
    }
  }, [rollbackReviewId, rollbackReviews]);

  if (!durableContract) return null;

  const frontend = durableContract.frontend_contract;
  const capabilities = durableContract.capabilities;
  const readiness = durableContract.publication_readiness;
  const runtimeBlockers = Array.isArray(readiness.runtime_blockers)
    ? readiness.runtime_blockers.filter(
        (blocker): blocker is { code: string; message: string } =>
          Boolean(blocker) &&
          typeof blocker === "object" &&
          typeof (blocker as { code?: unknown }).code === "string" &&
          typeof (blocker as { message?: unknown }).message === "string",
      )
    : [];
  const capabilityLabel = (key: string) =>
    readContractText(capabilities[key]?.label, key.replace(/_/g, " "));

  const handleWorkflowSelection = async (workflowId: string) => {
    if (mutating) return;
    const requestEpoch = ++requestEpochRef.current;
    setSelectedWorkflowId(workflowId);
    setError(null);
    setNotice(null);
    mutationKeys.current = {};
    setAcknowledgement("");
    setLedger(null);
    if (workflowId === NEW_WORKFLOW_VALUE) {
      setDraftJson(DEFAULT_DRAFT);
      setLoading(false);
      return;
    }
    setDraftJson(DEFAULT_DRAFT);
    setLoading(true);
    try {
      await loadLedger(workflowId, requestEpoch);
    } catch (cause) {
      if (requestEpochRef.current !== requestEpoch) return;
      setLedger(null);
      setError(getErrorMessage(cause, "No se pudo verificar el workflow seleccionado."));
    } finally {
      if (requestEpochRef.current === requestEpoch) setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (loading) return;
    const requestedScope = scopeKey;
    const requestedScopeGeneration = scopeGenerationRef.current;
    const scopeIsCurrent = () =>
      activeScopeRef.current === requestedScope &&
      scopeGenerationRef.current === requestedScopeGeneration;
    setMutating("draft");
    setError(null);
    setNotice(null);
    try {
      const draft = parseWhatsappWorkflowDraftJson(draftJson, durableContract);
      const editing = selectedWorkflowId !== NEW_WORKFLOW_VALUE && ledger;
      const receipt = await saveWhatsappWorkflowDraft({
        contract: durableContract,
        expectedTenantSlug: tenantSlug,
        draft,
        idempotencyKey: keyFor("draft"),
        workflowId: editing ? selectedWorkflowId : undefined,
        expectedRevision: editing ? ledger.latest_draft_revision.revision : undefined,
      });
      if (!scopeIsCurrent()) return;
      resetKey("draft");
      setSelectedWorkflowId(receipt.draft_revision.workflow_id);
      setNotice(
        receipt.idempotent_replay
          ? "El servidor confirmó la misma revisión idempotente; no se duplicó."
          : `Revisión ${receipt.draft_revision.revision} agregada al ledger inmutable.`,
      );
      await refresh(receipt.draft_revision.workflow_id);
    } catch (cause) {
      if (!scopeIsCurrent()) return;
      setError(
        `${getErrorMessage(cause, "No se pudo guardar el borrador.")} Podés reintentar: se reutilizará la misma clave mientras no edites el JSON.`,
      );
    } finally {
      if (scopeIsCurrent()) setMutating(null);
    }
  };

  const handleReview = async () => {
    if (loading || !ledger || !reviewSubjectId) return;
    const requestedScope = scopeKey;
    const requestedScopeGeneration = scopeGenerationRef.current;
    const scopeIsCurrent = () =>
      activeScopeRef.current === requestedScope &&
      scopeGenerationRef.current === requestedScopeGeneration;
    setMutating("review");
    setError(null);
    setNotice(null);
    try {
      const receipt = await reviewWhatsappWorkflow({
        contract: durableContract,
        expectedTenantSlug: tenantSlug,
        workflowId: ledger.workflow_id,
        operation: reviewOperation,
        subjectId: reviewSubjectId,
        decision: reviewDecision,
        note: reviewNote,
        idempotencyKey: keyFor("review"),
      });
      if (!scopeIsCurrent()) return;
      resetKey("review");
      setReviewNote("");
      setNotice(
        receipt.idempotent_replay
          ? "El servidor confirmó la misma revisión idempotente."
          : `Revisión ${receipt.review.decision === "approved" ? "aprobada" : "rechazada"} registrada; el historial previo no cambió.`,
      );
      await refresh(ledger.workflow_id);
    } catch (cause) {
      if (!scopeIsCurrent()) return;
      setError(
        `${getErrorMessage(cause, "No se pudo registrar la revisión.")} El reintento conserva la misma clave mientras no cambies la decisión.`,
      );
    } finally {
      if (scopeIsCurrent()) setMutating(null);
    }
  };

  const handlePublish = async () => {
    if (loading || !ledger || !publicationReviewId) return;
    const requestedScope = scopeKey;
    const requestedScopeGeneration = scopeGenerationRef.current;
    const scopeIsCurrent = () =>
      activeScopeRef.current === requestedScope &&
      scopeGenerationRef.current === requestedScopeGeneration;
    setMutating("publish");
    setError(null);
    setNotice(null);
    try {
      const receipt = await publishWhatsappWorkflow({
        contract: durableContract,
        expectedTenantSlug: tenantSlug,
        workflowId: ledger.workflow_id,
        draftRevisionId: ledger.latest_draft_revision.draft_revision_id,
        reviewId: publicationReviewId,
        idempotencyKey: keyFor("publish"),
        acknowledgement,
      });
      if (!scopeIsCurrent()) return;
      resetKey("publish");
      setAcknowledgement("");
      setNotice(
        receipt.idempotent_replay
          ? "El servidor confirmó la misma activación del plano de control; no se duplicó."
          : `Versión ${receipt.version.version} registrada como activa sólo en el plano de control. El runtime sigue desconectado.`,
      );
      await refresh(ledger.workflow_id);
    } catch (cause) {
      if (!scopeIsCurrent()) return;
      setError(
        `${getErrorMessage(cause, "No se pudo registrar la publicación.")} El reintento conserva la misma clave idempotente.`,
      );
    } finally {
      if (scopeIsCurrent()) setMutating(null);
    }
  };

  const handleRollback = async () => {
    if (loading || !ledger || !rollbackTargetId || !rollbackReviewId) return;
    const requestedScope = scopeKey;
    const requestedScopeGeneration = scopeGenerationRef.current;
    const scopeIsCurrent = () =>
      activeScopeRef.current === requestedScope &&
      scopeGenerationRef.current === requestedScopeGeneration;
    setMutating("rollback");
    setError(null);
    setNotice(null);
    try {
      const receipt = await rollbackWhatsappWorkflow({
        contract: durableContract,
        expectedTenantSlug: tenantSlug,
        workflowId: ledger.workflow_id,
        targetVersionId: rollbackTargetId,
        reviewId: rollbackReviewId,
        idempotencyKey: keyFor("rollback"),
        acknowledgement,
      });
      if (!scopeIsCurrent()) return;
      resetKey("rollback");
      setAcknowledgement("");
      setNotice(
        receipt.idempotent_replay
          ? "El servidor confirmó el mismo rollback idempotente; no se duplicó."
          : `Rollback registrado como nueva versión ${receipt.version.version}. No se reescribió el historial ni se activó el runtime.`,
      );
      await refresh(ledger.workflow_id);
    } catch (cause) {
      if (!scopeIsCurrent()) return;
      setError(
        `${getErrorMessage(cause, "No se pudo registrar el rollback.")} El reintento conserva la misma clave idempotente.`,
      );
    } finally {
      if (scopeIsCurrent()) setMutating(null);
    }
  };

  const isAcknowledged = acknowledgement === WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK;

  return (
    <Card className="border-sky-200 dark:border-sky-500/30" data-testid="workflow-control-plane">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-sky-600" aria-hidden="true" />
              {readContractText(frontend.title, durableContract.contract_version)}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {readContractText(frontend.description, durableContract.mode)} · <strong>{tenantSlug}</strong>
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            {readContractText(frontend.status_label, String(readiness.status))}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <strong>{capabilityLabel("runtime")} · {readContractText(capabilities.runtime.status, "blocked")}</strong>
              {runtimeBlockers.map((blocker) => (
                <p key={blocker.code} className="mt-1">{blocker.message}</p>
              ))}
              <p className="mt-2 font-mono text-xs">
                provider_calls: false · messages_sent: false · tickets_created: false · handoffs_created: false
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="space-y-1 text-sm font-medium">
            Workflow del tenant
            <select
              aria-label="Workflow del tenant"
              className={selectClasses}
              disabled={Boolean(mutating)}
              value={selectedWorkflowId}
              onChange={(event) => void handleWorkflowSelection(event.target.value)}
            >
              <option value={NEW_WORKFLOW_VALUE}>+ Crear workflow</option>
              {(listing?.workflows ?? []).map((workflow) => (
                <option key={workflow.workflow_id} value={workflow.workflow_id}>
                  {workflow.name} · r{workflow.latest_draft_revision} · {workflow.published_version_count} versiones
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading || Boolean(mutating)}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Verificar ledger
          </Button>
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            {notice}
          </div>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-border/60 p-4" aria-labelledby="workflow-draft-title">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>
              <span id="workflow-draft-title">{capabilityLabel("draft")}</span>
            </SectionTitle>
            <span className="text-xs text-muted-foreground">
              {ledger ? `Nueva revisión después de r${ledger.latest_draft_revision.revision}` : "Nuevo ledger"}
            </span>
          </div>
          <Textarea
            aria-label="Borrador JSON"
            className="min-h-[260px] font-mono text-xs"
            spellCheck={false}
            value={draftJson}
            onChange={(event) => {
              setDraftJson(event.target.value);
              clearMutationFeedback("draft");
            }}
          />
          <Button type="button" onClick={() => void handleSaveDraft()} disabled={Boolean(mutating) || loading}>
            {mutating === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {capabilityLabel("draft")}
          </Button>
        </section>

        {ledger ? (
          <>
            <section className="space-y-3 rounded-2xl border border-border/60 p-4" aria-labelledby="workflow-review-title">
              <SectionTitle>
                <span id="workflow-review-title">{capabilityLabel("review")}</span>
              </SectionTitle>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm font-medium">
                  Operación
                  <select
                    aria-label="Operación a revisar"
                    className={selectClasses}
                    value={reviewOperation}
                    onChange={(event) => {
                      setReviewOperation(event.target.value as "publish" | "rollback");
                      clearMutationFeedback("review");
                    }}
                  >
                    <option value="publish">{capabilityLabel("publish")}</option>
                    <option value="rollback">{capabilityLabel("rollback")}</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Objeto exacto
                  <select
                    aria-label="Objeto a revisar"
                    className={selectClasses}
                    value={reviewSubjectId}
                    onChange={(event) => {
                      setReviewSubjectId(event.target.value);
                      clearMutationFeedback("review");
                    }}
                  >
                    {reviewSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Decisión
                  <select
                    aria-label="Decisión de revisión"
                    className={selectClasses}
                    value={reviewDecision}
                    onChange={(event) => {
                      setReviewDecision(event.target.value as "approved" | "rejected");
                      clearMutationFeedback("review");
                    }}
                  >
                    <option value="approved">Aprobar</option>
                    <option value="rejected">Rechazar</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium">
                Fundamento (obligatorio)
                <Input
                  aria-label="Fundamento de revisión"
                  maxLength={1000}
                  value={reviewNote}
                  onChange={(event) => {
                    setReviewNote(event.target.value);
                    clearMutationFeedback("review");
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleReview()}
                disabled={loading || Boolean(mutating) || !reviewSubjectId || !reviewNote.trim()}
              >
                {mutating === "review" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {capabilityLabel("review")}
              </Button>
            </section>

            <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-500/30 dark:bg-sky-500/5" aria-labelledby="workflow-publication-title">
              <SectionTitle>
                <span id="workflow-publication-title">{readContractText(frontend.status_label, durableContract.mode)}</span>
              </SectionTitle>
              <p className="text-xs leading-5 text-muted-foreground">
                Confirmación reforzada: escribí <strong className="font-mono">{WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK}</strong>. Esto no habilita el runtime.
              </p>
              <Input
                aria-label="Confirmación de plano de control"
                autoComplete="off"
                value={acknowledgement}
                onChange={(event) => {
                  setAcknowledgement(event.target.value);
                }}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-border/60 bg-background p-3">
                  <p className="text-sm font-semibold">Registrar publicación</p>
                  <select
                    aria-label="Review aprobado para publicar"
                    className={selectClasses}
                    value={publicationReviewId}
                    onChange={(event) => {
                      setPublicationReviewId(event.target.value);
                      resetKey("publish");
                    }}
                  >
                    <option value="">Elegí un review aprobado vigente</option>
                    {publishReviews.map((review) => (
                      <option key={review.review_id} value={review.review_id}>
                        Review {shortId(review.review_id)} · {formatDate(review.reviewed_at)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={loading || Boolean(mutating) || !publicationReviewId || !isAcknowledged}
                  >
                    {mutating === "publish" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson2 className="mr-2 h-4 w-4" />}
                    {capabilityLabel("publish")}
                  </Button>
                </div>
                <div className="space-y-3 rounded-xl border border-border/60 bg-background p-3">
                  <p className="text-sm font-semibold">Registrar rollback como nueva versión</p>
                  <select
                    aria-label="Versión objetivo de rollback"
                    className={selectClasses}
                    value={rollbackTargetId}
                    onChange={(event) => {
                      setRollbackTargetId(event.target.value);
                      resetKey("rollback");
                    }}
                  >
                    <option value="">Elegí una versión histórica</option>
                    {ledger.published_versions.map((version) => (
                      <option key={version.version_id} value={version.version_id}>
                        Versión {version.version} · {version.version_kind} · {shortId(version.version_id)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Review aprobado para rollback"
                    className={selectClasses}
                    value={rollbackReviewId}
                    onChange={(event) => {
                      setRollbackReviewId(event.target.value);
                      resetKey("rollback");
                    }}
                  >
                    <option value="">Elegí el review exacto aprobado</option>
                    {rollbackReviews.map((review) => (
                      <option key={review.review_id} value={review.review_id}>
                        Review {shortId(review.review_id)} · {formatDate(review.reviewed_at)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleRollback()}
                    disabled={loading || Boolean(mutating) || !rollbackTargetId || !rollbackReviewId || !isAcknowledged}
                  >
                    {mutating === "rollback" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    {capabilityLabel("rollback")}
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border/60 p-4" aria-labelledby="workflow-history-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>
                  <span id="workflow-history-title" className="inline-flex items-center gap-2">
                    <History className="h-4 w-4" aria-hidden="true" /> {capabilityLabel("versioning")} · {readContractText(capabilities.versioning.history_policy, "append_only")}
                  </span>
                </SectionTitle>
                <span className="text-xs font-semibold text-muted-foreground">
                  Activa en control plane: {shortId(ledger.active_version_id)} · runtime: desconectado
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <HistoryColumn
                  title={`Borradores (${ledger.draft_revisions.length})`}
                  rows={ledger.draft_revisions.map((draft) => ({
                    id: draft.draft_revision_id,
                    primary: `Revisión ${draft.revision}`,
                    secondary: formatDate(draft.created_at),
                  }))}
                />
                <HistoryColumn
                  title={`Reviews (${ledger.reviews.length})`}
                  rows={ledger.reviews.map((review) => ({
                    id: review.review_id,
                    primary: `${review.operation} · ${review.decision}`,
                    secondary: `Objeto ${shortId(review.subject_id)} · ${formatDate(review.reviewed_at)}`,
                  }))}
                />
                <HistoryColumn
                  title={`Versiones (${ledger.published_versions.length})`}
                  rows={ledger.published_versions.map((version) => ({
                    id: version.version_id,
                    primary: `Versión ${version.version} · ${version.version_kind}`,
                    secondary:
                      version.version_id === ledger.active_version_id
                        ? "Activa sólo en control plane"
                        : "Histórica inmutable",
                  }))}
                />
                <HistoryColumn
                  title={`Activaciones (${ledger.activations.length})`}
                  rows={ledger.activations.map((activation) => ({
                    id: activation.activation_id,
                    primary: `Secuencia ${activation.sequence} · ${activation.activation_kind}`,
                    secondary: "runtime_consumed: false",
                  }))}
                />
              </div>
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

const HistoryColumn = ({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; primary: string; secondary: string }>;
}) => (
  <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
    {rows.length ? (
      <ol className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border/50 bg-background px-2.5 py-2">
            <p className="text-xs font-semibold text-foreground">{row.primary}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{row.secondary}</p>
          </li>
        ))}
      </ol>
    ) : (
      <p className="mt-3 text-xs text-muted-foreground">Sin registros.</p>
    )}
  </div>
);
