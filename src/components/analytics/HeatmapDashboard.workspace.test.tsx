import React from 'react';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const mock=vi.hoisted(()=>({slug:'org-a',fetch:vi.fn(),ready:vi.fn()}));
vi.mock('@/utils/backendBootstrapGate',async importOriginal=>({
  ...await importOriginal<typeof import('@/utils/backendBootstrapGate')>(),ensureBackendRuntimeReady:mock.ready,
}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:mock.slug})}));
vi.mock('@/features/analytics/usePrivateAnalyticsScope',()=>({usePrivateAnalyticsScope:()=>({pending:false,key:mock.slug,scope:{tenantSlug:mock.slug,tenantId:null,kind:'municipio'}})}));
vi.mock('@/services/analyticsService',()=>({analyticsService:{getHeatmap:mock.fetch}}));
vi.mock('@/components/LazyMapLibreMap',()=>({default:({heatmapData,geoLayerConfig}:any)=><div data-testid="map" data-points={JSON.stringify(heatmapData)} data-features={geoLayerConfig?.source?.features?.length||0}>Mapa de prueba</div>}));
import HeatmapDashboard from './HeatmapDashboard';
import { HEATMAP_TOTAL_TIMEOUT_MS } from '@/features/analytics/useHeatmapWorkspace';
import { STARTUP_CONTINUITY_BUDGET_MS } from '@/utils/backendRequestContinuity';
const period={from:'2026-09-01',to:'2026-09-24'};
const data=(extra:Record<string,unknown>={})=>({tenant_id:7,tenant_slug:'org-a',points:[{lat:-33,lng:-68,estado:'abierto',severidad:'alta',categoria:'agua'},{lat:-34,lng:-69,estado:'cerrado',severidad:'baja',categoria:'luz'}],segments:{categoria:[{key:'agua',label:'Agua potable',count:5},{key:'luz',label:'Luminarias',count:2}]},...extra});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
beforeEach(()=>{mock.slug='org-a';mock.fetch.mockReset().mockResolvedValue(data());mock.ready.mockReset().mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('geographic workspace interactions and isolation',()=>{
  it('keeps a local selection with no matches empty',async()=>{
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await screen.findByTestId('map');
    fireEvent.change(screen.getByLabelText('Estado visible'),{target:{value:'abierto'}});
    fireEvent.change(screen.getByLabelText('Severidad visible'),{target:{value:'baja'}});
    expect(screen.getByText('Sin coincidencias geográficas')).toBeVisible();
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it('uses a backend segment key when selecting a chart',async()=>{
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await screen.findByTestId('map');
    fireEvent.click(screen.getByRole('button',{name:'Categoría: Agua potable, 5 registros informados'}));
    await waitFor(()=>expect(mock.fetch).toHaveBeenCalledTimes(2));
    expect(mock.fetch.mock.calls[1][0]).toMatchObject({categoria:'agua'});
  });
  it('keeps server filters as drafts until the operator applies them',async()=>{
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await screen.findByTestId('map');
    fireEvent.change(screen.getByLabelText('Categoría'),{target:{value:'agua'}});
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    mock.fetch.mockResolvedValue(data({points:[],segments_filters_applied:{categoria:'agua'}}));
    fireEvent.click(screen.getByRole('button',{name:'Aplicar filtros'}));
    await screen.findByText('Sin datos geográficos para esta consulta');
    expect(mock.fetch).toHaveBeenCalledTimes(2);
    expect(mock.fetch.mock.calls[1][0]).toMatchObject({categoria:'agua',tenantSlug:'org-a',tenant_profile_id:7});
  });
  it.each([401,403,500])('retires the map and prior segments after refresh fails with %s',async status=>{
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await screen.findByTestId('map');
    mock.fetch.mockRejectedValueOnce({status});
    fireEvent.click(screen.getByRole('button',{name:'Actualizar mapa'}));
    await screen.findByRole('alert');
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    expect(screen.queryByText('Agua potable')).not.toBeInTheDocument();
    expect(mock.fetch).toHaveBeenCalledTimes(2);
  });
  it('ignores a stale response from a previous organization session',async()=>{
    const old=deferred<ReturnType<typeof data>>();mock.fetch.mockReturnValueOnce(old.promise);
    const view=render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await waitFor(()=>expect(mock.fetch).toHaveBeenCalledTimes(1));
    mock.slug='org-b';
    mock.fetch.mockResolvedValueOnce(data({tenant_id:8,tenant_slug:'org-b',points:[],ui:{labels:{title:'Mapa B'}}}));
    view.rerender(<HeatmapDashboard tenantId={8} dateRange={period}/>);
    await screen.findByText('Mapa B');
    await act(async()=>old.resolve(data({ui:{labels:{title:'Mapa anterior'}}})));
    expect(screen.queryByText('Mapa anterior')).not.toBeInTheDocument();
    expect(screen.getByText('Mapa B')).toBeVisible();
  });
  it('keeps a stable request for equal date values',async()=>{
    const view=render(<HeatmapDashboard tenantId={7} dateRange={period}/>);await screen.findByTestId('map');
    view.rerender(<HeatmapDashboard tenantId={7} dateRange={{...period}} filters={{}}/>);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects an explicitly foreign map response',async()=>{
    mock.fetch.mockResolvedValue(data({tenant_slug:'other'}));
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await screen.findByRole('alert');expect(screen.queryByTestId('map')).not.toBeInTheDocument();
  });
  it('keeps only aggregate cells when raw locations are redacted',async()=>{
    mock.fetch.mockResolvedValue(data({metadata:{raw_points_redacted:true},cells:[{centroid_lat:-54,centroid_lon:-68,count:20}],geocoding:{candidates:[{address:'Private street'}]}}));
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    const map=await screen.findByTestId('map');
    const points=JSON.parse(map.getAttribute('data-points')!);
    expect(points).toHaveLength(1);expect(points[0].lat).toBe(-54);
    expect(screen.queryByText('Private street')).not.toBeInTheDocument();
  });
  it('does not request an unknown organization',()=>{
    mock.slug='';render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    expect(screen.getByRole('alert')).toBeVisible();expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('allows only one pending manual refresh',async()=>{
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);await screen.findByTestId('map');
    const pending=deferred<ReturnType<typeof data>>();mock.fetch.mockReturnValueOnce(pending.promise);
    const button=screen.getByRole('button',{name:'Actualizar mapa'});fireEvent.click(button);fireEvent.click(button);
    await waitFor(()=>expect(mock.fetch).toHaveBeenCalledTimes(2));await act(async()=>pending.resolve(data()));
  });
  it('bounds a hung read, retires prior figures and retries only on explicit action with the same filters',async()=>{
    vi.useFakeTimers();
    const filters={categoria:'agua'};
    mock.fetch.mockResolvedValueOnce(data({segments_filters_applied:filters}));
    render(<HeatmapDashboard tenantId={7} dateRange={period} filters={filters}/>);
    await act(async()=>{});
    expect(screen.getByTestId('map')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Categoría'),{target:{value:'luz'}});
    const late=deferred<ReturnType<typeof data>>();mock.fetch.mockReturnValueOnce(late.promise);
    fireEvent.click(screen.getByRole('button',{name:'Actualizar mapa'}));
    await act(async()=>{});
    const signal=mock.fetch.mock.calls[1][2].signal as AbortSignal;
    expect(screen.queryByTestId('map')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Categoría: Agua potable/})).not.toBeInTheDocument();
    await act(async()=>{await vi.advanceTimersByTimeAsync(STARTUP_CONTINUITY_BUDGET_MS+15_000);});
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo verificar el mapa');
    expect(signal.aborted).toBe(true);
    expect(mock.fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Categoría')).toHaveValue('luz');
    expect(screen.getByLabelText('Filtros solicitados')).toHaveTextContent('Categoría: agua');
    expect(screen.getByRole('button',{name:'Reintentar consulta'})).toBeEnabled();
    mock.fetch.mockResolvedValueOnce(data({points:[{lat:-33,lng:-68}],segments_filters_applied:filters,ui:{labels:{title:'Mapa recuperado'}}}));
    fireEvent.click(screen.getByRole('button',{name:'Reintentar consulta'}));
    await act(async()=>{});
    expect(screen.getByText('Mapa recuperado')).toBeVisible();
    expect(mock.fetch.mock.calls[2][0]).toEqual(mock.fetch.mock.calls[1][0]);
    await act(async()=>late.resolve(data({segments_filters_applied:filters,ui:{labels:{title:'Mapa tardío'}}})));
    expect(screen.queryByText('Mapa tardío')).not.toBeInTheDocument();
    expect(screen.getByText('Mapa recuperado')).toBeVisible();
    expect(mock.fetch).toHaveBeenCalledTimes(3);
  });
  it('bounds the entire attempt even when readiness never settles and does not dispatch after it retires',async()=>{
    vi.useFakeTimers();
    const startup=deferred<void>();mock.ready.mockReturnValueOnce(startup.promise);
    render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(HEATMAP_TOTAL_TIMEOUT_MS);});
    expect(screen.getByRole('alert')).toBeVisible();
    expect(mock.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Reintentar consulta'}));
    await act(async()=>{});
    expect(screen.getByTestId('map')).toBeVisible();
    await act(async()=>startup.resolve());
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts a retired organization read and keeps its late response away from the new organization',async()=>{
    vi.useFakeTimers();
    const late=deferred<ReturnType<typeof data>>();mock.fetch.mockReturnValueOnce(late.promise);
    const view=render(<HeatmapDashboard tenantId={7} dateRange={period}/>);
    await act(async()=>{});
    const signal=mock.fetch.mock.calls[0][2].signal as AbortSignal;
    mock.slug='org-b';mock.fetch.mockResolvedValueOnce(data({tenant_id:8,tenant_slug:'org-b',points:[],ui:{labels:{title:'Mapa B'}}}));
    view.rerender(<HeatmapDashboard tenantId={8} dateRange={period}/>);
    await act(async()=>{});
    expect(signal.aborted).toBe(true);
    await act(async()=>late.resolve(data({ui:{labels:{title:'Mapa anterior'}}})));
    expect(screen.queryByText('Mapa anterior')).not.toBeInTheDocument();
    expect(screen.getByText('Mapa B')).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
  });
});
