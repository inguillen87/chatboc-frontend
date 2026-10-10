import {describe,expect,it} from 'vitest';
import {readGuideAccess,readActivationGuide,readPrivateGuide} from './privateConversationGuide';
import {guideAccess,guideActivation,guideTenant,guideNode} from '../../tests/fixtures/private-guide.synthetic';
const access=readGuideAccess(guideAccess,guideTenant)!;
const change=(value:any,path:string,next:unknown)=>{const keys=path.split('.');let ref=value;for(const key of keys.slice(0,-1))ref=ref[key];ref[keys.at(-1)!]=next;return value;};
describe('server-published private guide',()=>{
 it('projects the access descriptor without accepting extra fields',()=>{
  expect(access).not.toBeNull();
  expect(readGuideAccess({...guideAccess,private_token:'must-not-copy'},guideTenant)).toEqual(access);
  expect(readActivationGuide(guideActivation(),guideTenant.slug)).toEqual(access);
 });
 it.each([['contract_version','other'],['tenant.id',702],['tenant.slug','other'],['evaluation_only',false],
  ['guide_id','../path'],['endpoint','https://foreign.test/api'],['endpoint','/api/admin/tenants/other/conversation-guide'],
  ['endpoint','/api/admin/tenants/qa-guide/conversation-guide?tenant=other'],['ui.error',''],['ui.open',null]])('rejects access %s', (path,next)=>{
  expect(readGuideAccess(change(structuredClone(guideAccess),path,next),guideTenant)).toBeNull();
 });
 it('supports canonical Unicode tenant identities without changing their value',()=>{
  const tenant={id:701,slug:'peñalolén'};
  expect(readGuideAccess({...guideAccess,tenant,endpoint:`/api/admin/tenants/${encodeURIComponent(tenant.slug)}/conversation-guide`},tenant)?.tenant).toEqual(tenant);
 });
 it.each(['../other','x/y','x\\y','%2fother',' ',String.fromCharCode(0)])('rejects unsafe tenant %j',slug=>{
  const tenant={id:701,slug};expect(readGuideAccess({...guideAccess,tenant},tenant)).toBeNull();
 });
 it.each([null,{}, {contract_version:'tenant.channel_activation.v1'},
  {...guideActivation(),tenant:{id:701,slug:'other'}},
  {...guideActivation(),organization_setup:{tenant:{id:702,slug:guideTenant.slug},conversation_guide:guideAccess}}])('does not manufacture an access descriptor %j',value=>{
  expect(readActivationGuide(value,guideTenant.slug)).toBeNull();
 });
 it.each([['contract_version','other'],['tenant.id',702],['tenant.slug','other'],['guide_id','other'],
  ['evaluation_only',false],['writes_performed',true],['provider_calls_performed',true],['policy.accepts_personal_data',true],
  ['policy.creates_real_cases',true],['policy.queries_official_records',true],['policy.sends_notifications',true],['policy.stores_feedback',true],
  ['guide_sha256','bad'],['source.sha256','bad'],['source.page_count',0],['source.page_count',1.5],['source.label',''],
  ['source.approval_status',''],['ui.heading',''],['menu.id','other'],['menu.source_pages',[0]],['menu.source_pages',[15]],
  ['menu.source_pages',[1,1]],['menu.source_pages',[]],['menu.actions',[{code:'1',label:'x',target:'../x'}]],
  ['menu.actions',[{code:'1',label:'x',target:'main'},{code:'1',label:'y',target:'main'}]]])('rejects private response %s', (path,next)=>{
  expect(readPrivateGuide(change(guideNode(),path,next),access,'start')).toBeNull();
 });
 it('keeps source references, plain text and only the intended menu fields',()=>{
  const raw=guideNode();(raw.menu as any).private_token='must-not-copy';raw.menu.text='<script>not executable</script>';
  const result=readPrivateGuide(raw,access,'start');
  expect(result?.menu.text).toBe(raw.menu.text);expect(result?.menu.source_pages).toEqual([1,2]);
  expect(JSON.stringify(result)).not.toContain('must-not-copy');expect(result?.source.sha256).toBe('b'.repeat(64));
 });
});
