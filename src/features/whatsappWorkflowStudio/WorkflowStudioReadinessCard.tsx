import { AlertTriangle, CheckCircle2, ShieldCheck, Workflow } from "lucide-react";

import { parseWhatsappWorkflowStudioContract } from "@/api/v2/whatsappWorkflowStudio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const asRecords = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const humanizeKey = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());

const statusClasses = (available: boolean, status: string) => {
  if (available && status === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
  }
  if (available) {
    return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200";
  }
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
};

export interface WorkflowStudioReadinessCardProps {
  contract: unknown;
}

export default function WorkflowStudioReadinessCard({
  contract,
}: WorkflowStudioReadinessCardProps) {
  const parsedContract = parseWhatsappWorkflowStudioContract(contract);
  if (!parsedContract) return null;

  const frontend = asRecord(parsedContract.frontend_contract);
  const capabilities = asRecord(parsedContract.capabilities);
  const readiness = asRecord(parsedContract.publication_readiness);
  const blockers = asRecords(readiness.blockers);
  const statusLabels = asRecord(frontend.status_labels);
  const requestedOrder = Array.isArray(frontend.capability_order)
    ? frontend.capability_order.map(asText).filter(Boolean)
    : [];
  const capabilityKeys = requestedOrder.length ? requestedOrder : Object.keys(capabilities);
  const title = asText(frontend.title) || humanizeKey(parsedContract.contract_version);
  const titleId = "whatsapp-workflow-studio-title";

  return (
    <Card
      className="border-border/60"
      data-testid="whatsapp-workflow-studio-readiness"
      aria-labelledby={titleId}
    >
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle id={titleId} className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-primary" aria-hidden="true" />
              {title}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {asText(frontend.description) || parsedContract.mode}
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {asText(frontend.status_label) || asText(readiness.status)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          role="list"
          aria-label={title}
        >
          {capabilityKeys.map((key) => {
            const capability = asRecord(capabilities[key]);
            if (!Object.keys(capability).length) return null;
            const available = capability.available === true;
            const status = asText(capability.status);
            const endpoint = asText(capability.endpoint);
            const statusLabel = asText(statusLabels[status]) || humanizeKey(status);
            return (
              <div
                key={key}
                role="listitem"
                className="rounded-2xl border border-border/60 bg-background/80 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-foreground">
                    {asText(capability.label) || humanizeKey(key)}
                  </div>
                  {available ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(
                    available,
                    status,
                  )}`}
                >
                  {statusLabel}
                </span>
                {asText(capability.description) ? (
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">
                    {asText(capability.description)}
                  </div>
                ) : null}
                {endpoint ? (
                  <div className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                    {asText(capability.method)} {endpoint}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {blockers.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {asText(frontend.blockers_title) || humanizeKey(asText(readiness.status))}
            </div>
            <ul className="mt-3 space-y-2">
              {blockers.map((blocker) => {
                const code = asText(blocker.code);
                return (
                  <li key={`${code}-${asText(blocker.path)}`} className="text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
                    <span className="font-mono font-semibold">{code}</span>
                    {asText(blocker.message) ? ` - ${asText(blocker.message)}` : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {asText(frontend.safety_note) ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {asText(frontend.safety_note)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
