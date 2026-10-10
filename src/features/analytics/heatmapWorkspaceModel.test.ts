import { describe,expect,it } from 'vitest';
import { assertHeatmapScope,protectHeatmapPrivacy,isHeatmapRedacted,geoNumber } from './heatmapBoundary';
import { geoBreakdown,geoCoverage,geoFilters,heatmapMapModel,assertGeoFilterReceipt } from './heatmapWorkspaceModel';
const sample=()=>({points:[{lat:-33,lng:-68,estado:'abierto',severidad:'alta'},{lat:-34,lng:-69,estado:'cerrado',severidad:'baja'}]});
describe('geographic workspace data contracts',()=>{
  it.each([undefined,null,'',true,false,'NaN','Infinity',{},'0x10'])('does not coerce an invalid metric %j to zero',value=>expect(geoNumber(value)).toBeNull());
  it('preserves zero and decimal percentages without scaling',()=>{
    expect(geoNumber(0)).toBe(0); expect(geoCoverage({location_quality:{coverage_pct:.5,with_coordinates:1,without_coordinates:199,total:200}}).coverage).toBe(.5);
  });
  it.each([-1,101,NaN,Infinity])('rejects coverage outside percentage points: %j',value=>expect(geoCoverage({location_quality:{coverage_pct:value}}).coverage).toBeNull());
  it('does not reconcile a contradictory denominator silently',()=>expect(geoCoverage({location_quality:{total:10,with_coordinates:8,without_coordinates:9,coverage_pct:80}})).toMatchObject({inconsistent:true,coverage:null}));
  it('rejects foreign tenant id and slug without requiring missing legacy fields',()=>{
    expect(()=>assertHeatmapScope({tenant_slug:'b'},{tenantSlug:'a'})).toThrow();
    expect(()=>assertHeatmapScope({tenant:{id:8}},{tenant_id:7})).toThrow();
    expect(()=>assertHeatmapScope({points:[]},{tenantSlug:'a',tenant_id:7})).not.toThrow();
  });
  it('keeps zero matches empty instead of restoring points from the map adapter',()=>{
    const result=heatmapMapModel(sample(),{estado:'abierto',severidad:'baja'});
    expect(result.displayPoints).toEqual([]);expect(result.source).toBeUndefined();expect(result.config).toBeUndefined();expect(result.center).toBeUndefined();
  });
  it('removes unfiltered GeoJSON when applying a local filter',()=>{
    const result=heatmapMapModel({...sample(),geo_layers:{source:{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[-70,-30]},properties:{estado:'cerrado'}}]}}},{estado:'abierto',severidad:''});
    expect(result.displayPoints).toHaveLength(1);expect(result.source).toBeUndefined();expect(result.evidence.featureCount).toBe(0);
  });
  it.each([{raw_points_redacted:true},{metadata:{raw_points_redacted:true}},{privacy_mode:'cells_only'},{privacy:{raw_points_redacted:true}}])('honors explicit privacy even if the response accidentally contains raw points',flag=>{
    const raw={...sample(),...flag,cells:[{centroid_lat:-54,centroid_lon:-68,count:20}],geocoding:{candidates:[{address:'Private address'}]},geo_layers:{source:{type:'FeatureCollection',features:[{private:true}]}}};
    const protectedData=protectHeatmapPrivacy(raw);
    expect(isHeatmapRedacted(raw)).toBe(true);expect(protectedData.points).toEqual([]);expect(protectedData.geocoding).toBeUndefined();
    const result=heatmapMapModel(raw,{estado:'',severidad:''});
    expect(result.displayPoints).toHaveLength(1);expect(result.displayPoints[0].lat).toBe(-54);expect(result.evidence.usingCellFallback).toBe(true);
    expect(raw.points).toHaveLength(2);
  });
  it('does not add cell fallback after a nonmatching local filter',()=>{
    const result=heatmapMapModel({points:[],cells:[{centroid_lat:-54,centroid_lon:-68,count:4}]},{estado:'cerrado',severidad:''});
    expect(result.displayPoints).toEqual([]);expect(result.bounds).toEqual([]);
  });
  it('preserves backend segment keys and rejects invalid or ambiguous counts',()=>{
    const value={segments:{categoria:[{key:'agua',label:'Agua potable',count:0},{key:'seguridad',label:'Seguridad',count:5},{key:'dup',count:2},{key:'dup',count:3},{key:'bad',count:-1},{label:'Missing'}]}};
    expect(geoBreakdown(value,'categoria')).toEqual([{key:'seguridad',label:'Seguridad',count:5},{key:'agua',label:'Agua potable',count:0}]);
  });
  it('requires matching explicit filter echoes and does not claim absent echoes',()=>{
    expect(()=>assertGeoFilterReceipt({filters_applied:{categoria:'luz'}},geoFilters({categoria:'agua'}))).toThrow();
    expect(()=>assertGeoFilterReceipt({},geoFilters({categoria:'agua'}))).not.toThrow();
  });
  it('carries the synthetic indicator to the display model',()=>expect(heatmapMapModel({...sample(),metadata:{synthetic:true}},{estado:'',severidad:''}).synthetic).toBe(true));
});
describe('coordinate validation',()=>{
  it('excludes cells with empty coordinates',()=>{
    const payload={points:[],cells:[{centroid_lat:'',centroid_lon:' ',count:8}]};
    const result=heatmapMapModel(payload as unknown as Parameters<typeof heatmapMapModel>[0],{estado:'',severidad:''});
    expect(result.displayPoints).toEqual([]);
  });
});
