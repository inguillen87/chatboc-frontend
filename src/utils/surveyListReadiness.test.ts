import {describe,expect,it} from 'vitest';
import type {SurveyListResponse} from '@/types/encuestas';
import {activeSurveyListTenant,assertSurveyListPage,assertSurveyListCollection,reportedSurveyListTotal} from './surveyListReadiness';
const list=(extra={})=>({contract_version:'surveys.admin_list.v2',tenant:{id:7,slug:'org-a'},data:[{id:12,tenant_id:7}],...extra}) as unknown as SurveyListResponse;
const paging=(cursor:string|null,next:string|null)=>({cursor,next_cursor:next,has_more:next!==null,returned:1,total_items:2});
describe('survey listing continuity',()=>{
  it.each(['','../org-a','org/a','https://other.invalid',null])('rejects non-scoped identifiers %s',slug=>expect(activeSurveyListTenant(slug)).toBeNull());
  it('keeps historical underscore identifiers without changing the organization',()=>expect(activeSurveyListTenant(' Org_A ')).toBe('org_a'));
  it('checks all explicit tenant aliases',()=>{
    expect(()=>assertSurveyListPage(list({tenant_slug:'other'}),'org-a',null)).toThrow();
    expect(()=>assertSurveyListPage(list({data:[{id:12,tenant_id:8}]}),'org-a',null)).toThrow();
  });
  it('requires a matching identity for a versioned response',()=>{
    expect(()=>assertSurveyListPage(list({tenant:{id:7,slug:'other'}}),'org-a',null)).toThrow();
    expect(()=>assertSurveyListPage(list({tenant:undefined}),'org-a',null)).toThrow();
  });
  it.each([0,-1,1.1,'12',NaN])('rejects ambiguous survey id %s',id=>expect(()=>assertSurveyListPage(list({data:[{id}]}),'org-a',null)).toThrow());
  it('refuses an advancing flag without a usable cursor',()=>{
    for(const next_cursor of [null,'','next']){
      const page=list({pagination:{...paging('next',next_cursor),has_more:true}});
      expect(()=>assertSurveyListPage(page,'org-a','next')).toThrow();
    }
  });
  it('detects a cursor cycle across pages',()=>{
    const pages=[list({pagination:paging(null,'one')}),list({data:[{id:11,tenant_id:7}],pagination:paging('one','two')}),list({data:[{id:10,tenant_id:7}],pagination:{...paging('two','one'),total_items:3}})];
    expect(()=>assertSurveyListCollection(pages,'org-a')).toThrow();
  });
  it('rejects a server total below the number already loaded',()=>{
    const pages=[list({pagination:paging(null,'one')}),list({data:[{id:11,tenant_id:7}],pagination:{...paging('one',null),total_items:1}})];
    expect(()=>assertSurveyListCollection(pages,'org-a')).toThrow();
  });
  it('allows incomplete legacy rows without fabricating a total',()=>{
    const page={data:[{id:12}]} as SurveyListResponse;expect(()=>assertSurveyListPage(page,'org-a',null)).not.toThrow();expect(reportedSurveyListTotal(page)).toBeNull();
  });
});
