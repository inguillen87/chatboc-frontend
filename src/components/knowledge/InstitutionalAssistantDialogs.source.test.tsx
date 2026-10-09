import React from 'react';
import {webcrypto} from 'node:crypto';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import {usePanelSessionStore} from '@/stores';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import type {KnowledgeSource,KnowledgeSourceFormat} from './institutionalAssistantContract';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),create:vi.fn(),revoke:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {KnowledgeSourceDialog} from './InstitutionalAssistantDialogs';

const data={pdf:new TextEncoder().encode('%PDF-1.7\nSynthetic local document'),jpeg:new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,0xff,0xd9]),text:new TextEncoder().encode('<script>LOCAL_SENTINEL</script>\nTexto extraído')};
const mime={pdf:'application/pdf',jpeg:'image/jpeg',text:'text/plain'};
const actor={id:'synthetic-actor-a',email:'a@example.test',rol:'admin',tenant_slug:'qa-knowledge'};
async function fixture(format:KnowledgeSourceFormat='pdf'){
 const bytes=data[format],sha256=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const source:KnowledgeSource={id:'synthetic-source',title:'Documento de prueba local',sha256,page_count:1,url:null,format,mime_type:mime[format],byte_size:bytes.length,pagination:format==='pdf'?'native':'logical_snapshot',delivery:{contract_version:'chatboc.knowledge_source_delivery.v1',format,mime_type:mime[format],sha256,byte_size:bytes.length,filename:'documento.'+(format==='jpeg'?'jpg':format==='text'?'txt':'pdf')}};
 const model=workspace();model.knowledge!.sources=[source];model.knowledge!.initial.sources=[source];
 return {model,source,bytes};
}
async function openDocument(format:KnowledgeSourceFormat='pdf'){
 const {model,source,bytes}=await fixture(format);
 mocks.fetch.mockResolvedValue(new Response(bytes,{headers:{'Content-Type':mime[format],'Content-Length':String(bytes.length)}}));
 const changed=vi.fn(),restore=vi.fn();
 const mounted=render(<KnowledgeSourceDialog workspace={model} open onOpenChange={changed} restoreFocus={restore}/>);
 fireEvent.click(screen.getByRole('button',{name:/^Leer documento\s*:\s*Documento de prueba local$/}));
 const download=await screen.findByRole('link',{name:/Descargar/});
 return {model,source,mounted,changed,restore,download};
}
beforeEach(()=>{
 mocks.fetch.mockReset();mocks.create.mockReset().mockReturnValue('blob:synthetic-private-document');mocks.revoke.mockReset();
 vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('URL',class extends URL {static createObjectURL=mocks.create;static revokeObjectURL=mocks.revoke;});
 safeLocalStorage.clear();usePanelSessionStore.setState({authToken:'synthetic-token-a',user:actor});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();safeLocalStorage.clear();usePanelSessionStore.setState({authToken:null,user:null});});

