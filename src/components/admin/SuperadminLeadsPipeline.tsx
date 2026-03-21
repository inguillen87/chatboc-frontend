import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { enterpriseService } from "@/services/enterpriseService";
import { toast } from "sonner";
import {
  Bell,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
} from "lucide-react";
import { trackFrontendEvent } from "@/utils/frontendTelemetry";

type LeadStage =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "demo_agendada"
  | "propuesta_enviada"
  | "ganado"
  | "perdido"
  | string;
interface LeadItem {
  id?: string | number;
  tenant_slug?: string;
  nombre?: string;
  name?: string;
  email?: string;
  telefono?: string;
  phone?: string;
  nro_ticket?: string | number;
  ticket_id?: string | number;
  ticket_type?: "municipio" | "pyme" | string;
  stage?: LeadStage;
  relevance_score?: number;
  created_at?: string;
  confidence_score?: number;
}
interface PipelineResponse {
  total?: number;
  by_stage?: Record<string, number>;
  by_tenant?: Record<string, number>;
  conversion_rate?: number;
  avg_first_response_seconds?: number;
  items?: LeadItem[];
}
const STAGES: LeadStage[] = [
  "nuevo",
  "contactado",
  "calificado",
  "demo_agendada",
  "propuesta_enviada",
  "ganado",
  "perdido",
];

const normalizeLeadField = (item: LeadItem, ...keys: Array<keyof LeadItem>) => {
  for (const key of keys) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
};
const toTimestamp = (value?: string) => {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};
const minutesSince = (value?: string) =>
  toTimestamp(value)
    ? Math.floor((Date.now() - toTimestamp(value)) / 60000)
    : null;
const normalizeStageLabel = (stage?: string) =>
  (stage || "nuevo").replaceAll("_", " ");
const getStageBadgeVariant = (
  stage?: string,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (stage) {
    case "ganado":
      return "default";
    case "perdido":
      return "destructive";
    case "demo_agendada":
    case "propuesta_enviada":
      return "secondary";
    default:
      return "outline";
  }
};

