import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { enterpriseService } from '@/services/enterpriseService';
import { toast } from 'sonner';
import { Copy, Mail, MessageCircle, RefreshCw } from 'lucide-react';

type LeadStage =
  | 'nuevo'
  | 'contactado'
  | 'calificado'
  | 'demo_agendada'
  | 'propuesta_enviada'
  | 'ganado'
  | 'perdido'
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
  stage?: LeadStage;
  relevance_score?: number;
  created_at?: string;
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
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
};

const toCsv = (rows: LeadItem[]) => {
  const headers = ['nombre', 'email', 'telefono', 'tenant_slug', 'stage', 'nro_ticket', 'created_at', 'relevance_score'];
  const body = rows.map((row) => [
    normalizeLeadField(row, 'nombre', 'name'),
    normalizeLeadField(row, 'email'),
    normalizeLeadField(row, 'telefono', 'phone'),
    normalizeLeadField(row, 'tenant_slug'),
    normalizeLeadField(row, 'stage'),
    normalizeLeadField(row, 'nro_ticket', 'ticket_id'),
    normalizeLeadField(row, 'created_at'),
    normalizeLeadField(row, 'relevance_score'),
  ]);

  return [headers, ...body]
    .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

const SuperadminLeadsPipeline: React.FC = () => {
  const [tenantSlug, setTenantSlug] = useState('');
  const [sinceDays, setSinceDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState<LeadStage | null>(null);
  const [data, setData] = useState<PipelineResponse>({});

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const payload = await enterpriseService.getLeadsPipeline({
        tenant_slug: tenantSlug || undefined,
        since_days: sinceDays,
      });
      setData(payload || {});
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el pipeline de leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, []);

  const items = data.items || [];
  const filteredItems = useMemo(() => {
    if (!activeStage) return items;
    return items.filter((item) => (item.stage || 'nuevo') === activeStage);
  }, [items, activeStage]);

  const tenantOptions = useMemo(() => Object.keys(data.by_tenant || {}).sort(), [data.by_tenant]);

  const conversionRateLabel = `${((data.conversion_rate || 0) * 100).toFixed(1)}%`;
  const avgResponseLabel = data.avg_first_response_seconds ? `${Math.round(data.avg_first_response_seconds)}s` : '—';
  const won = data.by_stage?.ganado || 0;
  const lost = data.by_stage?.perdido || 0;

  const handleExportCsv = () => {
    const csv = toCsv(filteredItems);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'superadmin-leads.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openWhatsApp = (phone: string) => window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer');

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>CRM Superadmin · Leads multitenant</CardTitle>
          <CardDescription>Pipeline consolidado, funnel y acciones rápidas por lead.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Tenant</label>
              <select className="block h-10 rounded-md border bg-background px-3 text-sm" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)}>
                <option value="">Todos</option>
                {tenantOptions.map((slug) => <option key={slug} value={slug}>{slug}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Últimos días</label>
              <input className="block h-10 w-24 rounded-md border bg-background px-3 text-sm" type="number" min={1} max={365} value={sinceDays} onChange={(e) => setSinceDays(Number(e.target.value) || 30)} />
            </div>
            <Button onClick={fetchPipeline} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button>
            <Button variant="outline" onClick={handleExportCsv}>Export CSV</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total leads</p><p className="text-2xl font-bold">{data.total || 0}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Conversion rate</p><p className="text-2xl font-bold">{conversionRateLabel}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Avg first response</p><p className="text-2xl font-bold">{avgResponseLabel}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Ganado / Perdido</p><p className="text-2xl font-bold">{won} / {lost}</p></CardContent></Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Funnel</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {STAGES.map((stage) => {
                  const count = data.by_stage?.[stage] || 0;
                  const pct = data.total ? Math.max(4, (count / data.total) * 100) : 0;
                  return (
                    <button key={stage} className="w-full text-left" onClick={() => setActiveStage(activeStage === stage ? null : stage)}>
                      <div className="mb-1 flex items-center justify-between text-sm"><span>{stage}</span><span>{count}</span></div>
                      <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }}/></div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ranking por tenant</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(data.by_tenant || {}).sort((a, b) => b[1] - a[1]).map(([slug, count]) => (
                  <div key={slug} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <span>{slug}</span><Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 overflow-x-auto lg:grid-cols-4">
            {STAGES.map((stage) => (
              <Card key={stage} className="min-w-[280px]">
                <CardHeader><CardTitle className="text-base">{stage}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {items.filter((item) => (item.stage || 'nuevo') === stage).slice(0, 20).map((item) => {
                    const name = normalizeLeadField(item, 'nombre', 'name') || 'Sin nombre';
                    const email = normalizeLeadField(item, 'email');
                    const phone = normalizeLeadField(item, 'telefono', 'phone');
                    const slug = normalizeLeadField(item, 'tenant_slug');
                    const ticket = normalizeLeadField(item, 'nro_ticket', 'ticket_id');
                    return (
                      <div key={`${stage}-${item.id || ticket || name}`} className="rounded border p-2 text-xs space-y-1">
                        <p className="font-semibold text-sm">{name}</p>
                        <p>{email || phone || 'Sin contacto'}</p>
                        <p>{slug}</p>
                        {ticket ? <p>#{ticket}</p> : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de leads {activeStage ? `· ${activeStage}` : ''}</CardTitle>
              <CardDescription>Click en funnel para hacer drilldown de etapa.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Lead</th><th className="p-2">Tenant</th><th className="p-2">Etapa</th><th className="p-2">Contacto</th><th className="p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const name = normalizeLeadField(item, 'nombre', 'name') || 'Sin nombre';
                    const email = normalizeLeadField(item, 'email');
                    const phone = normalizeLeadField(item, 'telefono', 'phone');
                    return (
                      <tr key={`row-${item.id || name}-${item.created_at || ''}`} className="border-b align-top">
                        <td className="p-2">{name}</td>
                        <td className="p-2">{normalizeLeadField(item, 'tenant_slug') || '—'}</td>
                        <td className="p-2">{normalizeLeadField(item, 'stage') || 'nuevo'}</td>
                        <td className="p-2">{email || phone || '—'}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            {phone ? <Button size="icon" variant="outline" onClick={() => openWhatsApp(phone)}><MessageCircle className="h-4 w-4"/></Button> : null}
                            {email ? <Button size="icon" variant="outline" onClick={() => window.open(`mailto:${email}`, '_blank', 'noopener,noreferrer')}><Mail className="h-4 w-4"/></Button> : null}
                            <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText([email, phone].filter(Boolean).join(' | ')).then(() => toast.success('Datos copiados'))}><Copy className="h-4 w-4"/></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </section>
  );
};

export default SuperadminLeadsPipeline;
