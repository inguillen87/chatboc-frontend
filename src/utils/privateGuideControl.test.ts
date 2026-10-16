import {describe,it,expect} from 'vitest';
import {readControlAccess,readActivationControl,readGuideControl,controlCommand,readControlReceipt} from './privateGuideControl';
import {tenant,descriptor,control,receipt} from '../../tests/fixtures/guide-control.synthetic';
const access=()=>readControlAccess(descriptor(),tenant)!;
describe('guide management contract',()=>{
 it('requires the published descriptor and exact organization',()=>{
  expect(readControlAccess(descriptor(),tenant)).not.toBeNull();
  expect(readControlAccess(undefined,tenant)).toBeNull();
  expect(readControlAccess({...descriptor(),tenant:{id:999,slug:tenant.slug}},tenant)).toBeNull();
  expect(readControlAccess({...descriptor(),endpoint:'https://other.example.invalid'},tenant)).toBeNull();
  expect(readActivationControl({contract_version:'tenant.channel_activation.v1',tenant,conversation_guide_control:descriptor()},tenant.slug)).not.toBeNull();
  expect(readActivationControl({contract_version:'tenant.channel_activation.v1',tenant,conversation_guide_control:descriptor()},'another')).toBeNull();
 });
 it.each(['tenant','revision','state','required_headers','command_contract_version','ui','can_enable','can_disable','writes_blocked'])('rejects incomplete status field %s',field=>{
  const raw:any=control();delete raw[field];expect(readGuideControl(raw,access())).toBeNull();
 });
 it.each([{evaluation_only:false},{provider_calls_performed:true},{operational_content_approved:true},{state:{enabled:'true',guide_id:'guide',version:0}},{can_enable:true,installed_guide:null},{writes_blocked:true}])('rejects unsafe state %j',patch=>{
  expect(readGuideControl({...control(),...patch},access())).toBeNull();
 });
 it('builds only the exact published command and permits revocation without an artifact',()=>{
  const current=readGuideControl(control(),access())!;
  expect(controlCommand(current,true)).toMatchObject({tenant,expected_revision:current.revision,enabled:true,expected_guide_sha256:'a'.repeat(64),expected_source_sha256:'b'.repeat(64),acknowledge_evaluation_only:true});
  const enabled=readGuideControl({...control(true,1),installed_guide:null,can_enable:false},access())!;
  expect(controlCommand(enabled,false)).not.toHaveProperty('expected_guide_sha256');
  expect(()=>controlCommand({...current,can_enable:false},true)).toThrow();
 });
 it.each([receipt(false,1),receipt(true,0),{...receipt(),tenant:{id:999,slug:tenant.slug}},{...receipt(),saved:false},{...receipt(),provider_calls_performed:true}])('rejects a mismatched mutation receipt',value=>{
  expect(readControlReceipt(value,access(),readGuideControl(control(),access())!,true)).toBeNull();
 });
});
