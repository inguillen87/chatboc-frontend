import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";

import {
  getProductionSmokeV2,
  type ProductionSmokeCheck,
  type ProductionSmokeE2EFlow,
  type ProductionSmokeV2,
} from "@/api/v2/saas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getErrorMessage } from "@/utils/api";

type Tone = "pass" | "warning" | "fail" | "unknown";
type ReadState = {
  scope: string | null;
  phase: "loading" | "ready" | "error";
  data?: ProductionSmokeV2;
  error?: string;
};

const MISSING = "Sin dato informado";
const textValue = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const countValue = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const recordValue = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pass: { label: "Controles conformes", tone: "pass" },
  warning: { label: "Revisión pendiente", tone: "warning" },
  fail: { label: "Revisar controles", tone: "fail" },
  ready: { label: "Preparación registrada", tone: "pass" },
  needs_attention: { label: "Requiere revisión", tone: "warning" },
  loading: { label: "Consultando", tone: "unknown" },
};
const toneClasses: Record<Tone, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  fail: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  unknown: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
};
const statusInfo = (status?: string) =>
  status && Object.hasOwn(STATUS, status) ? STATUS[status] : { label: "Sin resultado informado", tone: "unknown" as Tone };

const SURFACES: Record<string, string> = {
  municipios_gobiernos: "Gobiernos y municipios",
  pymes_empresas: "Empresas",
  gobiernos_empresas_colegios: "Gobiernos, empresas y educación",
  colegios_educacion: "Educación",
  finanzas_pymes_gobiernos_colegios: "Operaciones financieras",
  finanzas_banca_seguros: "Servicios financieros",
  analytics_maps: "Analítica y mapas",
};
// Current producer recommendations are narrative guidance, never executable actions.
const NEXT_TESTS: Record<string, string> = {
  run_whatsapp_claim_text_to_tracking_and_open_public_status: "Probar un reclamo por WhatsApp y comprobar su seguimiento público.",
  validate_public_claim_message_reaches_admin_inbox: "Verificar que una consulta pública llegue a la bandeja administrativa.",
  run_catalog_order_checkout_smoke_with_demo_tenant: "Probar catálogo, pedido y checkout con una organización de prueba.",
  publish_demo_survey_and_verify_live_results_heatmap: "Probar una encuesta de demostración y verificar sus resultados y mapa cuando haya ubicación.",
  run_school_payment_receipt_and_family_case_demo: "Probar comprobantes y casos familiares en una demostración educativa.",
  run_finance_onboarding_collection_signature_smoke: "Probar alta, cobranza y firma en el recorrido financiero.",
  run_finance_servicing_transfer_insurance_smoke: "Probar atención financiera, transferencias y seguros.",
  collect_geocoded_claims_orders_and_render_heatmap_layers: "Reunir casos con ubicación y comprobar las capas del mapa.",
  run_live_smoke: "Ejecutar una prueba operativa.",
  complete_flow_contract: "Revisar la preparación del recorrido.",
};
const finiteLabel = (labels: Record<string, string>, key: unknown, fallback: string) =>
  typeof key === "string" && Object.hasOwn(labels, key) ? labels[key] : fallback;

const COUNT_EVIDENCE: Record<string, string> = {
  tickets_recent: "Tickets recientes",
  open_tickets: "Tickets abiertos",
  products: "Productos",
  ready_to_sell: "Productos con preparación registrada",
  surveys: "Encuestas",
  active: "Encuestas activas",
  responses: "Respuestas",
  journeys: "Recorridos definidos",
  ready_journeys: "Recorridos preparados",
};
const FLAG_EVIDENCE: Record<string, { label: string; yes: string; no: string }> = {
  checkout_ready: { label: "Preparación del checkout", yes: "Registrada", no: "Por revisar" },
  pin_required: { label: "PIN requerido por el contrato", yes: "Sí", no: "No" },
  working_hours_configurable: { label: "Horarios configurables", yes: "Sí", no: "No" },
  can_render_heatmap: { label: "Datos habilitados para mapa", yes: "Sí", no: "No" },
};
const FRESHNESS: Record<string, string> = {
  fresh: "Fuentes recientes según el contrato",
  degraded: "Fuentes con demora según el contrato",
  empty: "Sin datos en el período informado",
};
const FLOW_EVIDENCE_KEYS: Record<string, string[]> = {
  gov_claim_text_to_tracking: ["tickets_recent", "open_tickets"],
  claim_live_or_offline_helpdesk: ["pin_required", "working_hours_configurable"],
  pyme_catalog_order_checkout: ["products", "ready_to_sell", "checkout_ready"],
  survey_vote_realtime: ["surveys", "active", "responses"],
  school_family_case: [],
  finance_in_chat_transactional: ["checkout_ready", "ready_journeys"],
  finance_servicing_transfer_insurance: ["journeys", "ready_journeys"],
  analytics_heatmap: ["can_render_heatmap", "freshness_status"],
};
type Evidence = { key: string; label: string; value: string | number };
const flowEvidence = (flow: ProductionSmokeE2EFlow): Evidence[] => {
  const record = recordValue(flow.evidence);
  const allowed = Object.hasOwn(FLOW_EVIDENCE_KEYS, flow.id) ? FLOW_EVIDENCE_KEYS[flow.id] : [];
  const evidence: Evidence[] = [];
  for (const [key, label] of Object.entries(COUNT_EVIDENCE)) {
    if (allowed.includes(key) && Object.hasOwn(record, key)) evidence.push({ key, label, value: countValue(record[key]) ?? MISSING });
  }
  for (const [key, spec] of Object.entries(FLAG_EVIDENCE)) {
    if (allowed.includes(key) && Object.hasOwn(record, key)) {
      evidence.push({ key, label: spec.label, value: typeof record[key] === "boolean" ? record[key] ? spec.yes : spec.no : MISSING });
    }
  }
  if (allowed.includes("freshness_status") && Object.hasOwn(record, "freshness_status")) {
    evidence.push({ key: "freshness_status", label: "Frescura de fuentes", value: finiteLabel(FRESHNESS, record.freshness_status, MISSING) });
  }
  return evidence;
};

