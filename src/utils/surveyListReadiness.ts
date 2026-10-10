import type {SurveyListResponse} from '@/types/encuestas';
export type SurveyListPhase = 'missing_scope' | 'loading' | 'refreshing' | 'ready' | 'partial_error' | 'error';
export interface SurveyListReadState {phase:SurveyListPhase; pages:number; receivedAt:number|null}
export class SurveyListContractError extends Error {
  constructor(){super('No se pudo verificar la organización o la continuidad del listado. Actualizá la consulta antes de operar.');this.name='SurveyListContractError';}
}
const fail=():never=>{throw new SurveyListContractError();};
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const positiveId=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const normalizedSlug=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():null;
export const activeSurveyListTenant=(value:unknown):string|null=>{
  const slug=normalizedSlug(value);return slug&&/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug)&&slug.length<=128?slug:null;
};
export function isSurveyReadAuthorityFailure(error:unknown):boolean{
  const value=record(error);
  return [401,403,404].includes(Number(value.status))||error instanceof SurveyListContractError||
    ['survey_admin_tenant_mismatch','survey_admin_tenant_required'].includes(String(value.message));
}
function scope(value:unknown,slug:string,id?:number){
  const row=record(value);
  for(const reported of [row.tenant_slug,row.tenantSlug])if(reported!=null&&normalizedSlug(reported)!==slug)fail();
  if(id!==undefined&&row.tenant_id!=null&&String(row.tenant_id)!==String(id))fail();
}
export function assertSurveyListPage(page:SurveyListResponse,slug:string,cursor:string|null):void{
  if(!page||!Array.isArray(page.data))fail();
  const tenant=record(page.tenant);scope(page,slug);
  if(tenant.slug!=null&&normalizedSlug(tenant.slug)!==slug)fail();
  if(page.contract_version==='surveys.admin_list.v2'&&(!positiveId(tenant.id)||normalizedSlug(tenant.slug)!==slug))fail();
  const tenantId=positiveId(tenant.id)?Number(tenant.id):undefined;
  const ids=new Set<number>();
  for(const item of page.data){if(!positiveId(item?.id)||ids.has(item.id))fail();ids.add(item.id);scope(item,slug,tenantId);}
  const paging=page.pagination;if(!paging)return;
  if(typeof paging.has_more!=='boolean')fail();
  if(paging.cursor!=null&&paging.cursor!==cursor)fail();
  if(paging.returned!=null&&paging.returned!==page.data.length)fail();
  if(paging.total_items!=null&&(!Number.isSafeInteger(paging.total_items)||paging.total_items<page.data.length))fail();
  if(paging.has_more&&(typeof paging.next_cursor!=='string'||!paging.next_cursor.trim()||paging.next_cursor===cursor||!page.data.length))fail();
}
export function assertSurveyListCollection(pages:SurveyListResponse[],slug:string,initialCursor:string|null=null):void{
  const ids=new Set<number>(),cursors=new Set<string>();let cursor:string|null=initialCursor,tenantId:number|undefined;
  for(const page of pages){
    assertSurveyListPage(page,slug,cursor);
    if(page.tenant?.id!=null){if(tenantId!==undefined&&tenantId!==page.tenant.id)fail();tenantId=page.tenant.id;}
    for(const item of page.data){if(ids.has(item.id))fail();ids.add(item.id);scope(item,slug,tenantId);}
    const next=page.pagination?.has_more?page.pagination.next_cursor:null;
    if(next){if(cursors.has(next))fail();cursors.add(next);cursor=next;}
  }
  const total=pages.at(-1)?.pagination?.total_items;
  if(total!=null&&total<ids.size)fail();
}
export function reportedSurveyListTotal(page:SurveyListResponse|undefined):number|null{
  const value=page?.pagination?.total_items??page?.meta?.total;
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
}
