import React from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {workspace,assistantUi} from '../../../tests/fixtures/institutional-assistant.synthetic';
// Only the unrelated original-document transport is replaced. The review
// component, metadata component, Dialog wrapper and Radix primitives are real.
vi.mock('./institutionalAssistantContract',()=>({knowledgeSourceExternalUrl:()=>null,knowledgeSourceOriginalAllowed:()=>false}));
vi.mock('./institutionalAssistantSource',()=>({readKnowledgeSource:vi.fn(()=>{throw new Error('No source read allowed');}),knowledgeSourceReadMessage:()=>'',subscribeKnowledgeSourceAuthority:()=>()=>{}}));
import {KnowledgeReviewDialog,type KnowledgeReview} from './InstitutionalAssistantDialogs';

const current=()=>{const model=workspace();model.ui={...model.ui};model.knowledge!.version='V1';return model;};
const proposed=()=>({contract_version:'chatboc.institutional_guide.composed.v1',tenant:{id:701,slug:'qa-knowledge'},version:'V2',start:'start',
 sources:{'source-b':{id:'source-b',title:'Documento sintético B',sha256:'c'.repeat(64),page_count:1}},
 nodes:{start:{id:'start',title:'Inicio',text:'Información sintética de prueba.',actions:[]}},node_evidence:{start:[{source_id:'source-b',pages:[1]}]},
 policy:{accepts_personal_data:false,creates_real_cases:false,queries_official_records:false,sends_notifications:false,stores_feedback:false},
 evaluation_only:true,approval_status:'pending_institutional_approval'});