const checkStatus = (check: ProductionSmokeCheck) =>
  check.status === "pass" && check.ok === true ? "pass" : check.status === "fail" && check.ok === false ? "fail" : undefined;
const flowStatus = (flow: ProductionSmokeE2EFlow) =>
  flow.status === "ready" && flow.ready === true ? "ready" : flow.status === "needs_attention" && flow.ready === false ? "needs_attention" : undefined;
const NO_TENANT_CHECKS = new Set(["routes_registered", "widget_platform_onboarding", "socket_disabled_for_landing"]);

const StatusPill = ({ status }: { status?: string }) => {
  const { label, tone } = statusInfo(status);
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>;
};

const EvidenceList = ({ evidence }: { evidence: Evidence[] }) => (
  <dl className="grid gap-2 sm:grid-cols-2">
    {evidence.map((item) => (
      <div key={item.key} className="rounded-[8px] border bg-muted/20 p-2">
        <dt className="text-xs text-muted-foreground">{item.label}</dt>
        <dd className="mt-1 break-words text-sm font-semibold">{item.value}</dd>
      </div>
    ))}
  </dl>
);

const guidanceItems = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => {
  const text = textValue(item);
  return text ? [text] : [];
}) : [];
const FlowCard = ({ flow }: { flow: ProductionSmokeE2EFlow }) => {
  const evidence = flowEvidence(flow);
  const steps = guidanceItems(flow.manual_test_steps);
  const criteria = guidanceItems(flow.acceptance_criteria);
  const label = textValue(flow.label) ?? "Recorrido sin nombre informado";
  return (
    <li className="min-w-0 rounded-[8px] border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <h5 className="break-words font-semibold">{label}</h5>
          <p className="mt-1 text-xs text-muted-foreground">{finiteLabel(SURFACES, flow.surface, "Área no informada")}</p>
        </div>
        <StatusPill status={flowStatus(flow)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Blueprint de Meta Flow: {flow.meta_flow_ready === true ? "Preparado" : flow.meta_flow_ready === false ? "Por revisar" : MISSING}
      </p>
      <p className="mt-3 rounded-[8px] border border-blue-100 bg-blue-50 p-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
        Próxima prueba: {finiteLabel(NEXT_TESTS, flow.next_action, "Siguiente paso no informado")}
      </p>
      <details className="mt-3 rounded-[8px] border p-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          Ver evidencia y guía de prueba de {label}
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">La preparación del contrato y su blueprint requiere una prueba operativa con evidencia para su aceptación.</p>
          {evidence.length ? <EvidenceList evidence={evidence} /> : <p className="text-sm text-muted-foreground">Sin evidencia de presentación informada.</p>}
          <div>
            <h6 className="text-sm font-semibold">Pasos manuales recibidos</h6>
            {steps.length ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{steps.map((step, index) => <li key={index} className="break-words">{step}</li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">Guía manual no informada.</p>}
          </div>
          <div>
            <h6 className="text-sm font-semibold">Criterios de aceptación recibidos</h6>
            {criteria.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{criteria.map((criterion, index) => <li key={index} className="break-words">{criterion}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Criterios de aceptación no informados.</p>}
          </div>
        </div>
      </details>
    </li>
  );
};

const CheckCard = ({ check }: { check: ProductionSmokeCheck }) => {
  const details = recordValue(check.details);
  const evidence: Evidence[] = [];
  if (check.id === "whatsapp_operations") {
    for (const [key, label] of [["channel_enabled", "Canal de WhatsApp declarado"], ["voice_enabled", "Voz declarada"]]) {
      if (Object.hasOwn(details, key)) evidence.push({ key, label, value: typeof details[key] === "boolean" ? details[key] ? "Habilitado" : "Deshabilitado" : MISSING });
    }
  }
  if (check.id === "inbox_360" && Object.hasOwn(details, "has_ticket")) {
    evidence.push({ key: "has_ticket", label: "Ticket de muestra", value: details.has_ticket === true ? "Incluido" : details.has_ticket === false ? "No incluido" : MISSING });
  }
  const priority = finiteLabel({ critical: "Alta", warning: "Media", info: "Informativa" }, check.severity, "No informada");
  return (
    <li className="min-w-0 rounded-[8px] border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-48">
          <h5 className="break-words text-sm font-semibold">{textValue(check.label) ?? "Control sin nombre informado"}</h5>
          <p className="mt-1 text-xs text-muted-foreground">Prioridad: {priority}</p>
        </div>
        <StatusPill status={checkStatus(check)} />
      </div>
      {evidence.length ? <div className="mt-3"><EvidenceList evidence={evidence} /></div> : null}
    </li>
  );
};

const timestampValue = (value: unknown) => {
  const timestamp = textValue(value);
  if (!timestamp || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) return undefined;
  return { iso: timestamp, label: `${new Date(timestamp).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23" })} (Argentina)` };
};

interface ProductionSmokeReportProps {
  tenantSlug?: string | null;
}

export default function ProductionSmokeReport({ tenantSlug }: ProductionSmokeReportProps) {
  const scope = tenantSlug || null;
  const [read, setRead] = useState<ReadState>({ scope, phase: "loading" });
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setRead({ scope, phase: "loading" });
    try {
      const data = await getProductionSmokeV2(scope);
      if (sequence === requestSequence.current) setRead({ scope, phase: "ready", data });
    } catch (error) {
      if (sequence === requestSequence.current) {
        setRead({ scope, phase: "error", error: getErrorMessage(error, "No se pudieron consultar las comprobaciones de contratos.") });
      }
    }
  }, [scope]);
  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  const current: ReadState = read.scope === scope ? read : { scope, phase: "loading" };
  const data = current.data;
  const loading = current.phase === "loading";
  const compatible = data?.contract_version === "platform.production_smoke.v1";
  const tenant = recordValue(data?.tenant);
  const reportedSlug = textValue(tenant.slug);
  const tenantName = reportedSlug ? textValue(tenant.nombre) ?? reportedSlug : undefined;
  const hasTenantIdentity = Boolean(reportedSlug);
  const scopeMismatch = Boolean(scope && scope !== reportedSlug);
  const available = compatible && !scopeMismatch;
  const timestamp = timestampValue(data?.generated_at);
  const receivedChecks = available ? data?.checks ?? [] : [];
  const independentAggregate = receivedChecks.length > 0
    && receivedChecks.every((check) => NO_TENANT_CHECKS.has(check.id))
    && countValue(recordValue(data?.summary).total) === receivedChecks.length;
  const aggregateAvailable = available && (hasTenantIdentity || independentAggregate);
  const summary = aggregateAvailable ? recordValue(data?.summary) : {};
  const checks = receivedChecks.filter((check) => hasTenantIdentity || NO_TENANT_CHECKS.has(check.id));
  const e2e = available && hasTenantIdentity ? data?.e2e_flow_readiness : undefined;
  const compatibleFlows = e2e?.contract_version === "platform.e2e_flow_readiness.v1";
  const flowSummary = compatibleFlows ? recordValue(e2e?.summary) : {};

  return (
    <Card className="overflow-hidden border-border/60" aria-busy={loading}>
      <CardHeader className="gap-3 border-b bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck aria-hidden="true" className="h-4 w-4 text-blue-200" />Comprobaciones de contratos</CardTitle>
          <CardDescription className="mt-2 text-blue-100/80">Evalúa registros y preparación de flujos. Estos resultados no acreditan entrega de WhatsApp, cobros ni aceptación operativa.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" aria-live="polite"><StatusPill status={loading ? "loading" : aggregateAvailable && ["pass", "warning", "fail"].includes(data?.status) ? data?.status : undefined} /></span>
          <Button type="button" size="sm" variant="outline" className="min-h-11 bg-slate-950 text-white hover:bg-slate-800 hover:text-white" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {loading ? <p className="text-sm text-muted-foreground">Consultando las comprobaciones para el alcance solicitado.</p> : null}
        {current.phase === "error" ? <div role="alert" className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"><p className="font-semibold">Consulta no disponible</p><p className="mt-1 break-words">{current.error}</p><p className="mt-1">Actualiza para repetir esta consulta.</p></div> : null}
        {data && !compatible ? <p role="alert" className="rounded-[8px] border p-3 text-sm">Contrato de comprobación no reconocido. No se muestran resultados de esta respuesta.</p> : null}
        {data && scopeMismatch ? <p role="alert" className="rounded-[8px] border p-3 text-sm">{reportedSlug ? "La respuesta corresponde a otra organización." : "La respuesta no informa la identidad de la organización solicitada."} No se muestran resultados para el alcance solicitado.</p> : null}
        {available ? (
          <>
            <dl className="grid gap-3 rounded-[8px] border bg-muted/20 p-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Organización incluida en la respuesta</dt><dd className="mt-1 break-words font-semibold">{tenantName ?? "Organización no informada"}{tenantName && reportedSlug && tenantName !== reportedSlug ? ` (${reportedSlug})` : ""}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Generado por el backend</dt><dd className="mt-1 font-semibold">{timestamp ? <time dateTime={timestamp.iso}>{timestamp.label}</time> : "Fecha no informada"}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">{tenantName ? "El informe corresponde a la organización recibida y no representa una prueba de toda la plataforma." : "Sin organización informada, solo se muestran controles que no requieren una organización. El informe no representa una prueba de toda la plataforma."}</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <SmokeMetric label="Controles informados" value={countValue(summary.total)} />
              <SmokeMetric label="Conformes" value={countValue(summary.passed)} />
              <SmokeMetric label="Para revisar" value={countValue(summary.failed)} />
              <SmokeMetric label="Prioridad alta" value={countValue(summary.critical_failed)} />
            </div>
            <ContractProgress label="Proporción de controles conformes" completed={countValue(summary.passed)} total={countValue(summary.total)} />
            <section aria-label="Controles de contratos" className="space-y-3">
              <h4 className="text-sm font-bold">Controles de contratos</h4>
              {checks.length ? <ul className="grid gap-2">{checks.map((check, index) => <CheckCard key={`${check.id}-${index}`} check={check} />)}</ul> : <p className="rounded-[8px] border border-dashed p-4 text-sm text-muted-foreground">No hay controles informados para este alcance.</p>}
            </section>
            <section aria-label="Preparación de flujos" className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h4 className="flex items-center gap-2 text-sm font-bold"><ClipboardCheck aria-hidden="true" className="h-4 w-4" />Preparación de flujos</h4><p className="mt-1 text-xs text-muted-foreground">Las guías y los criterios recibidos requieren una prueba operativa y revisión de su evidencia.</p></div>
                {compatibleFlows ? <StatusPill status={["ready", "needs_attention"].includes(e2e?.status) ? e2e?.status : undefined} /> : null}
              </div>
              {!tenantName ? <p className="text-sm text-muted-foreground">Se requiere una organización informada para presentar la preparación de sus flujos.</p> : !e2e ? <p className="text-sm text-muted-foreground">Preparación de flujos no informada.</p> : !compatibleFlows ? <p className="text-sm text-muted-foreground">Contrato de preparación de flujos no reconocido.</p> : (
                <>
                  <ContractProgress label="Proporción de flujos con preparación registrada" completed={countValue(flowSummary.ready)} total={countValue(flowSummary.total)} />
                  {e2e.flows.length ? <ul className="grid gap-3 xl:grid-cols-2">{e2e.flows.map((flow, index) => <FlowCard key={`${flow.id}-${index}`} flow={flow} />)}</ul> : <p className="text-sm text-muted-foreground">No hay recorridos informados.</p>}
                </>
              )}
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

const SmokeMetric = ({ label, value }: { label: string; value?: number }) => (
  <div className="rounded-[8px] border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-semibold ${value === undefined ? "text-sm" : "text-2xl"}`}>{value ?? MISSING}</p></div>
);
const ContractProgress = ({ label, completed, total }: { label: string; completed?: number; total?: number }) => {
  const valid = completed !== undefined && total !== undefined && total > 0 && completed <= total;
  const percentage = valid ? Math.round(completed / total * 100) : undefined;
  return (
    <div className="rounded-[8px] border bg-background p-3">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold">{label}</span><span>{valid ? `${completed}/${total} (${percentage}%)` : "Proporción no informada"}</span></div>
      {percentage !== undefined ? <Progress value={percentage} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${completed} de ${total} (${percentage}%)`} className="h-2" /> : null}
    </div>
  );
};
