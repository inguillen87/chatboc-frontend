import React from 'react';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const mock=vi.hoisted(()=>({slug:'org-a',fetch:vi.fn()}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:mock.slug})}));
vi.mock('@/services/analyticsService',()=>({analyticsService:{getHeatmap:mock.fetch}}));
vi.mock('@/components/LazyMapLibreMap',()=>({default:({heatmapData,geoLayerConfig}:any)=><div data-testid="map" data-points={JSON.stringify(heatmapData)} data-features={geoLayerConfig?.source?.features?.length||0}>Mapa de prueba</div>}));
import HeatmapDashboard from './HeatmapDashboard';
const period={from:'2026-09-01',to:'2026-09-24'};
const data=(extra:Record<string,unknown>={})=>({tenant_id:7,tenant_slug:'org-a',points:[{lat:-33,lng:-68,estado:'abierto',severidad:'alta',categoria:'agua'},{lat:-34,lng:-69,estado:'cerrado',severidad:'baja',categoria:'luz'}],segments:{categoria:[{key:'agua',label:'Agua potable',count:5},{key:'luz',label:'Luminarias',count:2}]},...extra});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
beforeEach(()=>{mock.slug='org-a';mock.fetch.mockReset().mockResolvedValue(data());});
afterEach(cleanup);
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
    expect(mock.fetch.mock.calls[1][0]).toMatchObject({categoria:'agua',tenantSlug:'org-a',tenant_id:7});
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
    expect(mock.fetch).toHaveBeenCalledTimes(2);await act(async()=>pending.resolve(data()));
  });
});
