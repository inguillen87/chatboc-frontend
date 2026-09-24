import React, { useMemo, useState } from 'react';
import { Layers3, MapPinned, RefreshCw, ShieldCheck, Filter, BarChart3 } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import MapLibreMap from '@/components/LazyMapLibreMap';
import { Button } from '@/components/ui/button';
import { geoRecord, geoText, geoNumber } from '@/features/analytics/heatmapBoundary';
import { GEO_DIMENSIONS, GEO_LABELS, geoFilters, geoOptions, geoCoverage, geoBreakdown, heatmapMapModel, type GeoFilters, type GeoDimension } from '@/features/analytics/heatmapWorkspaceModel';
import { useHeatmapWorkspace } from '@/features/analytics/useHeatmapWorkspace';
import type { AnalyticsHeatmapResponse } from '@/services/analyticsService';
import './heatmapWorkspace.css';
interface Props { tenantId: number; dateRange: { from: string; to: string }; filters?: Partial<GeoFilters> }
const number = (value: number | null) => value === null ? 'No informado' : value.toLocaleString('es-AR');
export default function HeatmapDashboard({tenantId,dateRange,filters}: Props) {
  const {currentSlug} = useTenant();
  const initial = geoFilters(filters);
  const identity = JSON.stringify([tenantId,currentSlug,dateRange.from,dateRange.to,initial]);
  return <HeatmapSession key={identity} tenantId={tenantId} tenantSlug={currentSlug || ''} from={dateRange.from} to={dateRange.to} initial={initial} />;
}
function HeatmapSession({tenantId,tenantSlug,from,to,initial}: {tenantId:number;tenantSlug:string;from:string;to:string;initial:GeoFilters}) {
  const [draft,setDraft] = useState(initial), [active,setActive] = useState(initial);
  const [local,setLocal] = useState({estado:'',severidad:''}), [layer,setLayer] = useState('heatmap');
  const {data,phase,refresh} = useHeatmapWorkspace({tenantId,tenantSlug,from,to,filters:active});
  const model = useMemo(()=>data ? heatmapMapModel(data,local) : null,[data,local]);
  const labels = geoRecord(data?.ui?.labels), layerLabels = geoRecord(data?.ui?.layer_labels);
  const busy = phase === 'loading';
  const changed = JSON.stringify(draft) !== JSON.stringify(active);
  const apply = (filters:GeoFilters) => {setDraft(filters);setActive(filters);setLocal({estado:'',severidad:''});};
  const layers = Object.entries(geoRecord(data?.geo_layers?.layers)).filter(([,v])=>Object.keys(geoRecord(v)).length>0).map(([key])=>key);
  const effectiveLayer = layers.length && !layers.includes(layer) ? layers[0] : layer;
  const coverage = geoCoverage(data);
  const localOptions = (key:'estado'|'severidad'): string[] => Array.from(new Set<string>((model?.experience.displayPoints || []).map(row=>geoText(geoRecord(row)[key])).filter(Boolean)));
  return <section className="geo-workspace" aria-label="Análisis geográfico">
    <header className="geo-heading">
      <div><div className="geo-eyebrow"><MapPinned size={16} aria-hidden="true" /> Inteligencia territorial</div>
        <h2>{geoText(labels.title) || 'Mapa de calor y distribución'}</h2>
        <p>{geoText(labels.description) || 'Explorá la distribución geográfica publicada por la organización.'}</p>
        <p className="geo-meta">{tenantSlug || 'Organización no verificada'} · {from} — {to}</p>
      </div>
      <Button type="button" variant="outline" disabled={busy || phase==='invalid'} onClick={refresh}><RefreshCw size={16} aria-hidden="true" />Actualizar mapa</Button>
    </header>
    <form className="geo-filter-panel" onSubmit={event=>{event.preventDefault();if(!busy && changed)apply(draft);}}>
      <div className="geo-section-title"><h3><Filter size={16} aria-hidden="true" />Filtros de consulta</h3><span>Se aplican al consultar el servidor</span></div>
      <div className="geo-filter-grid">{GEO_DIMENSIONS.map(key=>{
        const options = data ? geoOptions(data,key) : [];
        if(draft[key] && !options.some(option=>option.key===draft[key]))options.unshift({key:draft[key],label:draft[key]});
        return <label key={key}>{geoText(labels[`filter_${key}`]) || GEO_LABELS[key]}
          <select aria-label={GEO_LABELS[key]} value={draft[key]} disabled={busy || phase==='invalid' || (!options.length && !draft[key])} onChange={event=>setDraft(current=>({...current,[key]:event.target.value}))}>
            <option value="">Todos</option>{options.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
          </select></label>;
      })}</div>
      <div className="geo-toolbar"><Button type="submit" disabled={busy || !changed || phase==='invalid'}>Aplicar filtros</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={()=>apply(initial)}>Restablecer filtros</Button>
        {changed && <span role="status">Cambios pendientes de aplicar.</span>}</div>
      <p className="geo-note">Los filtros disponibles provienen de esta respuesta. Cambiar la capa o el filtro visual no realiza nuevas consultas.</p>
    </form>
    <div className="geo-active-filters" aria-label="Filtros solicitados">{GEO_DIMENSIONS.filter(key=>active[key]).map(key=><span key={key}>{GEO_LABELS[key]}: {active[key]}</span>)}</div>
    {phase==='invalid' && <div className="geo-empty" role="alert">No se consultó el mapa. Verificá la organización y el período.</div>}
    {phase==='error' && <div className="geo-empty" role="alert"><h3>No se pudo verificar el mapa</h3><p>Se retiraron los datos anteriores. La consulta pudo fallar o el acceso puede haber cambiado.</p><Button variant="outline" onClick={refresh}>Reintentar consulta</Button></div>}
    {busy && <div className="geo-loading" role="status"><MapPinned aria-hidden="true" /><p>Consultando distribución geográfica…</p></div>}
    {data && model && <>
      {model.synthetic && <p className="geo-warning" role="status">Datos de demostración declarados por el servidor. No representan operaciones reales.</p>}
      <div className="geo-metrics">
        <GeoMetric label={model.experience.quality.usingCellFallback ? 'Celdas visibles' : 'Elementos visibles'} value={number(model.displayPoints.length)} detail="Elementos geográficos, no personas únicas" />
        <GeoMetric label="Con coordenadas" value={number(coverage.withCoordinates)} detail="Cantidad informada por el servidor" />
        <GeoMetric label="Sin coordenadas" value={number(coverage.withoutCoordinates)} detail="No se ubican en una posición inventada" />
        <GeoMetric label="Cobertura geográfica" value={coverage.coverage===null?'No informada':`${number(coverage.coverage)}%`} detail="Del registro publicado, no de la población" />
      </div>
      {coverage.inconsistent && <p className="geo-warning">Los conteos de cobertura no coinciden con el total informado. No se calcula un porcentaje alternativo.</p>}
      <div className="geo-layout"><section className="geo-map-panel" aria-label="Distribución en el mapa">
        <div className="geo-section-title"><h3><Layers3 size={16} aria-hidden="true" />Distribución geográfica</h3><span>{model.redacted?'Ubicaciones agregadas':'Respuesta geográfica actual'}</span></div>
        <div className="geo-toolbar" aria-label="Capas del mapa">{layers.map(value=><button type="button" key={value} aria-pressed={value===effectiveLayer} onClick={()=>setLayer(value)}>{geoText(layerLabels[value])||value}</button>)}</div>
        <div className="geo-local-filters">{(['estado','severidad'] as const).map(key=>{
          const options=localOptions(key); if(!options.length && !local[key])return null;
          return <label key={key}>{key==='estado'?'Estado visible':'Severidad visible'}<select aria-label={key==='estado'?'Estado visible':'Severidad visible'} value={local[key]} onChange={event=>setLocal(current=>({...current,[key]:event.target.value}))}>
            <option value="">Todos</option>{options.map(value=><option key={value} value={value}>{value}</option>)}</select></label>;
        })}</div>
        {model.localActive && <p className="geo-note">Filtro visual sobre elementos cargados; los indicadores y segmentos siguen describiendo la respuesta completa. Un elemento sin esta dimensión no se incluye.</p>}
        <div className="geo-map-canvas">{model.displayPoints.length || (model.source?.features.length || 0) ? <MapLibreMap tenantSlug={tenantSlug} heatmapData={model.displayPoints} showHeatmap={['heatmap','heat'].includes(effectiveLayer)} center={model.center}
          fitToBounds={model.bounds.length?model.bounds:undefined} initialZoom={11} mapStyleUrl={model.experience.mapStyleUrl} mapTileUrl={model.experience.mapTileUrl} mapTileAttribution={model.experience.mapTileAttribution}
          geoLayerConfig={model.config} evidence={model.evidence} /> : <div className="geo-empty"><MapPinned aria-hidden="true" /><h3>{model.localActive?'Sin coincidencias geográficas':geoText(labels.empty)||'Sin datos geográficos para esta consulta'}</h3><p>No se muestran puntos de otra selección.</p></div>}</div>
        <p className="geo-note"><ShieldCheck size={14} aria-hidden="true" />{model.redacted?'Las coordenadas individuales están suprimidas. Sólo se representan celdas agregadas publicadas por el servidor.':'La ubicación procede de la respuesta recibida. Un punto o peso no equivale necesariamente a una persona, un reclamo o una respuesta única.'}</p>
      </section>
      <aside className="geo-insights" aria-label="Segmentos de la consulta">
        <div className="geo-section-title"><h3><BarChart3 size={16} aria-hidden="true" />Explorar segmentos</h3></div>
        <p className="geo-note">Seleccioná una barra para consultar ese segmento. Los conteos son del servidor; no se calculan tasas poblacionales.</p>
        {(['categoria','distrito','canal','source'] as const).map(dimension=><GeoBreakdownChart key={dimension} data={data} dimension={dimension} active={active[dimension]} onSelect={value=>apply({...active,[dimension]:value})} />)}
        {!(['categoria','distrito','canal','source'] as const).some(key=>geoBreakdown(data,key).length) && <p className="geo-empty">No se informaron distribuciones segmentadas.</p>}
      </aside></div>
      <GeoDetails data={model.safe} />
      <details className="geo-evidence"><summary>Base, filtros y trazabilidad</summary>
        <p>Organización solicitada: {tenantSlug}. Período: {from} — {to}.</p>
        <p>Contrato: {data.contract_version || 'No informado'}. Referencia de consulta: {data.request_id || 'No informada'}.</p>
        <p>{Object.keys(geoRecord(data.segments_filters_applied ?? data.filters_applied ?? data.applied_filters)).length?'El servidor incluyó información de filtros aplicados.':'El servidor no incluyó confirmación de filtros. Los filtros de cabecera indican lo solicitado.'}</p>
        <p>Los cambios de estado o asignación se realizan en la ficha del caso, no al explorar este mapa. Una celda agregada no autoriza reconstruir ubicaciones individuales.</p>
      </details>
    </>}
  </section>;
}
function GeoMetric({label,value,detail}: {label:string;value:string;detail:string}) {
  return <article className="geo-metric"><h3>{label}</h3><strong>{value}</strong><p>{detail}</p></article>;
}
function GeoBreakdownChart({data,dimension,active,onSelect}: {data:AnalyticsHeatmapResponse;dimension:GeoDimension;active:string;onSelect:(key:string)=>void}) {
  const rows=geoBreakdown(data,dimension); if(!rows.length)return null;
  const max=Math.max(...rows.map(row=>row.count),1);
  return <section className="geo-breakdown" aria-label={`Distribución por ${GEO_LABELS[dimension]}`}><h4>{GEO_LABELS[dimension]}</h4>
    {rows.slice(0,6).map(row=><button type="button" key={row.key} aria-pressed={active===row.key} aria-label={`${GEO_LABELS[dimension]}: ${row.label}, ${row.count} registros informados`} onClick={()=>onSelect(active===row.key?'':row.key)}>
      <span className="geo-bar" style={{width:`${100*row.count/max}%`}} aria-hidden="true" /><span>{row.label}</span><strong>{number(row.count)}</strong></button>)}
    {rows.length>6 && <p className="geo-note">Se muestran 6 de {rows.length} segmentos. Usá el selector para consultar los demás.</p>}
  </section>;
}
function GeoDetails({data}: {data:AnalyticsHeatmapResponse}) {
  const cells=Array.isArray(data.cells)?data.cells:[], hotspots=Array.isArray(data.hotspots)?data.hotspots:[];
  const pending=Array.isArray(data.geocoding?.candidates)?data.geocoding.candidates:[];
  if(!cells.length && !hotspots.length && !pending.length)return null;
  return <details className="geo-evidence"><summary>Detalle territorial de la respuesta</summary>
    <p>Estas filas corresponden a la consulta del servidor. Los filtros visuales de estado y severidad afectan sólo al mapa.</p>
    {([{title:'Celdas agregadas',items:cells},{title:'Zonas destacadas',items:hotspots}]).filter(group=>group.items.length).map(group=><section key={group.title}>
      <h3>{group.title}</h3><div className="geo-table-scroll" role="region" aria-label={group.title} tabIndex={0}><table><thead><tr><th>Zona publicada</th><th>Conteo informado</th></tr></thead><tbody>
        {group.items.slice(0,20).map((item,index)=>{const row=geoRecord(item),count=geoNumber(row.count);return <tr key={index}><td>{geoText(row.label)||geoText(row.key)||geoText(row.cell_id)||'Sin etiqueta'}</td><td>{number(count!==null&&count>=0?count:null)}</td></tr>;})}
      </tbody></table></div>{group.items.length>20 && <p>Se muestran 20 de {group.items.length} filas recibidas.</p>}
    </section>)}
    {pending.length>0 && <section><h3>Ubicación pendiente de verificar</h3><p>Se conservan fuera del mapa hasta contar con coordenadas verificadas.</p><ul>{pending.slice(0,5).map((item,index)=><li key={index}>{geoText(item.label)||geoText(item.address)||geoText(item.direccion)||'Registro sin ubicación informada'}</li>)}</ul></section>}
  </details>;
}
