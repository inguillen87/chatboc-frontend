import React,{useLayoutEffect,useRef,useState} from 'react';
import {BookOpen,FileText,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {publicKnowledgeUrl,type KnowledgeWorkspace} from './institutionalAssistantContract';
import {KnowledgeSourceMetadata} from './InstitutionalAssistantSourceMetadata';
import {readKnowledgeSource,knowledgeSourceReadMessage,captureKnowledgeSourceAuthority,type KnowledgeSourceDocument} from './institutionalAssistantSource';
import {subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {usePanelSessionStore} from '@/stores';
export interface KnowledgeReview {operation:'import'|'publish'|'retire';bundle?:unknown;filename?:string}
interface BaseProps {workspace:KnowledgeWorkspace;restoreFocus:()=>void}
export function KnowledgeSourceDialog({workspace,open,onOpenChange,restoreFocus,mode='admin',highlightedSourceId}:{open:boolean;onOpenChange:(open:boolean)=>void;mode?:'admin'|'public';highlightedSourceId?:string|null}&BaseProps){
 const title=useRef<HTMLHeadingElement>(null),ui=workspace.ui;
 const mounted=useRef(false),visible=useRef(open),sequence=useRef(0),controller=useRef<AbortController|null>(null),url=useRef<string|null>(null),locked=useRef(false);
 const [pending,setPending]=useState<string|null>(null),[failure,setFailure]=useState<{id:string;message:string}|null>(null);
 const [document,setDocument]=useState<(KnowledgeSourceDocument&{id:string;url:string})|null>(null);
 visible.current=open;
 const retire=()=>{sequence.current++;locked.current=false;controller.current?.abort();controller.current=null;if(url.current)URL.revokeObjectURL(url.current);url.current=null;};
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;retire();};},[]);
 useLayoutEffect(()=>{retire();setDocument(null);setPending(null);setFailure(null);},[open,workspace.tenant.id,workspace.tenant.slug,workspace.revision,mode]);
 useLayoutEffect(()=>{
  const retireAuthority=()=>{
   retire();setDocument(null);setPending(null);setFailure(null);
   if(visible.current){visible.current=false;onOpenChange(false);}
  };
  // Already displayed bytes need the same fence as in-flight reads, even when
  // the owner of this controlled dialog does not rerender for a session change.
  let authority=captureKnowledgeSourceAuthority();
  const unsubscribePanel=usePanelSessionStore.subscribe(()=>{
   const next=captureKnowledgeSourceAuthority();
   if(mode==='admin'&&next!==authority)retireAuthority();
   authority=next;
  });
  const unsubscribeRevision=subscribeChatbocSessionRevision(retireAuthority);
  const storageChanged=(event:StorageEvent)=>{
   if(event.storageArea!==window.localStorage)return;
   const next=captureKnowledgeSourceAuthority();
   if(mode==='admin'&&next!==authority)retireAuthority();
   authority=next;
  };
  window.addEventListener('storage',storageChanged);
  return()=>{unsubscribePanel();unsubscribeRevision();window.removeEventListener('storage',storageChanged);};
 },[mode,onOpenChange]);
 const consult=async(id:string)=>{
  const source=workspace.knowledge?.sources.find(item=>item.id===id);if(!source||!visible.current||locked.current)return;
  retire();locked.current=true;const seq=sequence.current;const request=new AbortController();controller.current=request;
  const isCurrent=()=>mounted.current&&visible.current&&sequence.current===seq;
  setDocument(null);setFailure(null);setPending(id);
  try{const result=await readKnowledgeSource(workspace,source,mode,{isCurrent,signal:request.signal});
   if(!isCurrent())return;const blobUrl=URL.createObjectURL(result.blob);url.current=blobUrl;setDocument({...result,id,url:blobUrl});}
  catch(cause){if(isCurrent())setFailure({id,message:knowledgeSourceReadMessage(cause)});}
  finally{if(isCurrent()){locked.current=false;setPending(null);}}
 };
 return <Dialog open={open} onOpenChange={value=>{if(!value)retire();onOpenChange(value);}}>
  <DialogContent showCloseButton={false} className="institutional-assistant-dialog institutional-assistant-dialog--sources"
   aria-describedby={undefined}
   onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus();}}
   onCloseAutoFocus={event=>{event.preventDefault();restoreFocus();}}>
   <header className="institutional-assistant-dialog__header">
    <div><p>{workspace.tenant.name}</p><DialogTitle ref={title} tabIndex={-1}>{ui.sources}</DialogTitle></div>
    <DialogClose asChild><button type="button" aria-label={ui.close}><X size={20}/></button></DialogClose>
   </header>
   <div className="institutional-assistant-dialog__documents" role="region" aria-label={ui.sources} tabIndex={0}>
    {workspace.knowledge?.sources.map(source=><article key={source.id} className={source.id===highlightedSourceId?'rounded-lg ring-1 ring-border':''}>
     <FileText size={21} aria-hidden="true"/>
     <div><h3>{source.title}</h3>
      <KnowledgeSourceMetadata source={source}/>
      {publicKnowledgeUrl(source.url)?<a href={publicKnowledgeUrl(source.url)!} target="_blank" rel="noopener noreferrer">Referencia externa: {source.title}</a>:null}
      {source.delivery?<button type="button" className="mt-3 w-full sm:w-auto" disabled={pending!==null} onClick={()=>void consult(source.id)}>
       {pending===source.id?'Consultando documento…':'Leer documento'}<span className="sr-only">: {source.title}</span>
      </button>:null}
      {pending===source.id?<p role="status" className="mt-2 text-sm">Estamos verificando el documento.</p>:null}
      {failure?.id===source.id?<p role="alert" className="mt-3 text-sm leading-relaxed">{failure.message}</p>:null}
      {document?.id===source.id?<section className="mt-4 min-w-0 space-y-3 rounded-lg border p-3" aria-label={`Lectura: ${source.title}`}>
       <a href={document.url} download={document.filename} className="inline-flex">Descargar {document.format==='text'?'texto extraído':'documento'}<span className="sr-only">: {source.title}</span></a>
       {document.format==='text'?<pre className="max-h-[50dvh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed" tabIndex={0}>{document.text}</pre>
        :document.format==='jpeg'?<img src={document.url} alt={source.title} className="h-auto w-full"/>
        :<><iframe src={document.url} title={source.title} sandbox="allow-same-origin" className="h-[50dvh] min-h-64 w-full rounded border"/><p className="text-sm text-muted-foreground">Si tu navegador no muestra el archivo, podés descargarlo para leerlo.</p></>}
      </section>:null}
     </div>
    </article>)}
   </div>
   <footer className="institutional-assistant-dialog__footer">
    <span><BookOpen size={16} aria-hidden="true"/>{ui.evidence}</span>
   </footer>
  </DialogContent>
 </Dialog>;
}
export function KnowledgeReviewDialog({workspace,pending,onCancel,onConfirm,restoreFocus}:{pending:KnowledgeReview|null;onCancel:()=>void;onConfirm:()=>void}&BaseProps){
 const cancel=useRef<HTMLButtonElement>(null),ui=workspace.ui;
 const heading=pending?.operation==='import'?ui.import:pending?.operation==='publish'?ui.publish:ui.retire;
 const description=pending?.operation==='import'?ui.import_help:pending?.operation==='publish'?ui.confirm_publish:ui.confirm_retire;
 return <Dialog open={pending!==null} onOpenChange={open=>{if(!open)onCancel();}}>
  <DialogContent showCloseButton={false} className="institutional-assistant-dialog institutional-assistant-dialog--review"
   onOpenAutoFocus={event=>{event.preventDefault();cancel.current?.focus();}}
   onCloseAutoFocus={event=>{event.preventDefault();restoreFocus();}}>
   <header className="institutional-assistant-dialog__header"><div>
    <p>{workspace.tenant.name}</p><DialogTitle>{heading}</DialogTitle>
   </div></header>
   <div className="institutional-assistant-dialog__review">
    <DialogDescription>{description}</DialogDescription>
    {pending?.filename?<p className="institutional-assistant-dialog__filename">{pending.filename}</p>:null}
    {workspace.knowledge?<p className="institutional-assistant-dialog__version">{ui.version} {workspace.knowledge.version}</p>:null}
   </div>
   <footer className="institutional-assistant-dialog__footer">
    <button ref={cancel} type="button" onClick={onCancel}>{ui.cancel}</button>
    <button type="button" className="institutional-assistant__primary" onClick={onConfirm}>{ui.confirm}</button>
   </footer>
  </DialogContent>
 </Dialog>;
}
