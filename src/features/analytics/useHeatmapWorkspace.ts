import { useEffect, useRef, useState } from 'react';
import { analyticsService, type AnalyticsHeatmapResponse } from '@/services/analyticsService';
import { assertHeatmapScope } from './heatmapBoundary';
import { activeGeoFilters, assertGeoFilterReceipt, type GeoFilters } from './heatmapWorkspaceModel';
import { BASE_API_URL } from '@/config';
import { withBackendReadTimeout } from '@/utils/backendReadTimeout';
import { STARTUP_CONTINUITY_BUDGET_MS } from '@/utils/backendRequestContinuity';
import { withAsyncTimeout } from '@/utils/asyncTimeout';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';

const HEATMAP_RESPONSE_TIMEOUT_MS = 15_000;
// Preserve readiness and safe startup-recovery budgets, but bound the whole attempt.
export const HEATMAP_TOTAL_TIMEOUT_MS = 2 * STARTUP_CONTINUITY_BUDGET_MS + HEATMAP_RESPONSE_TIMEOUT_MS;
interface Input { tenantId: number; tenantSlug: string; context: 'municipio' | 'pyme'; from: string; to: string; filters: GeoFilters }
interface State { key: string; phase: 'loading' | 'ready' | 'error'; data: AnalyticsHeatmapResponse | null }
export function useHeatmapWorkspace(input: Input) {
  const [revision,setRevision] = useState(0);
  const key = JSON.stringify([input.tenantId,input.tenantSlug,input.context,input.from,input.to,input.filters,revision]);
  const valid = Number.isSafeInteger(input.tenantId) && input.tenantId > 0 && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(input.tenantSlug)
    && Number.isFinite(Date.parse(input.from)) && Number.isFinite(Date.parse(input.to)) && Date.parse(input.from) <= Date.parse(input.to);
  const [state,setState] = useState<State>({key:'',phase:'loading',data:null});
  const refreshLock = useRef(false), sequence = useRef(0);
  useEffect(() => {
    if (!valid) { refreshLock.current = false; return; }
    const serial = ++sequence.current; let active = true;
    const controller = new AbortController();
    const sessionRevision = captureChatbocSessionRevision();
    const isCurrent = () => active && serial === sequence.current && !controller.signal.aborted
      && isChatbocSessionRevisionCurrent(sessionRevision);
    let stopRead!: () => void;
    const cancelled = new Promise<never>((_, reject) => {
      stopRead = () => reject(new DOMException('Geographic read cancelled', 'AbortError'));
      controller.signal.addEventListener('abort', stopRead, { once: true });
    });
    refreshLock.current = true; setState({key,phase:'loading',data:null});
    const read = withBackendReadTimeout(
      () => Promise.race([analyticsService.getHeatmap(
        {tenant_profile_id:input.tenantId,tenantSlug:input.tenantSlug,scope:input.context,context:input.context,from:input.from,to:input.to,...activeGeoFilters(input.filters)},
        undefined,
        { signal: controller.signal, isCurrent },
      ), cancelled]),
      HEATMAP_RESPONSE_TIMEOUT_MS,
      'Geographic distribution',
      BASE_API_URL,
      isCurrent,
    );
    void withAsyncTimeout(Promise.race([read, cancelled]), HEATMAP_TOTAL_TIMEOUT_MS, 'Geographic workspace')
      .then(data => {
        if (!isCurrent()) throw new DOMException('Geographic read scope expired', 'AbortError');
        if (!data || !Array.isArray(data.points)) throw new Error('Respuesta geográfica inválida.');
        assertHeatmapScope(data,{tenant_profile_id:input.tenantId,tenantSlug:input.tenantSlug});
        assertGeoFilterReceipt(data,input.filters);
        setState({key,phase:'ready',data});
      })
      .catch(() => {
        controller.abort();
        if (active && serial === sequence.current) setState({key,phase:'error',data:null});
      })
      .finally(() => {
        controller.signal.removeEventListener('abort', stopRead);
        if (active && serial === sequence.current) refreshLock.current=false;
      });
    return () => { active=false; sequence.current+=1; controller.abort(); refreshLock.current=false; };
  },[key,valid]);
  const phase = !valid ? 'invalid' : state.key === key ? state.phase : 'loading';
  return { phase, data: phase === 'ready' ? state.data : null,
    refresh: () => { if (valid && !refreshLock.current) { refreshLock.current=true; setRevision(value=>value+1); } },
  };
}
