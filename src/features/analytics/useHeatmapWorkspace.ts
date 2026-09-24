import { useEffect, useRef, useState } from 'react';
import { analyticsService, type AnalyticsHeatmapResponse } from '@/services/analyticsService';
import { assertHeatmapScope } from './heatmapBoundary';
import { activeGeoFilters, assertGeoFilterReceipt, type GeoFilters } from './heatmapWorkspaceModel';
interface Input { tenantId: number; tenantSlug: string; from: string; to: string; filters: GeoFilters }
interface State { key: string; phase: 'loading' | 'ready' | 'error'; data: AnalyticsHeatmapResponse | null }
export function useHeatmapWorkspace(input: Input) {
  const [revision,setRevision] = useState(0);
  const key = JSON.stringify([input.tenantId,input.tenantSlug,input.from,input.to,input.filters,revision]);
  const valid = Number.isSafeInteger(input.tenantId) && input.tenantId > 0 && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(input.tenantSlug)
    && Number.isFinite(Date.parse(input.from)) && Number.isFinite(Date.parse(input.to)) && Date.parse(input.from) <= Date.parse(input.to);
  const [state,setState] = useState<State>({key:'',phase:'loading',data:null});
  const refreshLock = useRef(false), sequence = useRef(0);
  useEffect(() => {
    if (!valid) { refreshLock.current = false; return; }
    const serial = ++sequence.current; let active = true;
    refreshLock.current = true; setState({key,phase:'loading',data:null});
    void analyticsService.getHeatmap({tenant_id:input.tenantId,tenantSlug:input.tenantSlug,from:input.from,to:input.to,...activeGeoFilters(input.filters)})
      .then(data => {
        if (!active || serial !== sequence.current) return;
        if (!data || !Array.isArray(data.points)) throw new Error('Respuesta geográfica inválida.');
        assertHeatmapScope(data,{tenant_id:input.tenantId,tenantSlug:input.tenantSlug});
        assertGeoFilterReceipt(data,input.filters);
        setState({key,phase:'ready',data});
      })
      .catch(() => { if (active && serial === sequence.current) setState({key,phase:'error',data:null}); })
      .finally(() => { if (active && serial === sequence.current) refreshLock.current=false; });
    return () => { active=false; sequence.current+=1; refreshLock.current=false; };
  },[key,valid]);
  const phase = !valid ? 'invalid' : state.key === key ? state.phase : 'loading';
  return { phase, data: phase === 'ready' ? state.data : null,
    refresh: () => { if (valid && !refreshLock.current) { refreshLock.current=true; setRevision(value=>value+1); } },
  };
}