const SuperadminLeadsPipeline: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenantSlug, setTenantSlug] = useState(
    () => searchParams.get("tenant_slug") || "",
  );
  const [sinceDays, setSinceDays] = useState(() =>
    Number(searchParams.get("since_days") || 30),
  );
  const [sortBy, setSortBy] = useState<"recent" | "relevance">(() =>
    searchParams.get("sort") === "relevance" ? "relevance" : "recent",
  );
  const [slaOnly, setSlaOnly] = useState(
    () => searchParams.get("sla_only") === "1",
  );
  const [leadSearch, setLeadSearch] = useState(
    () => searchParams.get("q") || "",
  );
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState<LeadStage | null>(null);
  const [data, setData] = useState<PipelineResponse>({});
  const [interactions, setInteractions] = useState<Array<any>>([]);
  const [catalogQuality, setCatalogQuality] = useState<Array<any>>([]);
  const [strategicOverview, setStrategicOverview] = useState<any>(null);
  const [selectedLeadKeys, setSelectedLeadKeys] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState<LeadStage>("contactado");
  const [selectedTimelineLead, setSelectedTimelineLead] =
    useState<LeadItem | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<Array<any>>([]);
  const [timelineNote, setTimelineNote] = useState("");
  const [playbookPreview, setPlaybookPreview] = useState<any[]>([]);
  const [tenantBoardSlug, setTenantBoardSlug] = useState("");
  const [tenantLeads, setTenantLeads] = useState<any[]>([]);
  const [tenantStageFilter, setTenantStageFilter] = useState("");
  const [tenantBulkStage, setTenantBulkStage] =
    useState<LeadStage>("contactado");
  const [tenantSelectedLeadKeys, setTenantSelectedLeadKeys] = useState<
    string[]
  >([]);
  const [employeeScopeUserId, setEmployeeScopeUserId] = useState("");
  const [employeeCategorias, setEmployeeCategorias] = useState("");
  const [employeeZonas, setEmployeeZonas] = useState("");
  const [employeePermisos, setEmployeePermisos] = useState("");
  const [heatmapData, setHeatmapData] = useState<{
    top_categories?: any[];
    top_zones?: any[];
    heatmap_points?: any[];
  } | null>(null);
  const [heatmapCategoryFilter, setHeatmapCategoryFilter] = useState("");
  const [heatmapZoneFilter, setHeatmapZoneFilter] = useState("");
  const [heatmapTypeFilter, setHeatmapTypeFilter] = useState("");
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<
    Record<string, any[]>
  >({});
  const [tenantEncuestas, setTenantEncuestas] = useState<any[]>([]);
  const [globalEncuestas, setGlobalEncuestas] = useState<any[]>([]);
  const [realtimeAi, setRealtimeAi] = useState<any>(null);
  const [tenantHealth, setTenantHealth] = useState<any[]>([]);
  const [employeeWorkload, setEmployeeWorkload] = useState<any[]>([]);
  const [balanceLoadEnabled, setBalanceLoadEnabled] = useState(true);
  const [requiredPermission, setRequiredPermission] = useState("");
  const [unreadSummary, setUnreadSummary] = useState<{
    total_tickets_with_unread?: number;
    items?: any[];
  }>({ total_tickets_with_unread: 0, items: [] });
  const [unreadSinceMinutes, setUnreadSinceMinutes] = useState(60);

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const payload = await enterpriseService.getLeadsPipeline({
        tenant_slug: tenantSlug || undefined,
        since_days: sinceDays,
      });
      setData(payload || {});
      const interactionsPayload = await enterpriseService.getLeadInteractions({
        tenant_slug: tenantSlug || undefined,
        limit: 20,
        since_days: sinceDays,
      });
      setInteractions(
        interactionsPayload?.items || interactionsPayload?.interactions || [],
      );
      const quality = await enterpriseService.getCatalogQuality({
        tenant_slug: tenantSlug || undefined,
        limit: 100,
      });
      setCatalogQuality(quality?.items || []);
      const strategic = await enterpriseService.getStrategicOverview({
        since_days: sinceDays,
      });
      setStrategicOverview(strategic || null);
      const heatmap =
        await enterpriseService.getStrategicHeatmapCategoriesZones({
          since_days: sinceDays,
        });
      setHeatmapData(heatmap || null);
      const realtime = await enterpriseService.getRealtimeAiOverview({
        minutes: 60,
      });
      setRealtimeAi(realtime || null);
      const surveys = await enterpriseService.getGlobalEncuestasOverview();
      setGlobalEncuestas(surveys?.items || []);
      const health = await enterpriseService.getTenantHealth({
        since_days: sinceDays,
      });
      setTenantHealth(health?.items || []);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar el panel de leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
    trackFrontendEvent("catalog_quality_queue_opened");
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (tenantSlug) next.set("tenant_slug", tenantSlug);
    next.set("since_days", String(sinceDays));
    next.set("sort", sortBy);
    if (slaOnly) next.set("sla_only", "1");
    if (leadSearch.trim()) next.set("q", leadSearch.trim());
    setSearchParams(next);
  }, [tenantSlug, sinceDays, sortBy, slaOnly, leadSearch, setSearchParams]);

  useEffect(() => {
    if (slaOnly) trackFrontendEvent("lead_sla_filter_enabled");
  }, [slaOnly]);

  const items = data.items || [];
  const filteredItems = useMemo(() => {
    const query = leadSearch.trim().toLowerCase();
    const base = items.filter((item) => {
      const matchesStage = activeStage
        ? (item.stage || "nuevo") === activeStage
        : true;
      if (!matchesStage) return false;
      if (!query) return true;
      const haystack = [
        normalizeLeadField(item, "nombre", "name"),
        normalizeLeadField(item, "tenant_slug"),
        normalizeLeadField(item, "email"),
        normalizeLeadField(item, "telefono", "phone"),
        normalizeLeadField(item, "nro_ticket", "ticket_id"),
        normalizeLeadField(item, "stage"),
        normalizeLeadField(item, "ticket_type"),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    const sorted =
      sortBy === "relevance"
        ? base.sort(
            (a, b) => (b.relevance_score || 0) - (a.relevance_score || 0),
          )
        : base.sort(
            (a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at),
          );
    return sorted;
  }, [items, activeStage, sortBy, leadSearch]);

  const filteredInteractions = interactions
    .filter((entry) => (slaOnly ? Boolean(entry.sla_breached) : true))
    .slice()
    .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));

  const leadKey = (item: LeadItem) =>
    `${item.ticket_type || "municipio"}:${item.nro_ticket || item.ticket_id || item.id || ""}`;
  const handleToggleLeadSelection = (item: LeadItem) => {
    const key = leadKey(item);
    setSelectedLeadKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleStageChange = async (item: LeadItem, nextStage: string) => {
    const ticketId = item.nro_ticket || item.ticket_id;
    if (!ticketId) return;
    const note =
      window.prompt("Nota de cambio de etapa (opcional):", "") || undefined;
    await enterpriseService.updateLeadStage(ticketId, {
      stage: nextStage,
      note,
      ticket_type: item.ticket_type || "municipio",
    });
    fetchPipeline();
  };

  const handleBulkStageUpdate = async () => {
    const updates = filteredItems
      .filter((item) => selectedLeadKeys.includes(leadKey(item)))
      .map((item) => ({
        ticket_type: (item.ticket_type || "municipio") as string,
        ticket_id: (item.nro_ticket || item.ticket_id) as string | number,
      }))
      .filter((it) => it.ticket_id);
    if (!updates.length) return toast.error("Seleccioná leads válidos.");
    await enterpriseService.bulkUpdateLeadStage({
      stage: String(bulkStage),
      updates,
    });
    setSelectedLeadKeys([]);
    fetchPipeline();
  };

  const handleOpenTimeline = async (item: LeadItem) => {
    const ticketId = item.nro_ticket || item.ticket_id;
    const ticketType = item.ticket_type || "municipio";
    if (!ticketId) return;
    setSelectedTimelineLead(item);
    const resp = await enterpriseService.getLeadTimeline(ticketType, ticketId);
    setTimelineEvents(resp?.items || resp?.timeline || []);
  };

  const handleSuggestAssignee = async (item: LeadItem) => {
    const slug = item.tenant_slug;
    if (!slug) return toast.error("Lead sin tenant_slug para sugerencia.");
    const categoria =
      window.prompt("Categoría para sugerencia:", "") || undefined;
    const zona = window.prompt("Zona para sugerencia:", "") || undefined;
    try {
      const response = await enterpriseService.suggestAssignee(slug, {
        categoria,
        zona,
        required_permission: requiredPermission || undefined,
      });
      const suggestions = response?.items || response?.suggestions || [];
      const ordered = balanceLoadEnabled
        ? suggestions
            .slice()
            .sort(
              (a: any, b: any) =>
                (a?.workload_open_tickets || 0) -
                (b?.workload_open_tickets || 0),
            )
        : suggestions;
      setAssigneeSuggestions((prev) => ({
        ...prev,
        [leadKey(item)]: ordered.slice(0, 3),
      }));
      toast.success("Sugerencias cargadas.");
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron obtener sugerencias de responsable.");
    }
  };

  const handleAddTimelineNote = async () => {
    if (!selectedTimelineLead || !timelineNote.trim()) return;
    const ticketId =
      selectedTimelineLead.nro_ticket || selectedTimelineLead.ticket_id;
    const ticketType = selectedTimelineLead.ticket_type || "municipio";
    if (!ticketId) return;
    await enterpriseService.addLeadTimelineNote(ticketType, ticketId, {
      note: timelineNote.trim(),
    });
    setTimelineNote("");
    handleOpenTimeline(selectedTimelineLead);
  };

  const handleAutoAssign = async (lead: any) => {
    const slug = tenantBoardSlug.trim() || lead.tenant_slug;
    const ticketType = lead.ticket_type || "municipio";
    const ticketId = lead.nro_ticket || lead.ticket_id;
    if (!slug || !ticketId)
      return toast.error("Faltan datos para autoasignar.");
    try {
      const resp = await enterpriseService.autoAssignTenantTicket(
        slug,
        ticketType,
        ticketId,
        { required_permission: requiredPermission || undefined },
      );
      const employee =
        resp?.employee?.name ||
        resp?.employee?.nombre ||
        "Responsable asignado";
      toast.success(
        `${employee} (score ${resp?.score ?? "—"} · carga ${resp?.workload_open_tickets ?? "—"})`,
      );
    } catch (error) {
      console.error(error);
      toast.error("No se pudo autoasignar.");
    }
  };
  const handleRunPlaybook = async (dryRun: boolean) => {
    if (!dryRun) {
      const confirmed = window.confirm(
        "¿Confirmás ejecutar playbook en productivo?",
      );
      if (!confirmed) return;
    }
    const resp = await enterpriseService.runLeadsPlaybook({
      dry_run: dryRun,
      only_sla_breached: true,
      limit: 50,
    });
    setPlaybookPreview(resp?.items || []);
  };

  const openWhatsApp = (phone: string) =>
    window.open(
      `https://wa.me/${phone.replace(/\D/g, "")}`,
      "_blank",
      "noopener,noreferrer",
    );

  const fetchTenantLeads = async () => {
    if (!tenantBoardSlug.trim()) return;
    try {
      const slug = tenantBoardSlug.trim();
      const response = await enterpriseService.getTenantLeads(slug, {
        stage: tenantStageFilter || undefined,
        limit: 100,
      });
      setTenantLeads(response?.items || response?.leads || []);
      const tenantSurveys =
        await enterpriseService.getTenantEncuestasOverview(slug);
      setTenantEncuestas(tenantSurveys?.items || []);
      const workload = await enterpriseService.getTenantEmployeesWorkload(slug);
      setEmployeeWorkload(workload?.items || []);
      await fetchUnreadSummary(slug);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar leads del tenant.");
    }
  };

  const handleTenantBulkStage = async () => {
    if (!tenantBoardSlug.trim()) return;
    const updates = tenantLeads
      .filter((lead) => tenantSelectedLeadKeys.includes(leadKey(lead)))
      .map((lead) => ({
        ticket_type: (lead.ticket_type || "municipio") as string,
        ticket_id: (lead.nro_ticket || lead.ticket_id) as string | number,
      }))
      .filter((item) => item.ticket_id);
    if (!updates.length) {
      toast.error("Seleccioná leads tenant para bulk.");
      return;
    }
    try {
      await enterpriseService.bulkUpdateTenantLeadStage(
        tenantBoardSlug.trim(),
        { stage: String(tenantBulkStage), updates },
      );
      toast.success("Tenant bulk stage aplicado.");
      setTenantSelectedLeadKeys([]);
      fetchTenantLeads();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo aplicar bulk tenant.");
    }
  };

  const fetchUnreadSummary = async (slugOverride?: string) => {
    const slug = (slugOverride || tenantBoardSlug || tenantSlug).trim();
    if (!slug) return;
    try {
      const summary = await enterpriseService.getTenantUnreadSummary(slug, {
        since_minutes: unreadSinceMinutes,
      });
      setUnreadSummary({
        total_tickets_with_unread: summary?.total_tickets_with_unread || 0,
        items: summary?.items || [],
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const slug = (tenantBoardSlug || tenantSlug).trim();
    if (!slug) return;
    fetchUnreadSummary(slug);
    const timer = window.setInterval(() => fetchUnreadSummary(slug), 30000);
    return () => window.clearInterval(timer);
  }, [tenantBoardSlug, tenantSlug, unreadSinceMinutes]);

  const handleUpdateEmployeeScope = async () => {
    if (!employeeScopeUserId.trim()) return;
    const parseCsv = (value: string) =>
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    try {
      await enterpriseService.updateEmployeeScope(employeeScopeUserId.trim(), {
        categorias: parseCsv(employeeCategorias),
        zonas: parseCsv(employeeZonas),
        permisos: parseCsv(employeePermisos),
      });
      toast.success("Scope de empleado actualizado.");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar scope de empleado.");
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>CRM Superadmin · Leads multitenant</CardTitle>
          <CardDescription>
            Pipeline consolidado, funnel, bulk stage, timeline y playbooks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <input
              className="h-10 rounded border px-3 text-sm"
              placeholder="tenant_slug"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
            />
            <input
              className="h-10 min-w-[220px] rounded border px-3 text-sm"
              placeholder="Buscar lead, tenant, email, teléfono o ticket"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
            />
            <input
              className="h-10 w-24 rounded border px-3 text-sm"
              type="number"
              value={sinceDays}
              onChange={(e) => setSinceDays(Number(e.target.value) || 30)}
            />
            <select
              className="h-10 rounded border px-3 text-sm"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "recent" | "relevance")
              }
            >
              <option value="recent">Más recientes</option>
              <option value="relevance">Mayor relevancia</option>
            </select>
            <Button
              variant={slaOnly ? "default" : "outline"}
              onClick={() => setSlaOnly((v) => !v)}
            >
              {slaOnly ? "Solo SLA vencido" : "Filtrar SLA vencido"}
            </Button>
            <Button onClick={fetchPipeline} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">
                  {strategicOverview?.total_leads ?? data.total ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">
                  {strategicOverview?.open_leads ?? "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">SLA</p>
                <p className="text-2xl font-bold">
                  {strategicOverview?.sla_breached ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Win rate</p>
                <p className="text-2xl font-bold">
                  {typeof strategicOverview?.win_rate === "number"
                    ? `${(strategicOverview.win_rate * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Conv.</p>
                <p className="text-2xl font-bold">
                  {((data.conversion_rate || 0) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Avg resp</p>
                <p className="text-2xl font-bold">
                  {data.avg_first_response_seconds
                    ? `${Math.round(data.avg_first_response_seconds)}s`
                    : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">
                  Realtime sesiones
                </p>
                <p className="text-2xl font-bold">
                  {realtimeAi?.active_sessions ?? "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">
                  Cobertura asignación
                </p>
                <p className="text-2xl font-bold">
                  {typeof realtimeAi?.coverage_ratio === "number"
                    ? `${(realtimeAi.coverage_ratio * 100).toFixed(0)}%`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Interacciones (lead_score desc)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredInteractions.map((entry, i) => (
                <div
                  key={`int-${i}`}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{entry.lead_name || "Lead"}</p>
                    {entry.sla_breached ? (
                      <Badge variant="destructive">SLA</Badge>
                    ) : null}
                  </div>
                  <p
                    className="text-xs text-muted-foreground"
                    title={`urgencia: ${entry.urgency_score ?? "—"} · completitud: ${entry.completeness_score ?? "—"} · actividad: ${entry.activity_score ?? "—"}`}
                  >
                    lead_score: {entry.lead_score ?? "—"} · relevance:{" "}
                    {entry.relevance_score ?? "—"}
                  </p>
                  {entry.last_message ? (
                    <p className="text-xs mt-1">{entry.last_message}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cola de calidad de catálogo</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Tenant</th>
                    <th className="p-2">Producto</th>
                    <th className="p-2">Confidence</th>
                    <th className="p-2">Issues</th>
                    <th className="p-2">Review</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogQuality.map((item, idx) => {
                    const c = item.confidence_score;
                    const status =
                      item.review_required ||
                      (typeof c === "number" && c < 0.65)
                        ? { label: "Crítico", cls: "bg-red-100 text-red-700" }
                        : typeof c === "number" && c < 0.85
                          ? {
                              label: "Revisar",
                              cls: "bg-amber-100 text-amber-700",
                            }
                          : typeof c === "number" &&
                              c >= 0.85 &&
                              Array.isArray(item.quality_issues) &&
                              item.quality_issues.length
                            ? {
                                label: "Observación",
                                cls: "bg-blue-100 text-blue-700",
                              }
                            : {
                                label: "OK",
                                cls: "bg-emerald-100 text-emerald-700",
                              };
                    return (
                      <tr key={`q-${idx}`} className="border-b">
                        <td className="p-2">{item.tenant_slug || "—"}</td>
                        <td className="p-2">{item.product_name || "—"}</td>
                        <td className="p-2">
                          {typeof c === "number"
                            ? `${(c * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="p-2">
                          {Array.isArray(item.quality_issues) &&
                          item.quality_issues.length
                            ? item.quality_issues.join(", ")
                            : "—"}
                        </td>
                        <td className="p-2">
                          {item.review_required ? (
                            <Badge variant="destructive">Requerida</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${status.cls}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mapa de calor estratégico (CEO)</CardTitle>
              <CardDescription>
                Filtros por categoría/zona/tipo con top categorías y zonas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <input
                  className="h-9 rounded border px-3 text-sm"
                  placeholder="Filtrar categoría"
                  value={heatmapCategoryFilter}
                  onChange={(e) => setHeatmapCategoryFilter(e.target.value)}
                />
                <input
                  className="h-9 rounded border px-3 text-sm"
                  placeholder="Filtrar zona"
                  value={heatmapZoneFilter}
                  onChange={(e) => setHeatmapZoneFilter(e.target.value)}
                />
                <input
                  className="h-9 rounded border px-3 text-sm"
                  placeholder="Filtrar tipo"
                  value={heatmapTypeFilter}
                  onChange={(e) => setHeatmapTypeFilter(e.target.value)}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Top categorías
                  </p>
                  <div className="space-y-1">
                    {(heatmapData?.top_categories || []).map(
                      (c: any, idx: number) => (
                        <button
                          key={`cat-${idx}`}
                          className="flex w-full items-center justify-between rounded border px-2 py-1 text-sm"
                          onClick={() =>
                            setHeatmapCategoryFilter(c?.categoria || "")
                          }
                        >
                          <span>{c?.categoria || "—"}</span>
                          <Badge variant="outline">{c?.count ?? 0}</Badge>
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Top zonas
                  </p>
                  <div className="space-y-1">
                    {(heatmapData?.top_zones || []).map(
                      (z: any, idx: number) => (
                        <button
                          key={`zone-${idx}`}
                          className="flex w-full items-center justify-between rounded border px-2 py-1 text-sm"
                          onClick={() => setHeatmapZoneFilter(z?.zona || "")}
                        >
                          <span>{z?.zona || "—"}</span>
                          <Badge variant="outline">{z?.count ?? 0}</Badge>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded border p-3 text-sm text-muted-foreground">
                Points visibles:{" "}
                {
                  (heatmapData?.heatmap_points || []).filter(
                    (p: any) =>
                      (!heatmapCategoryFilter ||
                        (p?.categoria || "")
                          .toLowerCase()
                          .includes(heatmapCategoryFilter.toLowerCase())) &&
                      (!heatmapZoneFilter ||
                        (p?.zona || "")
                          .toLowerCase()
                          .includes(heatmapZoneFilter.toLowerCase())) &&
                      (!heatmapTypeFilter ||
                        (p?.tipo || "")
                          .toLowerCase()
                          .includes(heatmapTypeFilter.toLowerCase())),
                  ).length
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                {filteredItems.length} resultados visibles
                {leadSearch.trim() ? ` para “${leadSearch.trim()}”` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 overflow-x-auto">
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 rounded border px-2 text-sm"
                  value={bulkStage}
                  onChange={(e) => setBulkStage(e.target.value as LeadStage)}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleBulkStageUpdate}>
                  Bulk stage
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRunPlaybook(true)}
                >
                  Playbook preview
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRunPlaybook(false)}
                >
                  Playbook ejecutar
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Sel</th>
                    <th className="p-2">Lead</th>
                    <th className="p-2">Tenant</th>
                    <th className="p-2">Stage</th>
                    <th className="p-2">Contacto</th>
                    <th className="p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const name =
                      normalizeLeadField(item, "nombre", "name") ||
                      "Sin nombre";
                    const phone = normalizeLeadField(item, "telefono", "phone");
                    const email = normalizeLeadField(item, "email");
                    const mins = minutesSince(item.created_at);
                    return (
                      <tr key={leadKey(item)} className="border-b align-top">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedLeadKeys.includes(leadKey(item))}
                            onChange={() => handleToggleLeadSelection(item)}
                          />
                        </td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <div className="font-medium">{name}</div>
                            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                              <Badge variant="outline">
                                {normalizeLeadField(item, "ticket_type") ||
                                  "municipio"}
                              </Badge>
                              {item.nro_ticket || item.ticket_id ? (
                                <Badge variant="outline">
                                  #
                                  {normalizeLeadField(
                                    item,
                                    "nro_ticket",
                                    "ticket_id",
                                  )}
                                </Badge>
                              ) : null}
                              {typeof item.relevance_score === "number" ? (
                                <Badge variant="outline">
                                  score {item.relevance_score}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="space-y-1">
                            <div>
                              {normalizeLeadField(item, "tenant_slug") || "—"}
                            </div>
                            {typeof mins === "number" ? (
                              <div className="text-xs text-muted-foreground">
                                hace {mins} min
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="space-y-2">
                            <Badge
                              variant={getStageBadgeVariant(
                                normalizeLeadField(item, "stage") || "nuevo",
                              )}
                              className="capitalize"
                            >
                              {normalizeStageLabel(
                                normalizeLeadField(item, "stage") || "nuevo",
                              )}
                            </Badge>
                            <select
                              className="h-8 rounded border px-2 text-xs"
                              value={
                                normalizeLeadField(item, "stage") || "nuevo"
                              }
                              onChange={(e) =>
                                handleStageChange(item, e.target.value)
                              }
                            >
                              {STAGES.map((s) => (
                                <option key={`${leadKey(item)}-${s}`} value={s}>
                                  {normalizeStageLabel(s)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="space-y-2">
                            <div className="text-sm">
                              {email || phone || "—"}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {phone ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openWhatsApp(phone)}
                                >
                                  <MessageCircle className="mr-2 h-4 w-4" />
                                  WhatsApp
                                </Button>
                              ) : null}
                              {phone ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigator.clipboard
                                      .writeText(phone)
                                      .then(() =>
                                        toast.success("Teléfono copiado"),
                                      )
                                  }
                                >
                                  <Phone className="mr-2 h-4 w-4" />
                                  Copiar tel.
                                </Button>
                              ) : null}
                              {email ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      `mailto:${email}`,
                                      "_blank",
                                      "noopener,noreferrer",
                                    )
                                  }
                                >
                                  <Mail className="mr-2 h-4 w-4" />
                                  Email
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  navigator.clipboard
                                    .writeText(
                                      [email, phone]
                                        .filter(Boolean)
                                        .join(" | "),
                                    )
                                    .then(() => toast.success("Datos copiados"))
                                }
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar ficha
                              </Button>
                            </div>
                            {(assigneeSuggestions[leadKey(item)] || [])
                              .length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {assigneeSuggestions[leadKey(item)].map(
                                  (s: any, idx: number) => (
                                    <span
                                      key={`asg-${idx}`}
                                      className="inline-flex rounded border px-1.5 py-0.5 text-[10px]"
                                    >
                                      {s?.name || s?.nombre || "responsable"} (
                                      {s?.score ?? "—"})
                                    </span>
                                  ),
                                )}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenTimeline(item)}
                            >
                              Timeline
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuggestAssignee(item)}
                            >
                              Sugerir responsable
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline de lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedTimelineLead ? (
                <p className="text-xs text-muted-foreground">
                  {normalizeLeadField(selectedTimelineLead, "nombre", "name")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Elegí un lead para ver timeline.
                </p>
              )}
              <div className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded border px-3 text-sm"
                  value={timelineNote}
                  onChange={(e) => setTimelineNote(e.target.value)}
                  placeholder="Agregar nota"
                />
                <Button size="sm" onClick={handleAddTimelineNote}>
                  Guardar
                </Button>
              </div>
              {timelineEvents.map((evt, idx) => (
                <div
                  key={`t-${idx}`}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <p className="font-medium">
                    {evt.event_type || "evento"}{" "}
                    {evt.stage ? `· ${evt.stage}` : ""}
                  </p>
                  {evt.note ? <p className="text-xs">{evt.note}</p> : null}
                  {evt.created_at ? (
                    <p className="text-[11px] text-muted-foreground">
                      {evt.created_at}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultado playbook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {playbookPreview.map((item, idx) => (
                <div
                  key={`pb-${idx}`}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <p className="font-medium">Ticket #{item.ticket_id || "—"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(item.actions || []).map((a: any, i: number) => (
                      <span
                        key={`a-${i}`}
                        className="inline-flex rounded border px-2 py-0.5 text-xs"
                      >
                        {a.channel || "canal"} · {a.status || "pending"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tenant board operativo</CardTitle>
              <CardDescription>
                Acciones masivas por tenant + timeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <input
                  className="h-9 rounded border px-3 text-sm"
                  placeholder="tenant slug"
                  value={tenantBoardSlug}
                  onChange={(e) => setTenantBoardSlug(e.target.value)}
                />
                <select
                  className="h-9 rounded border px-2 text-sm"
                  value={tenantStageFilter}
                  onChange={(e) => setTenantStageFilter(e.target.value)}
                >
                  <option value="">todas etapas</option>
                  {STAGES.map((s) => (
                    <option key={`tenant-stage-${s}`} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={fetchTenantLeads}>
                  Cargar tenant leads
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={balanceLoadEnabled}
                    onChange={(e) => setBalanceLoadEnabled(e.target.checked)}
                  />{" "}
                  Balancear carga
                </label>
                <input
                  className="h-9 rounded border px-3 text-sm"
                  placeholder="permiso requerido (opcional)"
                  value={requiredPermission}
                  onChange={(e) => setRequiredPermission(e.target.value)}
                />
                <select
                  className="h-9 rounded border px-2 text-sm"
                  value={tenantBulkStage}
                  onChange={(e) =>
                    setTenantBulkStage(e.target.value as LeadStage)
                  }
                >
                  {STAGES.map((s) => (
                    <option key={`tenant-bulk-${s}`} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTenantBulkStage}
                >
                  Aplicar bulk tenant
                </Button>
              </div>

              <div className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Bell className="h-4 w-4" /> Notificaciones admin
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-8 w-20 rounded border px-2 text-xs"
                      type="number"
                      value={unreadSinceMinutes}
                      onChange={(e) =>
                        setUnreadSinceMinutes(Number(e.target.value) || 60)
                      }
                    />
                    <Badge
                      variant={
                        Number(unreadSummary?.total_tickets_with_unread || 0) >
                        0
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {unreadSummary?.total_tickets_with_unread || 0}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  {(unreadSummary?.items || [])
                    .slice(0, 8)
                    .map((item: any, idx: number) => (
                      <div
                        key={`unread-${idx}`}
                        className="flex items-center justify-between rounded border px-2 py-1"
                      >
                        <span>
                          {item?.ticket_type || "ticket"} #
                          {item?.ticket_id || "—"}
                        </span>
                        <span className="text-muted-foreground">
                          {item?.unread_count || 0} ·{" "}
                          {item?.last_message_at || "—"}
                        </span>
                      </div>
                    ))}
                  {!(unreadSummary?.items || []).length ? (
                    <p className="text-muted-foreground">
                      Sin tickets con mensajes no-admin.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-2">Sel</th>
                      <th className="p-2">Lead</th>
                      <th className="p-2">Etapa</th>
                      <th className="p-2">Timeline</th>
                      <th className="p-2">Delegación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantLeads.map((lead, idx) => (
                      <tr key={`tenant-lead-${idx}`} className="border-b">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={tenantSelectedLeadKeys.includes(
                              leadKey(lead),
                            )}
                            onChange={() =>
                              setTenantSelectedLeadKeys((prev) =>
                                prev.includes(leadKey(lead))
                                  ? prev.filter((k) => k !== leadKey(lead))
                                  : [...prev, leadKey(lead)],
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          {normalizeLeadField(lead, "nombre", "name") ||
                            "Sin nombre"}{" "}
                          #{lead.nro_ticket || lead.ticket_id || "—"}
                        </td>
                        <td className="p-2">
                          {normalizeLeadField(lead, "stage") || "nuevo"}
                          {lead?.assigned_employee_workload_open_tickets !==
                          undefined ? (
                            <Badge variant="outline" className="ml-2">
                              carga{" "}
                              {lead.assigned_employee_workload_open_tickets}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenTimeline(lead)}
                          >
                            Abrir
                          </Button>
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAutoAssign(lead)}
                          >
                            Autoasignar empleado
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Encuestas del tenant</CardTitle>
              <CardDescription>
                Resumen operativo con cantidad de respuestas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {tenantEncuestas.length ? (
                tenantEncuestas.map((item, idx) => (
                  <div
                    key={`tenant-survey-${idx}`}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <span>
                      {item?.name || item?.encuesta || `Encuesta ${idx + 1}`}
                    </span>
                    <Badge variant="outline">
                      {item?.responses ?? item?.count ?? 0} respuestas
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  Cargá un tenant para ver encuestas.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Encuestas por tenant (global)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Tenant</th>
                    <th className="p-2">Encuesta</th>
                    <th className="p-2">Respuestas</th>
                  </tr>
                </thead>
                <tbody>
                  {globalEncuestas
                    .slice()
                    .sort((a, b) => (b?.responses || 0) - (a?.responses || 0))
                    .map((item, idx) => (
                      <tr key={`global-survey-${idx}`} className="border-b">
                        <td className="p-2">{item?.tenant_slug || "—"}</td>
                        <td className="p-2">
                          {item?.name || item?.encuesta || "—"}
                        </td>
                        <td className="p-2">
                          {item?.responses ?? item?.count ?? 0}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Carga de empleados (tenant)</CardTitle>
              <CardDescription>
                Open tickets por empleado para balanceo operativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Empleado</th>
                    <th className="p-2">Categorías</th>
                    <th className="p-2">Zonas</th>
                    <th className="p-2">Carga abierta</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeWorkload.map((emp, idx) => (
                    <tr key={`workload-${idx}`} className="border-b">
                      <td className="p-2">{emp?.name || emp?.nombre || "—"}</td>
                      <td className="p-2">
                        {Array.isArray(emp?.categorias)
                          ? emp.categorias.join(", ")
                          : "—"}
                      </td>
                      <td className="p-2">
                        {Array.isArray(emp?.zonas) ? emp.zonas.join(", ") : "—"}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">
                          {emp?.workload_open_tickets ?? 0}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tenant Health (CEO)</CardTitle>
              <CardDescription>
                Ranking por health_score, win_rate, SLA y encuestas.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Tenant</th>
                    <th className="p-2">Health</th>
                    <th className="p-2">Win rate</th>
                    <th className="p-2">SLA breached</th>
                    <th className="p-2">Encuestas</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantHealth
                    .slice()
                    .sort(
                      (a, b) => (b?.health_score || 0) - (a?.health_score || 0),
                    )
                    .map((row, idx) => (
                      <tr key={`health-${idx}`} className="border-b">
                        <td className="p-2">{row?.tenant_slug || "—"}</td>
                        <td className="p-2">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${(row?.health_score || 0) >= 0.8 ? "bg-emerald-100 text-emerald-700" : (row?.health_score || 0) >= 0.6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                          >
                            {typeof row?.health_score === "number"
                              ? `${(row.health_score * 100).toFixed(0)}%`
                              : "—"}
                          </span>
                        </td>
                        <td className="p-2">
                          {typeof row?.win_rate === "number"
                            ? `${(row.win_rate * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="p-2">{row?.sla_breached ?? 0}</td>
                        <td className="p-2">{row?.survey_responses ?? 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editor scope de empleado</CardTitle>
              <CardDescription>
                Chips CSV: categorías, zonas y permisos por rol.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                className="h-9 w-full rounded border px-3 text-sm"
                placeholder="user_id"
                value={employeeScopeUserId}
                onChange={(e) => setEmployeeScopeUserId(e.target.value)}
              />
              <input
                className="h-9 w-full rounded border px-3 text-sm"
                placeholder="categorías (coma separadas)"
                value={employeeCategorias}
                onChange={(e) => setEmployeeCategorias(e.target.value)}
              />
              <input
                className="h-9 w-full rounded border px-3 text-sm"
                placeholder="zonas (coma separadas)"
                value={employeeZonas}
                onChange={(e) => setEmployeeZonas(e.target.value)}
              />
              <input
                className="h-9 w-full rounded border px-3 text-sm"
                placeholder="permisos (coma separadas)"
                value={employeePermisos}
                onChange={(e) => setEmployeePermisos(e.target.value)}
              />
              <Button size="sm" onClick={handleUpdateEmployeeScope}>
                Guardar scope
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </section>
  );
};

export default SuperadminLeadsPipeline;