function open(pending:KnowledgeReview,model=current()){
 const confirm=vi.fn(),cancel=vi.fn(),restore=vi.fn();
 const result=render(<KnowledgeReviewDialog workspace={model} pending={pending} onConfirm={confirm} onCancel={cancel} restoreFocus={restore}/>);
 return {...result,confirm,cancel,restore,model};
}
afterEach(cleanup);
describe('knowledge import review through real Dialog and Radix',()=>{
 it('distinguishes proposed V2 from current V1 before a generic-file import is confirmed',()=>{
  const {confirm}=open({operation:'import',filename:'knowledge.json',bundle:proposed()});
  expect(screen.getByRole('dialog',{name:'Incorporar conocimiento'})).toBeVisible();
  expect(screen.getByText('knowledge.json')).toBeVisible();
  expect(within(screen.getByRole('group',{name:assistantUi.import_review_proposed_version})).getByText('V2')).toBeVisible();
  expect(within(screen.getByRole('group',{name:assistantUi.import_review_current_version})).getByText('V1')).toBeVisible();
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirmar cambio'}));expect(confirm).toHaveBeenCalledOnce();
 });
 it('shows declared metadata and target context literally without claiming institutional approval',()=>{
  const bundle=proposed();bundle.approval_status='<img src=x onerror=LOCAL_SENTINEL>';
  const {confirm}=open({operation:'import',filename:'knowledge.json',bundle});
  const preview=screen.getByRole('group',{name:assistantUi.import_review_proposed_version});
  expect(within(preview).getByText('qa-knowledge')).toBeVisible();
  expect(within(preview).getByText('1')).toBeVisible();
  expect(within(preview).getByText(assistantUi.import_review_yes)).toBeVisible();
  expect(within(preview).getByText(bundle.approval_status)).toBeVisible();
  expect(screen.getByText(assistantUi.import_review_notice)).toBeVisible();
  expect(document.querySelector('img,script')).toBeNull();expect(confirm).not.toHaveBeenCalled();
 });
 it.each([null,[],{version:{value:'V2'},tenant:'invalid',sources:[],evaluation_only:'true',approval_status:{approved:true}}])('does not replace malformed proposed metadata with V1: %j',bundle=>{
  open({operation:'import',filename:'knowledge.json',bundle});
  const preview=screen.getByRole('group',{name:assistantUi.import_review_proposed_version});
  expect(within(preview).queryByText('V1')).not.toBeInTheDocument();
  expect(within(preview).getAllByText(assistantUi.import_review_not_reported).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(assistantUi.import_review_notice)).toBeVisible();
 });
 it('shows an import proposal even when no current version exists',()=>{
  const model=current();model.knowledge=null;
  open({operation:'import',bundle:proposed()},model);
  expect(within(screen.getByRole('group',{name:assistantUi.import_review_current_version})).getByText(assistantUi.import_review_empty_current)).toBeVisible();
  expect(within(screen.getByRole('group',{name:assistantUi.import_review_proposed_version})).getByText('V2')).toBeVisible();
 });
 it.each(['publish','retire'] as const)('retains the current version and explicit confirmation for %s',operation=>{
  const {confirm,cancel,model}=open({operation});
  expect(screen.getByRole('dialog',{name:operation==='publish'?model.ui.publish:model.ui.retire})).toBeVisible();
  expect(screen.getByText(new RegExp('V1'))).toBeVisible();
  expect(screen.getByText(operation==='publish'?model.ui.confirm_publish:model.ui.confirm_retire)).toBeVisible();
  expect(screen.queryByRole('group',{name:assistantUi.import_review_proposed_version})).not.toBeInTheDocument();
  expect(confirm).not.toHaveBeenCalled();expect(cancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:model.ui.confirm}));expect(confirm).toHaveBeenCalledOnce();
 });
 it('keeps cancel as the initial focused action and never confirms on cancel',()=>{
  const {confirm,cancel}=open({operation:'import',bundle:proposed()});
  const button=screen.getByRole('button',{name:'Cancelar'});expect(button).toHaveFocus();
  fireEvent.click(button);expect(cancel).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled();
 });
 it('renders custom JSON copy rather than local labels',()=>{
  const model=current();
  for(const key of Object.keys(assistantUi).filter(key=>key.startsWith('import_review_')))model.ui[key]='SERVER '+key;
  model.ui.import_review_current_version='<mark>SERVER current</mark>';
  open({operation:'import',bundle:proposed()},model);
  expect(screen.getByRole('group',{name:model.ui.import_review_current_version})).toBeVisible();
  const next=screen.getByRole('group',{name:model.ui.import_review_proposed_version});
  expect(within(next).getByText(model.ui.import_review_evaluation_only)).toBeVisible();
  expect(within(next).getByText(model.ui.import_review_yes)).toBeVisible();
  expect(screen.getByText(model.ui.import_review_notice)).toBeVisible();
  expect(screen.queryByText(assistantUi.import_review_current_version)).not.toBeInTheDocument();
  expect(document.querySelector('mark')).toBeNull();
 });
 it('keeps an old backend import usable with its existing copy and proposed version only',()=>{
  const model=current();for(const key of Object.keys(model.ui))if(key.startsWith('import_review_'))delete model.ui[key];
  const {confirm}=open({operation:'import',filename:'knowledge.json',bundle:proposed()},model);
  expect(screen.getByText(model.ui.import_help)).toBeVisible();expect(screen.getByText('knowledge.json')).toBeVisible();
  expect(screen.getByText(model.ui.version+' V2')).toBeVisible();expect(screen.queryByText(/V1/)).not.toBeInTheDocument();
  expect(screen.queryByRole('group')).not.toBeInTheDocument();expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:model.ui.confirm}));expect(confirm).toHaveBeenCalledOnce();
 });
 it.each([undefined,'','x'.repeat(1001),42])('uses basic compatible review when one optional copy value is invalid: %j',bad=>{
  const model=current();(model.ui as Record<string,unknown>).import_review_notice=bad;
  open({operation:'import',filename:'knowledge.json',bundle:proposed()},model);
  expect(screen.getByText(model.ui.import_help)).toBeVisible();expect(screen.getByText(model.ui.version+' V2')).toBeVisible();
  expect(screen.queryByText(/V1/)).not.toBeInTheDocument();expect(screen.queryByRole('group')).not.toBeInTheDocument();
 });
 it('does not show V1 as the proposed version with old copy and malformed metadata',()=>{
  const model=current();for(const key of Object.keys(model.ui))if(key.startsWith('import_review_'))delete model.ui[key];
  open({operation:'import',filename:'knowledge.json',bundle:{version:{invalid:'V2'}}},model);
  expect(screen.getByText(model.ui.import_help)).toBeVisible();expect(screen.getByText('knowledge.json')).toBeVisible();
  expect(screen.queryByText(/V1|V2/)).not.toBeInTheDocument();expect(screen.queryByRole('group')).not.toBeInTheDocument();
 });

});

// The scroll body must be in the Tab sequence even though Cancel receives
// initial focus. jsdom proves focus reachability, not physical scrolling.
describe('keyboard entry to the real knowledge review region',()=>{
 it.each(['import','publish','retire'] as const)('lets Tab reach the named body for %s without confirming',async operation=>{
  const {confirm,cancel,model}=open({operation,...(operation==='import'?{bundle:proposed(),filename:'knowledge.json'}:{})});
  const heading=operation==='import'?model.ui.import:operation==='publish'?model.ui.publish:model.ui.retire;
  const region=screen.getByRole('region',{name:heading});
  const cancelButton=screen.getByRole('button',{name:model.ui.cancel});
  const confirmButton=screen.getByRole('button',{name:model.ui.confirm});
  expect(region).toBeVisible();expect(region).toHaveAttribute('tabindex','0');
  expect(cancelButton).toHaveFocus();
  const user=userEvent.setup();
  await user.tab();expect(confirmButton).toHaveFocus();
  await user.tab();expect(region).toHaveFocus();
  await user.tab();expect(cancelButton).toHaveFocus();
  expect(confirm).not.toHaveBeenCalled();expect(cancel).not.toHaveBeenCalled();
 });
});
