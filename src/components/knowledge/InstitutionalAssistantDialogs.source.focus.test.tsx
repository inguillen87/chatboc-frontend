import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {KnowledgeSourceDialog} from './InstitutionalAssistantDialogs';
import {readKnowledgeSource,type KnowledgeSourceDocument} from './institutionalAssistantSource';
import type {KnowledgeWorkspace} from './institutionalAssistantContract';

vi.mock('@/utils/api',()=>({apiFetch:vi.fn(()=>{throw new Error('Network forbidden in source focus tests');})}));
vi.mock('@/stores',()=>({usePanelSessionStore:{getState:()=>({authToken:null,user:null}),subscribe:()=>()=>{}}}));
vi.mock('./institutionalAssistantSource',async importOriginal=>({
 ...await importOriginal<typeof import('./institutionalAssistantSource')>(),readKnowledgeSource:vi.fn(),
}));

const result:KnowledgeSourceDocument={blob:new Blob(['Synthetic focus QA'],{type:'text/plain'}),text:'Synthetic focus QA',filename:'focus-qa.txt',format:'text'};
const model=():KnowledgeWorkspace=>{
 const value=workspace({visibility:'public',can_edit:false});
 value.knowledge!.sources=[{...value.knowledge!.sources[0],title:'Fuente sintética QA',format:'text',pagination:'logical_snapshot',page_count:1,
  delivery:{contract_version:'chatboc.knowledge_source_delivery.v1',format:'text',mime_type:'text/plain',sha256:'a'.repeat(64),filename:'focus-qa.txt',document_visibility:'public',publicly_accessible:true}}];
 return value;
};
const readButton=()=>screen.getByRole('button',{name:/^Leer documento\s*:\s*Fuente sintética QA$/});
const pendingButton=()=>screen.getByRole('button',{name:/^Consultando documento…\s*:\s*Fuente sintética QA$/});
const defer=()=>{
 let resolve!:(value:KnowledgeSourceDocument)=>void,reject!:(reason:unknown)=>void;
 const promise=new Promise<KnowledgeSourceDocument>((ok,no)=>{resolve=ok;reject=no;});
 return {promise,resolve,reject};
};
const mount=(value=model(),open=true)=>{
 const changed=vi.fn(),restore=vi.fn();
 const view=(next:KnowledgeWorkspace,visible:boolean)=>
  <KnowledgeSourceDialog workspace={next} open={visible} mode="public" onOpenChange={changed} restoreFocus={restore}/>;
 const rendered=render(view(value,open));
 return {...rendered,view,changed,restore,value};
};
async function begin(){
 const user=userEvent.setup(),button=readButton();button.focus();await user.keyboard('{Enter}');
 await waitFor(()=>expect(pendingButton()).toBeDisabled());
 // JSDOM does not perform Chromium's native disabled blur. Model that state;
 // the separate controlled browser fixture proves the native transition.
 act(()=>button.blur());
 return {user,button};
}
beforeEach(()=>{
 vi.mocked(readKnowledgeSource).mockReset();
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network forbidden in source focus tests');}));
 vi.stubGlobal('URL',class extends URL{static createObjectURL=vi.fn(()=> 'blob:synthetic-focus-qa');static revokeObjectURL=vi.fn();});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('document consult focus ownership',()=>{
 it.each(['success','denial'] as const)('returns to the same enabled reader after %s',async outcome=>{
  const pending=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(pending.promise);mount();
  const {user,button}=await begin();
  await user.keyboard('{Enter} ');fireEvent.click(button);
  expect(readKnowledgeSource).toHaveBeenCalledTimes(1);
  await act(async()=>{if(outcome==='success')pending.resolve(result);else pending.reject({status:403});});
  await waitFor(()=>expect(readButton()).toBeEnabled());expect(readButton()).toBe(button);expect(button).toHaveFocus();
  if(outcome==='success')expect(screen.getByRole('link',{name:/Descargar texto extraído/})).toBeVisible();
  else expect(screen.getByRole('alert')).toHaveTextContent('No pudimos confirmar tu acceso a este documento.');
 });
 it('accepts only an automatic transfer to its exact Radix dialog container',async()=>{
  const pending=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(pending.promise);mount();const {button}=await begin();
  act(()=>screen.getByRole('dialog').focus());expect(screen.getByRole('dialog')).toHaveFocus();
  await act(async()=>pending.resolve(result));await waitFor(()=>expect(button).toHaveFocus());
 });
 it.each([false,true])('does not steal focus after another dialog control is selected, then blurred=%s',async blur=>{
  const pending=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(pending.promise);mount();await begin();
  const close=screen.getByRole('button',{name:'Cerrar fuentes'});
  act(()=>{close.focus();if(blur)close.blur();});
  await act(async()=>pending.resolve(result));await waitFor(()=>expect(readButton()).toBeEnabled());
  if(blur){expect(readButton()).not.toHaveFocus();expect([document.body,screen.getByRole('dialog')]).toContain(document.activeElement);}else expect(close).toHaveFocus();
 });
 it.each(['tenant','revision'] as const)('retires focus ownership before a %s change and ignores late completion',async scope=>{
  const pending=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(pending.promise);const mounted=mount();const {button}=await begin();
  const next={...mounted.value,...(scope==='tenant'?{tenant:{id:702,slug:'qa-other',name:'Otra institución QA'}}:{revision:'c'.repeat(64)})};
  mounted.rerender(mounted.view(next,true));
  const close=screen.getByRole('button',{name:'Cerrar fuentes'});act(()=>{close.focus();close.blur();});
  await act(async()=>pending.resolve(result));
  expect([document.body,screen.getByRole('dialog')]).toContain(document.activeElement);expect(button).not.toHaveFocus();expect(screen.queryByRole('link',{name:/Descargar/})).not.toBeInTheDocument();
 });
 it('retires a closed consult and removes its focus tracking listeners',async()=>{
  const pending=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(pending.promise);const mounted=mount();
  const add=vi.spyOn(document,'addEventListener'),remove=vi.spyOn(document,'removeEventListener');
  await begin();const handlers=add.mock.calls.filter(([type])=>type==='focusin'||type==='focusout');
  expect(handlers).toHaveLength(2);
  mounted.rerender(mounted.view(mounted.value,false));
  for(const [type,handler]of handlers)expect(remove).toHaveBeenCalledWith(type,handler);
  await act(async()=>pending.resolve(result));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:/Descargar/})).not.toBeInTheDocument();
 });
 it('cleans the listeners on unmount and ignores the late consult',async()=>{
  const pending=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(pending.promise);const mounted=mount();
  const add=vi.spyOn(document,'addEventListener'),remove=vi.spyOn(document,'removeEventListener');await begin();
  const handlers=add.mock.calls.filter(([type])=>type==='focusin'||type==='focusout');mounted.unmount();
  for(const [type,handler]of handlers)expect(remove).toHaveBeenCalledWith(type,handler);
  await act(async()=>pending.resolve(result));expect(document.body).toHaveFocus();
 });
 it('preserves focus ownership independently for a repeated consult of the same document',async()=>{
  const first=defer(),second=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);mount();
  const {button}=await begin();await act(async()=>first.resolve(result));await waitFor(()=>expect(button).toHaveFocus());
  await begin();await act(async()=>second.reject({status:403}));await waitFor(()=>expect(button).toHaveFocus());
  expect(readKnowledgeSource).toHaveBeenCalledTimes(2);expect(screen.queryByRole('link',{name:/Descargar/})).not.toBeInTheDocument();
 });
 it('does not acquire ownership from a programmatic click while the title owns focus',async()=>{
  const pending=defer();vi.mocked(readKnowledgeSource).mockReturnValueOnce(pending.promise);mount();
  const title=screen.getByRole('heading',{name:'Documentos y fuentes'});expect(title).toHaveFocus();
  fireEvent.click(readButton());await act(async()=>pending.resolve(result));await waitFor(()=>expect(readButton()).toBeEnabled());expect(title).toHaveFocus();
 });
});
