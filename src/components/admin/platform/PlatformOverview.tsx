import React, { useState } from 'react';
import { Building2, CheckCircle2, MessageSquare, Activity, ArrowUpRight, Info, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import type { PlatformOverviewData } from './data';
import { Button } from '@/components/ui/button';
import { organizationTypeLabel } from './OrganizationDirectory';

const palette = ['#4267a9', '#57a38a', '#d69c58', '#8b82b4', '#729aa7', '#b17e87'];
const displayNumber = (value: number | null) => value === null ? 'No disponible' : value.toLocaleString('es-AR', { maximumFractionDigits: 1 });
const stateLabels: Record<string, string> = { active: 'Activas', inactive: 'Inactivas', unknown: 'Sin dato' };

export function PlatformOverview({ data, directoryLoading, crmLoading, healthLoading, onOrganizations, onCrm, onProfile, onRefresh }: {
  data: PlatformOverviewData;
  directoryLoading: boolean;
  crmLoading: boolean;
  healthLoading: boolean;
  onOrganizations: () => void;
  onCrm: () => void;
  onProfile: (slug: string) => void;
  onRefresh: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [distribution, setDistribution] = useState('type');
  const metrics = [
    { label: 'Organizaciones', value: data.directory.total, loading: directoryLoading, icon: Building2, detail: 'Total informado por el directorio.' },
    { label: 'Organizaciones activas', value: data.directory.activeLoaded, loading: directoryLoading, icon: CheckCircle2, detail: `Dentro de las ${data.directory.loaded ?? '—'} organizaciones cargadas.` },
    { label: 'Contactos CRM recientes', value: data.crm.loaded, loading: crmLoading, icon: MessageSquare, detail: 'Muestra reciente recibida. No representa el total del CRM.' },
    { label: 'Índice operativo', value: data.health.mean, loading: healthLoading, icon: Activity, detail: `Promedio sobre ${data.health.denominator ?? '—'} organizaciones evaluadas. Escala de 0 a 100.` },
  ];
  const statusData = data.statusDistribution.map((row) => ({ ...row, label: stateLabels[row.key] || row.key }));
  const planData = (distribution === 'type' ? data.typeDistribution : data.planDistribution).map((row) => ({ ...row, label: row.key === 'unknown' ? 'Sin dato' : distribution === 'type' ? organizationTypeLabel(row.key) : row.key }));
  const healthRows = data.health.rows.slice().sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity)).slice(0, 5);
  return <>
    <div className="flex justify-end"><Button variant="outline" disabled={directoryLoading || crmLoading || healthLoading} onClick={onRefresh}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Actualizar resumen</Button></div>
    <div className="platform-metrics">{metrics.map(({ label, value, loading, icon: Icon, detail }) => <article className="platform-metric" key={label}>
      <div className="platform-metric-label"><span>{label}</span><Icon size={17} aria-hidden="true" /></div>
      <div className={`platform-metric-value ${value === null || loading ? 'is-unavailable' : ''}`} aria-live="polite">{loading ? 'Cargando…' : displayNumber(value)}</div><p>{detail}</p>
    </article>)}</div>
    {data.executiveCountMismatch && <div className="platform-warning" role="status"><Info size={18} className="shrink-0 mt-0.5" /><span>El directorio y el resumen operativo informan cantidades distintas. El total mostrado corresponde al directorio; las evaluaciones pueden tener otra cobertura.</span></div>}
    <div className="platform-charts">
      <section className="platform-panel" aria-labelledby="platform-state-title"><div className="platform-panel-heading"><div><h2 id="platform-state-title">Estado de las organizaciones</h2><p>Distribución de las organizaciones cargadas en el directorio.</p></div></div>
        {directoryLoading ? <div className="platform-empty">Cargando distribución…</div> : data.directory.loaded === null ? <div className="platform-empty">Distribución no disponible.</div> : !data.directory.loaded ? <div className="platform-empty">No hay organizaciones para representar.</div> : <>
          <div className="platform-chart" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="count" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none" isAnimationActive={!reducedMotion}>{statusData.map((row, index) => <Cell key={row.key} fill={palette[index % palette.length]} />)}</Pie><Tooltip formatter={(value) => [value, 'Organizaciones']} /></PieChart></ResponsiveContainer></div>
          <ul className="platform-chart-legend" aria-label="Datos de estado">{statusData.map((row, index) => <li key={row.key}><i aria-hidden="true" style={{ background: palette[index % palette.length] }} />{row.label} <strong>{row.count}</strong></li>)}</ul>
        </>}
      </section>
      <section className="platform-panel" aria-labelledby="platform-plan-title"><div className="platform-panel-heading"><div><h2 id="platform-plan-title">Composición del directorio</h2><p>Sectores y planes informados para las organizaciones cargadas.</p></div><select className="platform-profile-select" style={{ width: 'auto' }} aria-label="Agrupar organizaciones por" value={distribution} onChange={(event) => setDistribution(event.target.value)}><option value="type">Por sector</option><option value="plan">Por plan</option></select></div>
        {directoryLoading ? <div className="platform-empty">Cargando distribución…</div> : data.directory.loaded === null ? <div className="platform-empty">Distribución no disponible.</div> : !planData.length ? <div className="platform-empty">No hay planes para representar.</div> : <>
          <div className="platform-chart" style={{ height: Math.max(240, planData.length * 38) }} aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={planData} layout="vertical" margin={{ top: 16, right: 24, left: 8, bottom: 12 }}><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={95} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [value, 'Organizaciones']} /><Bar dataKey="count" fill={palette[0]} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={!reducedMotion} /></BarChart></ResponsiveContainer></div>
          <ul className="platform-chart-legend" aria-label="Datos de composición">{planData.map((row) => <li key={row.key}>{row.label} <strong>{row.count}</strong></li>)}</ul>
        </>}
      </section>
    </div>
    <section className="platform-panel" aria-labelledby="platform-followup-title"><div className="platform-panel-heading"><div><h2 id="platform-followup-title">Organizaciones para revisar</h2><p>Menor índice operativo primero, dentro de las evaluaciones recibidas.</p></div><Button variant="outline" onClick={onOrganizations}>Ver directorio<ArrowUpRight className="ml-2 h-4 w-4" /></Button></div>
      <div className="platform-panel-body">{healthLoading ? <p className="text-sm text-muted-foreground">Cargando evaluaciones…</p> : !healthRows.length ? <p className="text-sm text-muted-foreground">No hay evaluaciones disponibles.</p> : healthRows.map((row) => <div key={row.slug} className="platform-service-row"><div><button className="platform-organization-name" onClick={() => onProfile(row.slug)}>{row.name || row.slug}<ArrowUpRight size={14} aria-hidden="true" /></button>{row.alerts.length > 0 && <p>{row.alerts.slice(0, 2).join(' · ')}</p>}</div><span className="platform-plan">{row.score === null ? 'Sin dato' : `${displayNumber(row.score)} / 100`}</span></div>)}</div>
      <p className="platform-note">El índice combina controles de configuración y actividad. No mide disponibilidad del servicio ni reemplaza la revisión de cada organización. Cobertura: {data.health.denominator ?? '—'} con puntaje de {data.health.totalRows ?? '—'} evaluaciones recibidas.</p>
    </section>
    <section className="platform-warning"><MessageSquare size={20} className="shrink-0 mt-0.5" /><div className="flex-1"><h3>Seguimiento comercial</h3><p className="mt-1 text-sm text-muted-foreground">Consultá los contactos recientes y continuá su seguimiento en el CRM.</p></div><Button variant="outline" onClick={onCrm}>Abrir CRM</Button></section>
  </>;
}