describe('mounted verified document reading',()=>{
 it('shows source evidence without opening or leaking a reserved public original',async()=>{
  const {model,source}=await fixture();model.visibility='public';model.can_edit=false;
  source.document_visibility='private';source.delivery!.document_visibility='private';source.delivery!.publicly_accessible=false;
  source.url='https://example.test/reserved-original';source.origin_url='https://example.test/reserved-origin';
  render(<KnowledgeSourceDialog workspace={model} open mode="public" onOpenChange={()=>{}} restoreFocus={()=>{}}/>);
  expect(screen.getByText(source.title)).toBeVisible();expect(screen.getByText(/El documento original está reservado/)).toBeVisible();
  expect(screen.queryByRole('button',{name:/Leer documento/})).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();expect(document.body.textContent).not.toContain('reserved-');
  expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
 });
 it('opens the same reserved original only through the authenticated admin reader',async()=>{
  const {model,source,bytes}=await fixture();source.document_visibility='private';source.delivery!.document_visibility='private';source.delivery!.publicly_accessible=false;
  mocks.fetch.mockResolvedValue(new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Length':String(bytes.length)}}));
  render(<KnowledgeSourceDialog workspace={model} open mode="admin" onOpenChange={()=>{}} restoreFocus={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:/Leer documento/}));expect(await screen.findByRole('link',{name:/Descargar/})).toHaveAttribute('href','blob:synthetic-private-document');
  expect(mocks.fetch.mock.calls[0][1]).toMatchObject({omitEntityToken:true,isWidgetRequest:false,tenantSlug:'qa-knowledge'});
  expect(mocks.fetch.mock.calls[0][1].skipAuth).not.toBe(true);
 });
 it.each(['pdf','jpeg','text'] as const)('displays a verified %s using a private Blob and renders text literally',async format=>{
  const {source,download}=await openDocument(format);
  expect(download).toHaveAttribute('href','blob:synthetic-private-document');expect(download).toHaveAttribute('download',source.delivery!.filename);
  if(format==='pdf'){
   expect(screen.getByRole('status')).toHaveTextContent('Documento PDF verificado.');
   expect(screen.getByRole('status')).toHaveTextContent('Podés descargarlo para leer el original en tu dispositivo.');
   expect(document.querySelector('iframe,embed,object')).toBeNull();expect(download).not.toHaveAttribute('target');
  }
  if(format==='jpeg')expect(screen.getByRole('img',{name:source.title})).toHaveAttribute('src','blob:synthetic-private-document');
  if(format==='text'){expect(screen.getByText(/<script>LOCAL_SENTINEL<\/script>/)).toBeVisible();expect(document.querySelector('script')).toBeNull();}
  expect(mocks.create).toHaveBeenCalledOnce();expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('never offers a verified card or download when the original fails integrity checking',async()=>{
  const {model,bytes}=await fixture();const altered=bytes.slice();altered[altered.length-1]^=1;
  mocks.fetch.mockResolvedValue(new Response(altered,{headers:{'Content-Type':'application/pdf','Content-Length':String(altered.length)}}));
  render(<KnowledgeSourceDialog workspace={model} open onOpenChange={()=>{}} restoreFocus={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:/Leer documento/}));
  await screen.findByRole('alert');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.queryByRole('link',{name:/Descargar/})).not.toBeInTheDocument();
  expect(document.querySelector('iframe,embed,object')).toBeNull();expect(mocks.create).not.toHaveBeenCalled();
 });
 it.each(['actor','token','generation','session-tenant'] as const)('revokes an already displayed document on %s change without an owner rerender',async cause=>{
  const {changed}=await openDocument(cause==='actor'?'text':'pdf');
  act(()=>{
   if(cause==='actor')usePanelSessionStore.setState({user:{...actor,id:'synthetic-actor-b'}});
   else if(cause==='token')usePanelSessionStore.setState({authToken:'synthetic-token-b'});
   else if(cause==='session-tenant')usePanelSessionStore.setState({user:{...actor,tenant_slug:'another-tenant'}});
   else advanceChatbocSessionRevision();
  });
  expect(mocks.revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic-private-document');
  expect(screen.queryByRole('link',{name:/Descargar/})).not.toBeInTheDocument();expect(screen.queryByTitle('Documento de prueba local')).not.toBeInTheDocument();
  expect(screen.queryByText('Documento PDF verificado.')).not.toBeInTheDocument();
  expect(screen.queryByText(/LOCAL_SENTINEL/)).not.toBeInTheDocument();expect(changed).toHaveBeenCalledWith(false);expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it.each(['tenant','revision'] as const)('revokes an already displayed image before a new %s scope is shown',async cause=>{
  const {model,mounted,changed,restore}=await openDocument('jpeg');
  const next={...model,...(cause==='tenant'?{tenant:{id:702,slug:'another-tenant',name:'Otra organización'}}:{revision:'c'.repeat(64)})};
  mounted.rerender(<KnowledgeSourceDialog workspace={next} open onOpenChange={changed} restoreFocus={restore}/>);
  expect(mocks.revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic-private-document');expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:/Descargar/})).not.toBeInTheDocument();expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('aborts a pending body on a session change and never creates a late private URL',async()=>{
  const {model,source,bytes}=await fixture();let release!:()=>void;
  const stream=new ReadableStream<Uint8Array>({start(controller){release=()=>{controller.enqueue(bytes);controller.close();};}});
  mocks.fetch.mockResolvedValue(new Response(stream,{headers:{'Content-Type':'application/pdf','Content-Length':String(bytes.length)}}));
  const changed=vi.fn();render(<KnowledgeSourceDialog workspace={model} open onOpenChange={changed} restoreFocus={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:/^Leer documento\s*:\s*Documento de prueba local$/}));await screen.findByRole('status');
  await act(async()=>{advanceChatbocSessionRevision();release();await Promise.resolve();});
  expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);expect(mocks.create).not.toHaveBeenCalled();
  expect(screen.queryByRole('link',{name:/Descargar/})).not.toBeInTheDocument();expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 });
 it('revokes on close and removes authority listeners on unmount',async()=>{
  const {model,mounted,changed,restore}=await openDocument();
  mounted.rerender(<KnowledgeSourceDialog workspace={model} open={false} onOpenChange={changed} restoreFocus={restore}/>);
  expect(mocks.revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic-private-document');mounted.unmount();changed.mockClear();
  act(()=>{advanceChatbocSessionRevision();usePanelSessionStore.setState({authToken:'synthetic-token-b'});});
  expect(changed).not.toHaveBeenCalled();expect(mocks.revoke).toHaveBeenCalledOnce();
 });
});
