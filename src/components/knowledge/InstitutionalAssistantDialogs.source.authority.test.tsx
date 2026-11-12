import React,{useState} from 'react';
import {webcrypto} from 'node:crypto';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {usePanelSessionStore,type PanelUser} from '@/stores/panelSessionStore';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import type {KnowledgeSource,KnowledgeWorkspace} from './institutionalAssistantContract';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),create:vi.fn(),revoke:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {KnowledgeSourceDialog} from './InstitutionalAssistantDialogs';
import {readKnowledgeSource} from './institutionalAssistantSource';

// Real dialog, source verification, panel store and safe storage. Only GET replies
// and Blob URL allocation are synthetic; no UserProvider, server or owner identity.
const body='SOURCE_AUTHORITY_QA: texto sintético sin datos privados.';
const bytes=new TextEncoder().encode(body);
const actor=():PanelUser=>({id:'qa-source-actor',email:'authority@example.test',rol:'admin',tenant_slug:'qa-knowledge',name:'Presentación QA',
 permissions:['knowledge.read','knowledge.review'],capabilities:['knowledge.read','knowledge.review'],scopes:['knowledge.read','knowledge.review']});
type Field='rol'|'role'|'permissions'|'capabilities'|'scopes';
type Phase='pending'|'ready';
const deferred=()=>{let resolve!:(value:Response)=>void;return {promise:new Promise<Response>(done=>{resolve=done;}),resolve};};
const response=()=>new Response(bytes,{headers:{'Content-Type':'text/plain','Content-Length':String(bytes.length)}});
const readButton=()=>screen.getByRole('button',{name:/^Leer documento\s*:\s*Fuente QA autoridad$/});
const download=()=>screen.queryByRole('link',{name:/^Descargar texto extraído\s*:\s*Fuente QA autoridad$/});
async function model(mode:'admin'|'public'='admin'){
 const hash=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const visible=mode==='public'?'public':'private';
 const source:KnowledgeSource={id:'source-authority-qa',title:'Fuente QA autoridad',sha256:hash,page_count:1,url:null,format:'text',mime_type:'text/plain',byte_size:bytes.length,
  pagination:'logical_snapshot',document_visibility:visible,delivery:{contract_version:'chatboc.knowledge_source_delivery.v1',format:'text',mime_type:'text/plain',sha256:hash,
   byte_size:bytes.length,filename:'authority-qa.txt',document_visibility:visible,publicly_accessible:mode==='public'}};
 const value=workspace(mode==='public'?{visibility:'public',can_edit:false}:{});value.knowledge!.sources=[source];value.knowledge!.initial.sources=[source];
 return {value,source};
}
async function start(phase:Phase='pending',mode:'admin'|'public'='admin'){
 const {value,source}=await model(mode),old=deferred(),changed=vi.fn(),restore=vi.fn();mocks.fetch.mockReturnValueOnce(old.promise);
 function Controlled({next}:{next:KnowledgeWorkspace}){
  const [open,setOpen]=useState(true);
  return <KnowledgeSourceDialog workspace={next} open={open} mode={mode} onOpenChange={visible=>{changed(visible);setOpen(visible);}} restoreFocus={restore}/>;
 }
 const mounted=render(<Controlled next={value}/>);fireEvent.click(readButton());
 await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());
 const options=mocks.fetch.mock.calls[0][1] as {isCurrent:()=>boolean;signal:AbortSignal};
 expect(options.isCurrent()).toBe(true);expect(options.signal.aborted).toBe(false);
 expect(mocks.fetch.mock.calls[0][0]).toBe(`/api/${mode}/tenants/qa-knowledge/institutional-assistant/sources/source-authority-qa?revision=${value.revision}`);
 if(phase==='ready'){await act(async()=>{old.resolve(response());});await waitFor(()=>expect(download()).toBeInTheDocument());expect(screen.getByText(body)).toBeInTheDocument();}
 return {value,source,old,changed,restore,mounted,options};
}
const change=(field:Field)=>{
 const previous=usePanelSessionStore.getState().user!;
 usePanelSessionStore.getState().setUser({...previous,[field]:field==='rol'||field==='role'?'viewer':['knowledge.review']});
};
const noDocument=()=>{
 expect.soft(download()).not.toBeInTheDocument();expect.soft(screen.queryByText(body)).not.toBeInTheDocument();
 expect.soft(screen.queryByRole('status')).not.toBeInTheDocument();expect.soft(screen.queryByRole('alert')).not.toBeInTheDocument();
};
async function retires(phase:Phase,mutation:()=>void){
 const pending=await start(phase);let beforeCommit=true;
 act(()=>{mutation();beforeCommit=pending.options.isCurrent();});
 expect.soft(beforeCommit).toBe(false);expect.soft(pending.options.isCurrent()).toBe(false);
 // The completed reader detaches its local signal in finally. Ready retirement
 // is verified by its invalid guard and revoked URL, not aborting past transport.
 if(phase==='pending')expect.soft(pending.options.signal.aborted).toBe(true);
 expect.soft(pending.changed).toHaveBeenCalledExactlyOnceWith(false);noDocument();
 if(phase==='pending'){
  await act(async()=>{pending.old.resolve(response());});
  expect.soft(mocks.create).not.toHaveBeenCalled();expect.soft(mocks.revoke).not.toHaveBeenCalled();
 }else {expect.soft(mocks.create).toHaveBeenCalledOnce();expect.soft(mocks.revoke).toHaveBeenCalledExactlyOnceWith('blob:source-authority-qa');}
 noDocument();expect(mocks.fetch).toHaveBeenCalledOnce();
}
const storageEvent=(key:string,oldValue:string|null,newValue:string|null)=>window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:window.localStorage}));

