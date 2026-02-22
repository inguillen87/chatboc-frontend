import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { enterpriseService } from '@/services/enterpriseService';
import { toast } from 'sonner';
import { Copy, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';

type LeadStage = 'nuevo' | 'contactado' | 'calificado' | 'demo_agendada' | 'propuesta_enviada' | 'ganado' | 'perdido' | string;
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
  ticket_type?: 'municipio' | 'pyme' | string;
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
const STAGES: LeadStage[] = ['nuevo', 'contactado', 'calificado', 'demo_agendada', 'propuesta_enviada', 'ganado', 'perdido'];

const normalizeLeadField = (item: LeadItem, ...keys: Array<keyof LeadItem>) => {
  for (const key of keys) {
    const v = item[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
};
const toTimestamp = (value?: string) => {
  const t = value ? new Date(value).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};
const minutesSince = (value?: string) => (toTimestamp(value) ? Math.floor((Date.now() - toTimestamp(value)) / 60000) : null);

const SuperadminLeadsPipeline: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenantSlug, setTenantSlug] = useState(() => searchParams.get('tenant_slug') || '');
  const [sinceDays, setSinceDays] = useState(() => Number(searchParams.get('since_days') || 30));
  const [sortBy, setSortBy] = useState<'recent' | 'relevance'>(() => (searchParams.get('sort') === 'relevance' ? 'relevance' : 'recent'));
  const [slaOnly, setSlaOnly] = useState(() => searchParams.get('sla_only') === '1');
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState<LeadStage | null>(null);
  const [data, setData] = useState<PipelineResponse>({});
  const [interactions, setInteractions] = useState<Array<any>>([]);
  const [catalogQuality, setCatalogQuality] = useState<Array<any>>([]);
  const [strategicOverview, setStrategicOverview] = useState<any>(null);
  const [selectedLeadKeys, setSelectedLeadKeys] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState<LeadStage>('contactado');
  const [selectedTimelineLead, setSelectedTimelineLead] = useState<LeadItem | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<Array<any>>([]);
  const [timelineNote, setTimelineNote] = useState('');
  const [playbookPreview, setPlaybookPreview] = useState<any[]>([]);

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const payload = await enterpriseService.getLeadsPipeline({ tenant_slug: tenantSlug || undefined, since_days: sinceDays });
      setData(payload || {});
      const interactionsPayload = await enterpriseService.getLeadInteractions({ tenant_slug: tenantSlug || undefined, limit: 20, since_days: sinceDays });
      setInteractions(interactionsPayload?.items || interactionsPayload?.interactions || []);
      const quality = await enterpriseService.getCatalogQuality({ tenant_slug: tenantSlug || undefined, limit: 100 });
      setCatalogQuality(quality?.items || []);
      const strategic = await enterpriseService.getStrategicOverview({ since_days: sinceDays });
      setStrategicOverview(strategic || null);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el panel de leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
    trackFrontendEvent('catalog_quality_queue_opened');
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (tenantSlug) next.set('tenant_slug', tenantSlug);
    next.set('since_days', String(sinceDays));
    next.set('sort', sortBy);
    if (slaOnly) next.set('sla_only', '1');
    setSearchParams(next);
  }, [tenantSlug, sinceDays, sortBy, slaOnly, setSearchParams]);

  useEffect(() => {
    if (slaOnly) trackFrontendEvent('lead_sla_filter_enabled');
  }, [slaOnly]);

  const items = data.items || [];
  const filteredItems = useMemo(() => {
    const base = activeStage ? items.filter((item) => (item.stage || 'nuevo') === activeStage) : items.slice();
    const sorted = sortBy === 'relevance'
      ? base.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
      : base.sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));
    return sorted;
  }, [items, activeStage, sortBy]);

  const filteredInteractions = interactions
    .filter((entry) => (slaOnly ? Boolean(entry.sla_breached) : true))
    .slice()
    .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0));

  const leadKey = (item: LeadItem) => `${item.ticket_type || 'municipio'}:${item.nro_ticket || item.ticket_id || item.id || ''}`;
  const handleToggleLeadSelection = (item: LeadItem) => {
    const key = leadKey(item);
    setSelectedLeadKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleStageChange = async (item: LeadItem, nextStage: string) => {
    const ticketId = item.nro_ticket || item.ticket_id;
    if (!ticketId) return;
    const note = window.prompt('Nota de cambio de etapa (opcional):', '') || undefined;
    await enterpriseService.updateLeadStage(ticketId, { stage: nextStage, note, ticket_type: item.ticket_type || 'municipio' });
    fetchPipeline();
  };

  const handleBulkStageUpdate = async () => {
    const updates = filteredItems
      .filter((item) => selectedLeadKeys.includes(leadKey(item)))
      .map((item) => ({ ticket_type: (item.ticket_type || 'municipio') as string, ticket_id: (item.nro_ticket || item.ticket_id) as string | number }))
      .filter((it) => it.ticket_id);
    if (!updates.length) return toast.error('Seleccioná leads válidos.');
    await enterpriseService.bulkUpdateLeadStage({ stage: String(bulkStage), updates });
    setSelectedLeadKeys([]);
    fetchPipeline();
  };

  const handleOpenTimeline = async (item: LeadItem) => {
    const ticketId = item.nro_ticket || item.ticket_id;
    const ticketType = item.ticket_type || 'municipio';
    if (!ticketId) return;
    setSelectedTimelineLead(item);
    const resp = await enterpriseService.getLeadTimeline(ticketType, ticketId);
    setTimelineEvents(resp?.items || resp?.timeline || []);
  };

  const handleAddTimelineNote = async () => {
    if (!selectedTimelineLead || !timelineNote.trim()) return;
    const ticketId = selectedTimelineLead.nro_ticket || selectedTimelineLead.ticket_id;
    const ticketType = selectedTimelineLead.ticket_type || 'municipio';
    if (!ticketId) return;
    await enterpriseService.addLeadTimelineNote(ticketType, ticketId, { note: timelineNote.trim() });
    setTimelineNote('');
    handleOpenTimeline(selectedTimelineLead);
  };

  const handleRunPlaybook = async (dryRun: boolean) => {
    const resp = await enterpriseService.runLeadsPlaybook({ dry_run: dryRun, only_sla_breached: true, limit: 50 });
    setPlaybookPreview(resp?.items || []);
  };

  const openWhatsApp = (phone: string) => window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer');

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>CRM Superadmin · Leads multitenant</CardTitle>
          <CardDescription>Pipeline consolidado, funnel, bulk stage, timeline y playbooks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <input className="h-10 rounded border px-3 text-sm" placeholder="tenant_slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} />
            <input className="h-10 w-24 rounded border px-3 text-sm" type="number" value={sinceDays} onChange={(e) => setSinceDays(Number(e.target.value) || 30)} />
            <select className="h-10 rounded border px-3 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recent' | 'relevance')}>
              <option value="recent">Más recientes</option><option value="relevance">Mayor relevancia</option>
            </select>
            <Button variant={slaOnly ? 'default' : 'outline'} onClick={() => setSlaOnly((v) => !v)}>{slaOnly ? 'Solo SLA vencido' : 'Filtrar SLA vencido'}</Button>
            <Button onClick={fetchPipeline} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{strategicOverview?.total_leads ?? data.total ?? 0}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Open</p><p className="text-2xl font-bold">{strategicOverview?.open_leads ?? '—'}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">SLA</p><p className="text-2xl font-bold">{strategicOverview?.sla_breached ?? 0}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Win rate</p><p className="text-2xl font-bold">{typeof strategicOverview?.win_rate === 'number' ? `${(strategicOverview.win_rate * 100).toFixed(1)}%` : '—'}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Conv.</p><p className="text-2xl font-bold">{((data.conversion_rate || 0) * 100).toFixed(1)}%</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Avg resp</p><p className="text-2xl font-bold">{data.avg_first_response_seconds ? `${Math.round(data.avg_first_response_seconds)}s` : '—'}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Interacciones (lead_score desc)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {filteredInteractions.map((entry, i) => (
                <div key={`int-${i}`} className="rounded border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2"><p className="font-medium">{entry.lead_name || 'Lead'}</p>{entry.sla_breached ? <Badge variant="destructive">SLA</Badge> : null}</div>
                  <p className="text-xs text-muted-foreground">lead_score: {entry.lead_score ?? '—'} · relevance: {entry.relevance_score ?? '—'}</p>
                  {entry.last_message ? <p className="text-xs mt-1">{entry.last_message}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cola de calidad de catálogo</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Tenant</th><th className="p-2">Producto</th><th className="p-2">Confidence</th><th className="p-2">Issues</th><th className="p-2">Estado</th></tr></thead>
                <tbody>
                  {catalogQuality.map((item, idx) => {
                    const c = item.confidence_score;
                    const status = item.review_required || (typeof c === 'number' && c < 0.65)
                      ? { label: 'Crítico', cls: 'bg-red-100 text-red-700' }
                      : typeof c === 'number' && c < 0.85
                        ? { label: 'Revisar', cls: 'bg-amber-100 text-amber-700' }
                        : (typeof c === 'number' && c >= 0.85 && Array.isArray(item.quality_issues) && item.quality_issues.length)
                          ? { label: 'Observación', cls: 'bg-blue-100 text-blue-700' }
                          : { label: 'OK', cls: 'bg-emerald-100 text-emerald-700' };
                    return <tr key={`q-${idx}`} className="border-b"><td className="p-2">{item.tenant_slug || '—'}</td><td className="p-2">{item.product_name || '—'}</td><td className="p-2">{typeof c === 'number' ? `${(c * 100).toFixed(0)}%` : '—'}</td><td className="p-2">{Array.isArray(item.quality_issues) && item.quality_issues.length ? item.quality_issues.join(', ') : '—'}</td><td className="p-2"><span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span></td></tr>;
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Leads</CardTitle></CardHeader>
            <CardContent className="space-y-3 overflow-x-auto">
              <div className="flex flex-wrap gap-2">
                <select className="h-9 rounded border px-2 text-sm" value={bulkStage} onChange={(e) => setBulkStage(e.target.value as LeadStage)}>{STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <Button size="sm" onClick={handleBulkStageUpdate}>Bulk stage</Button>
                <Button size="sm" variant="outline" onClick={() => handleRunPlaybook(true)}>Playbook preview</Button>
                <Button size="sm" variant="secondary" onClick={() => handleRunPlaybook(false)}>Playbook ejecutar</Button>
              </div>
              <table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Sel</th><th className="p-2">Lead</th><th className="p-2">Tenant</th><th className="p-2">Stage</th><th className="p-2">Contacto</th><th className="p-2">Acciones</th></tr></thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const name = normalizeLeadField(item, 'nombre', 'name') || 'Sin nombre';
                    const phone = normalizeLeadField(item, 'telefono', 'phone');
                    const email = normalizeLeadField(item, 'email');
                    const mins = minutesSince(item.created_at);
                    return <tr key={leadKey(item)} className="border-b align-top">
                      <td className="p-2"><input type="checkbox" checked={selectedLeadKeys.includes(leadKey(item))} onChange={() => handleToggleLeadSelection(item)} /></td>
                      <td className="p-2">{name}</td>
                      <td className="p-2">{normalizeLeadField(item, 'tenant_slug') || '—'}</td>
                      <td className="p-2"><select className="h-8 rounded border px-2 text-xs" value={normalizeLeadField(item, 'stage') || 'nuevo'} onChange={(e) => handleStageChange(item, e.target.value)}>{STAGES.map((s) => <option key={`${leadKey(item)}-${s}`} value={s}>{s}</option>)}</select></td>
                      <td className="p-2"><div>{email || phone || '—'}</div>{typeof mins === 'number' ? <div className="text-xs text-muted-foreground">hace {mins} min</div> : null}</td>
                      <td className="p-2"><div className="flex gap-1">{phone ? <Button size="icon" variant="outline" onClick={() => openWhatsApp(phone)}><MessageCircle className="h-4 w-4"/></Button> : null}{email ? <Button size="icon" variant="outline" onClick={() => window.open(`mailto:${email}`, '_blank', 'noopener,noreferrer')}><Mail className="h-4 w-4"/></Button> : null}<Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText([email, phone].filter(Boolean).join(' | ')).then(() => toast.success('Datos copiados'))}><Copy className="h-4 w-4"/></Button><Button size="sm" variant="outline" onClick={() => handleOpenTimeline(item)}>Timeline</Button></div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Timeline de lead</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {selectedTimelineLead ? <p className="text-xs text-muted-foreground">{normalizeLeadField(selectedTimelineLead, 'nombre', 'name')}</p> : <p className="text-sm text-muted-foreground">Elegí un lead para ver timeline.</p>}
              <div className="flex gap-2"><input className="h-9 flex-1 rounded border px-3 text-sm" value={timelineNote} onChange={(e) => setTimelineNote(e.target.value)} placeholder="Agregar nota" /><Button size="sm" onClick={handleAddTimelineNote}>Guardar</Button></div>
              {timelineEvents.map((evt, idx) => <div key={`t-${idx}`} className="rounded border px-3 py-2 text-sm"><p className="font-medium">{evt.event_type || 'evento'} {evt.stage ? `· ${evt.stage}` : ''}</p>{evt.note ? <p className="text-xs">{evt.note}</p> : null}{evt.created_at ? <p className="text-[11px] text-muted-foreground">{evt.created_at}</p> : null}</div>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Resultado playbook</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {playbookPreview.map((item, idx) => <div key={`pb-${idx}`} className="rounded border px-3 py-2 text-sm"><p className="font-medium">Ticket #{item.ticket_id || '—'}</p><div className="mt-1 flex flex-wrap gap-1">{(item.actions || []).map((a: any, i: number) => <span key={`a-${i}`} className="inline-flex rounded border px-2 py-0.5 text-xs">{a.channel || 'canal'} · {a.status || 'pending'}</span>)}</div></div>)}
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </section>
  );
};

export default SuperadminLeadsPipeline;
