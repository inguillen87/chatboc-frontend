import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mock.fetch(...args),ApiError:class extends Error {constructor(message:string,public status=500){super(message);}}}));
import {analyticsService} from './analyticsService';
import {ApiError} from '@/utils/api';
const filters={tenant_id:7,tenantSlug:'geo-contract-test',from:'2026-09-01',to:'2026-09-24'};
beforeEach(()=>{mock.fetch.mockReset();});
describe('heatmap transport authority',()=>{
  it('preserves scope, privacy and metadata from the actual service response',async()=>{
    mock.fetch.mockResolvedValue({tenant_id:7,tenant_slug:filters.tenantSlug,points:[{lat:-33,lng:-68}],metadata:{raw_points_redacted:true,synthetic:true},cells:[{centroid_lat:-54,centroid_lon:-68,count:12}],geocoding:{candidates:[{address:'Hidden'}]},geo_layers:{source:{type:'FeatureCollection',features:[{sensitive:true}]}}});
    const result=await analyticsService.getHeatmap(filters);
    expect(result).toMatchObject({tenant_id:7,tenant_slug:filters.tenantSlug,points:[],metadata:{raw_points_redacted:true,synthetic:true},raw_points_redacted:true});
    expect(result.cells).toHaveLength(1);expect(result.geocoding).toBeUndefined();expect(result.geo_layers?.source).toBeUndefined();
  });
  it.each([401,403,500])('does not fall back after an authoritative operations failure %s',async status=>{
    mock.fetch.mockRejectedValueOnce(new ApiError('denied',status));
    await expect(analyticsService.getHeatmap(filters)).rejects.toMatchObject({status});
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401,403,500])('does not fall back to legacy after the hub fails with %s',async status=>{
    mock.fetch.mockRejectedValueOnce(new ApiError('missing',404)).mockRejectedValueOnce(new ApiError('denied',status));
    await expect(analyticsService.getHeatmap(filters)).rejects.toMatchObject({status});
    expect(mock.fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects foreign tenant envelopes without a second endpoint attempt',async()=>{
    mock.fetch.mockResolvedValueOnce({tenant_slug:'other',points:[]});
    await expect(analyticsService.getHeatmap(filters)).rejects.toThrow();expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it('preserves aggregate-only maps and their metadata when returned inside the hub',async()=>{
    mock.fetch.mockResolvedValueOnce({tenant_slug:filters.tenantSlug,sections:{mapas:{geo:{points:[],cells:[{centroid_lat:-54,centroid_lon:-68,count:9}],metadata:{privacy_mode:'cells_only'},location_quality:{coverage_pct:.5}}}}});
    const result=await analyticsService.getHeatmap(filters);
    expect(result.cells).toHaveLength(1);expect(result.points).toEqual([]);expect(result.metadata?.privacy_mode).toBe('cells_only');expect(result.location_quality?.coverage_pct).toBe(.5);
  });
  it('does not reuse a previously cached hub after a denial',async()=>{
    const own={...filters,tenantSlug:'cache-geo-test'};
    mock.fetch.mockResolvedValueOnce({tenant_slug:own.tenantSlug,sections:{mapas:{geo:{points:[{lat:-33,lng:-68}]}}}});
    await analyticsService.getHub(own);
    mock.fetch.mockReset().mockRejectedValueOnce(new ApiError('missing',404)).mockRejectedValueOnce(new ApiError('denied',403));
    await expect(analyticsService.getHeatmap(own)).rejects.toMatchObject({status:403});
    expect(mock.fetch).toHaveBeenCalledTimes(2);
  });
});
describe('geographic case identities',()=>{
  it('preserves exact source and ticket identity without using display numbers',async()=>{
    mock.fetch.mockResolvedValueOnce({tenant_slug:filters.tenantSlug,points:[{id:'MunicipioTicket:12',ticket_id:'12',nro_ticket:'9001',source_model:'MunicipioTicket',lat:-33,lng:-68}]});
    const response=await analyticsService.getHeatmap(filters);
    expect(response.points[0]).toMatchObject({ticket_id:'12',source_model:'MunicipioTicket'});
  });
  it('rejects a mixed-organization row before any map can consume its coordinates',async()=>{
    mock.fetch.mockResolvedValueOnce({tenant_slug:filters.tenantSlug,points:[{tenant_slug:'other',lat:-33,lng:-68}]});
    await expect(analyticsService.getHeatmap(filters)).rejects.toThrow();expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a foreign identity inside GeoJSON feature properties',async()=>{
    mock.fetch.mockResolvedValueOnce({tenant_slug:filters.tenantSlug,points:[],geo_layers:{source:{type:'FeatureCollection',features:[{geometry:{type:'Point',coordinates:[-68,-33]},properties:{tenant_id:8}}]}}});
    await expect(analyticsService.getHeatmap(filters)).rejects.toThrow();expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
});