beforeEach(()=>{
 mocks.fetch.mockReset();mocks.create.mockReset().mockReturnValue('blob:source-authority-qa');mocks.revoke.mockReset();
 vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('URL',class extends URL{static createObjectURL=mocks.create;static revokeObjectURL=mocks.revoke;});
 vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('External requests forbidden');}));
 safeLocalStorage.clear();usePanelSessionStore.getState().setAuthToken('synthetic-source-token-A');usePanelSessionStore.getState().setUser(actor());
});
afterEach(()=>{
 cleanup();expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();usePanelSessionStore.setState({authToken:null,user:null});safeLocalStorage.clear();
 vi.unstubAllGlobals();vi.restoreAllMocks();
});

describe('source retirement for same-actor authority changes',()=>{
 for(const phase of ['pending','ready'] as const)it.each<Field>(['rol','permissions','capabilities','scopes'])
  (`retires ${phase} source when same-actor %s changes without owner rerender`,async field=>{await retires(phase,()=>change(field));});
 it.each<Phase>(['pending','ready'])('also retires %s source on role alias change',async phase=>{await retires(phase,()=>change('role'));});
 it.each<Phase>(['pending','ready'])('retires %s source through batched authority A-B-A',async phase=>{
  await retires(phase,()=>{const original=usePanelSessionStore.getState().user!;change('permissions');usePanelSessionStore.getState().setUser(original);});
 });
 it.each<Phase>(['pending','ready'])('retires %s source through batched token A-B-A',async phase=>{
  await retires(phase,()=>{usePanelSessionStore.getState().setAuthToken('synthetic-source-token-B');usePanelSessionStore.getState().setAuthToken('synthetic-source-token-A');});
 });
 it.each<Phase>(['pending','ready'])('retires %s source after an authority storage event without store refresh',async phase=>{
  await retires(phase,()=>{const old=safeLocalStorage.getItem('user'),next=JSON.stringify({...actor(),permissions:[]});safeLocalStorage.setItem('user',next);storageEvent('user',old,next);});
 });
 it.each<Phase>(['pending','ready'])('retires %s source through storage authority A-B-A',async phase=>{
  await retires(phase,()=>{const old=safeLocalStorage.getItem('user'),next=JSON.stringify({...actor(),scopes:[]});safeLocalStorage.setItem('user',next);storageEvent('user',old,next);
   safeLocalStorage.setItem('user',old!);storageEvent('user',next,old);});
 });
 it.each<Phase>(['pending','ready'])('retires %s source for queued storage ABA events after storage already holds A',async phase=>{
  await retires(phase,()=>{const old=safeLocalStorage.getItem('user'),next=JSON.stringify({...actor(),capabilities:[]});
   // Another tab can have restored A before this tab receives either event.
   safeLocalStorage.setItem('user',next);safeLocalStorage.setItem('user',old!);storageEvent('user',old,next);storageEvent('user',next,old);});
 });
 it('retires a standalone reader during same-actor ABA while its body is pending',async()=>{
  const {value,source}=await model();let release!:()=>void;
  const stream=new ReadableStream<Uint8Array>({start(controller){release=()=>{controller.enqueue(bytes);controller.close();};}});
  mocks.fetch.mockResolvedValueOnce(new Response(stream,{headers:{'Content-Type':'text/plain','Content-Length':String(bytes.length)}}));
  const read=readKnowledgeSource(value,source,'admin',{isCurrent:()=>true});const settled=read.then(()=>({retired:false}),()=>({retired:true}));
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());const original=usePanelSessionStore.getState().user!;
  act(()=>{change('capabilities');usePanelSessionStore.getState().setUser(original);release();});
  expect(await settled).toEqual({retired:true});expect(mocks.create).not.toHaveBeenCalled();
 });
 it.each<Phase>(['pending','ready'])('clears %s source on close and ignores authority changes after cleanup',async phase=>{
  const pending=await start(phase);fireEvent.click(screen.getByRole('button',{name:'Cerrar fuentes'}));
  if(phase==='pending')expect(pending.options.signal.aborted).toBe(true);expect(pending.options.isCurrent()).toBe(false);pending.changed.mockClear();
  act(()=>change('permissions'));expect(pending.changed).not.toHaveBeenCalled();
  if(phase==='pending')await act(async()=>{pending.old.resolve(response());});noDocument();
  expect(mocks.create).toHaveBeenCalledTimes(phase==='ready'?1:0);expect(mocks.revoke).toHaveBeenCalledTimes(phase==='ready'?1:0);
 });
 it.each<Phase>(['pending','ready'])('cleans %s source on unmount and never restores a late Blob',async phase=>{
  const pending=await start(phase);pending.mounted.unmount();pending.changed.mockClear();
  if(phase==='pending')expect(pending.options.signal.aborted).toBe(true);expect(pending.options.isCurrent()).toBe(false);
  act(()=>change('permissions'));expect(pending.changed).not.toHaveBeenCalled();
  if(phase==='pending')await act(async()=>{pending.old.resolve(response());});noDocument();
  expect(mocks.create).toHaveBeenCalledTimes(phase==='ready'?1:0);expect(mocks.revoke).toHaveBeenCalledTimes(phase==='ready'?1:0);
 });
 it.each<Phase>(['pending','ready'])('preserves %s source for presentation and equal authority values',async phase=>{
  const pending=await start(phase);act(()=>{const previous=usePanelSessionStore.getState().user!;usePanelSessionStore.getState().setUser({...previous,name:'Nombre nuevo',
   permissions:[...previous.permissions],capabilities:[...previous.capabilities],scopes:[...previous.scopes]});usePanelSessionStore.getState().setAuthToken('synthetic-source-token-A');});
  expect(pending.options.isCurrent()).toBe(true);expect(pending.changed).not.toHaveBeenCalled();expect(pending.options.signal.aborted).toBe(false);
  if(phase==='pending')await act(async()=>{pending.old.resolve(response());});await waitFor(()=>expect(download()).toBeInTheDocument());
  expect(screen.getByText(body)).toBeInTheDocument();expect(mocks.revoke).not.toHaveBeenCalled();expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it.each<Phase>(['pending','ready'])('preserves %s source for reordered equivalent string authority arrays',async phase=>{
  const pending=await start(phase);act(()=>{const previous=usePanelSessionStore.getState().user!;usePanelSessionStore.getState().setUser({...previous,
   permissions:[...previous.permissions].reverse(),capabilities:[...previous.capabilities].reverse(),scopes:[...previous.scopes].reverse()});});
  expect(pending.options.isCurrent()).toBe(true);expect(pending.changed).not.toHaveBeenCalled();
  if(phase==='pending')await act(async()=>{pending.old.resolve(response());});await waitFor(()=>expect(download()).toBeInTheDocument());expect(mocks.revoke).not.toHaveBeenCalled();
 });
 it.each<Phase>(['pending','ready'])('preserves %s source for unrelated sessionStorage authority-looking events',async phase=>{
  const pending=await start(phase);act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'user',oldValue:JSON.stringify(actor()),
   newValue:JSON.stringify({...actor(),permissions:[]}),storageArea:window.sessionStorage})));
  expect(pending.options.isCurrent()).toBe(true);expect(pending.changed).not.toHaveBeenCalled();expect(pending.options.signal.aborted).toBe(false);
  if(phase==='pending')await act(async()=>{pending.old.resolve(response());});await waitFor(()=>expect(download()).toBeInTheDocument());expect(mocks.revoke).not.toHaveBeenCalled();
 });
 it.each<Phase>(['pending','ready'])('keeps explicit public %s reading independent of private panel authority',async phase=>{
  const pending=await start(phase,'public');act(()=>{change('permissions');usePanelSessionStore.getState().setAuthToken('synthetic-source-token-B');});
  expect(pending.options.isCurrent()).toBe(true);expect(pending.changed).not.toHaveBeenCalled();expect(pending.options.signal.aborted).toBe(false);
  if(phase==='pending')await act(async()=>{pending.old.resolve(response());});await waitFor(()=>expect(download()).toBeInTheDocument());expect(mocks.revoke).not.toHaveBeenCalled();
  expect(mocks.fetch.mock.calls[0][1]).toMatchObject({skipAuth:true,omitCredentials:true,isWidgetRequest:false});
 });
 it('does not authorize a reserved source merely because the reader is public',async()=>{
  const {value}=await model('admin');value.visibility='public';value.can_edit=false;
  render(<KnowledgeSourceDialog workspace={value} open mode="public" onOpenChange={()=>{}} restoreFocus={()=>{}}/>);
  expect(screen.queryByRole('button',{name:/Leer documento/})).not.toBeInTheDocument();expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
 });
});
