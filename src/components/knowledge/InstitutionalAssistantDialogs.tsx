import React,{useLayoutEffect,useRef,useState} from 'react';
import {BookOpen,FileText,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {knowledgeSourceExternalUrl,knowledgeSourceOriginalAllowed,type KnowledgeWorkspace} from './institutionalAssistantContract';
import {KnowledgeSourceMetadata} from './InstitutionalAssistantSourceMetadata';
import {readKnowledgeSource,knowledgeSourceReadMessage,subscribeKnowledgeSourceAuthority,type KnowledgeSourceDocument} from './institutionalAssistantSource';
import {subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
export interface KnowledgeReview {operation:'import'|'publish'|'retire';bundle?:unknown;filename?:string}
interface BaseProps {workspace:KnowledgeWorkspace;restoreFocus:()=>void;largeText?:boolean}
// Institutional dialogs can open above the standalone assistant and the
// platform accessibility dock. Their backdrop must cover both floating layers.
const INSTITUTIONAL_DIALOG_LAYER = 'z-[1000004]';
export function KnowledgeSourceDialog({workspace,open,onOpenChange,restoreFocus,mode='admin',highlightedSourceId,largeText=false}:{open:boolean;onOpenChange:(open:boolean)=>void;mode?:'admin'|'public';highlightedSourceId?:string|null}&BaseProps){
 const title=useRef<HTMLHeadingElement>(null),ui=workspace.ui;
 const mounted=useRef(false),visible=useRef(open),sequence=useRef(0),controller=useRef<AbortController|null>(null),url=useRef<string|null>(null),locked=useRef(false);
 const consultFocus=useRef<{sequence:number;trigger:HTMLButtonElement;dialog:HTMLElement|null;owned:boolean;cleanup:()=>void}|null>(null);
 const [pending,setPending]=useState<string|null>(null),[failure,setFailure]=useState<{id:string;message:string}|null>(null);
 const [document,setDocument]=useState<(KnowledgeSourceDocument&{id:string;url:string})|null>(null);
 visible.current=open;
 const retire=()=>{consultFocus.current?.cleanup();consultFocus.current=null;sequence.current++;locked.current=false;controller.current?.abort();controller.current=null;if(url.current)URL.revokeObjectURL(url.current);url.current=null;};
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;retire();};},[]);
 useLayoutEffect(()=>{retire();setDocument(null);setPending(null);setFailure(null);},[open,workspace.tenant.id,workspace.tenant.slug,workspace.revision,mode]);
 useLayoutEffect(()=>{
  if(pending!==null)return;
  const focus=consultFocus.current;if(!focus)return;consultFocus.current=null;focus.cleanup();
  if(!visible.current||!mounted.current||focus.sequence!==sequence.current||!focus.owned||!focus.trigger.isConnected||focus.trigger.disabled)return;
  const active=window.document.activeElement;
  // Native disabling can blur to BODY; Radix may transfer that focus to this
  // exact dialog container. Any deliberate move to another control revokes it.
  if(active===focus.trigger||active===window.document.body||active===focus.dialog)focus.trigger.focus({preventScroll:true});
 },[pending]);
 useLayoutEffect(()=>{
  const retireAuthority=()=>{
   retire();setDocument(null);setPending(null);setFailure(null);
   if(visible.current){visible.current=false;onOpenChange(false);}
  };
  // Already displayed bytes need the same fence as in-flight reads, even when
  // the owner of this controlled dialog does not rerender for a session change.
  const unsubscribeAuthority=mode==='admin'?subscribeKnowledgeSourceAuthority(retireAuthority):()=>{};
  const unsubscribeRevision=subscribeChatbocSessionRevision(retireAuthority);
  return()=>{unsubscribeAuthority();unsubscribeRevision();};
 },[mode,onOpenChange]);
 const consult=async(id:string,trigger:HTMLButtonElement)=>{
  const source=workspace.knowledge?.sources.find(item=>item.id===id);if(!source||!visible.current||locked.current)return;
  retire();locked.current=true;const seq=sequence.current;const request=new AbortController();controller.current=request;
  const focus={sequence:seq,trigger,dialog:trigger.closest<HTMLElement>('[role="dialog"]'),owned:window.document.activeElement===trigger,cleanup:()=>{}};
  const onFocusIn=(event:FocusEvent)=>{if(event.target!==trigger&&event.target!==window.document.body&&event.target!==focus.dialog)focus.owned=false;};
  const onFocusOut=(event:FocusEvent)=>{if(event.target===trigger&&trigger.isConnected&&!trigger.disabled)focus.owned=false;};
  focus.cleanup=()=>{window.document.removeEventListener('focusin',onFocusIn);window.document.removeEventListener('focusout',onFocusOut);};
  if(focus.owned){window.document.addEventListener('focusin',onFocusIn);window.document.addEventListener('focusout',onFocusOut);}
  consultFocus.current=focus;
  const isCurrent=()=>mounted.current&&visible.current&&sequence.current===seq;
  setDocument(null);setFailure(null);setPending(id);
  try{const result=await readKnowledgeSource(workspace,source,mode,{isCurrent,signal:request.signal});
   if(!isCurrent())return;const blobUrl=URL.createObjectURL(result.blob);url.current=blobUrl;setDocument({...result,id,url:blobUrl});}
  catch(cause){if(isCurrent())setFailure({id,message:knowledgeSourceReadMessage(cause)});}
  finally{if(isCurrent()){locked.current=false;setPending(null);}}
 };
 return <Dialog open={open} onOpenChange={value=>{if(!value)retire();onOpenChange(value);}}>
  <DialogContent showCloseButton={false} overlayClassName={INSTITUTIONAL_DIALOG_LAYER} className={`${INSTITUTIONAL_DIALOG_LAYER} institutional-assistant-dialog institutional-assistant-dialog--sources${largeText?' institutional-assistant-dialog--large':''}`}
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
      <KnowledgeSourceMetadata source={source} mode={mode}/>
      {knowledgeSourceExternalUrl(source,mode)?<a href={knowledgeSourceExternalUrl(source,mode)!} target="_blank" rel="noopener noreferrer">Referencia externa: {source.title}</a>:null}
      {source.delivery&&knowledgeSourceOriginalAllowed(source,mode)?<button type="button" className="mt-3 w-full sm:w-auto" disabled={pending!==null} onClick={event=>void consult(source.id,event.currentTarget)}>
       {pending===source.id?'Consultando documento…':'Leer documento'}<span className="sr-only">: {source.title}</span>
      </button>:null}
      {pending===source.id?<p role="status" className="mt-2 text-sm">Estamos verificando el documento.</p>:null}
      {failure?.id===source.id?<p role="alert" className="mt-3 text-sm leading-relaxed">{failure.message}</p>:null}
      {document?.id===source.id?<section className="mt-4 min-w-0 space-y-3 rounded-lg border p-3" aria-label={`Lectura: ${source.title}`}>
       {document.format==='pdf'?<div role="status" className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
        <p className="font-medium">Documento PDF verificado.</p>
        <p>Podés descargarlo para leer el original en tu dispositivo.</p>
       </div>:null}
       <a href={document.url} download={document.filename} className="inline-flex">Descargar {document.format==='text'?'texto extraído':'documento'}<span className="sr-only">: {source.title}</span></a>
       {document.format==='text'?<pre className="max-h-[50dvh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed" tabIndex={0}>{document.text}</pre>
        :document.format==='jpeg'?<img src={document.url} alt={source.title} className="h-auto w-full"/>
        :null}
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
// This is an informational preview of an untrusted JSON file, not a schema,
// permission or editorial approval check. The server still validates the import.
const previewRecord=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const previewText=(value:unknown,limit:number)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=limit?value.trim():null;
function knowledgeImportPreview(value:unknown){
 const bundle=previewRecord(value),tenant=previewRecord(bundle?.tenant),sources=previewRecord(bundle?.sources);
 const sourceCount=sources?Object.keys(sources).length:null;
 return {version:previewText(bundle?.version,60),tenant:previewText(tenant?.slug,80),
  sourceCount:sourceCount!==null&&sourceCount>=1&&sourceCount<=64?sourceCount:null,
  evaluationOnly:typeof bundle?.evaluation_only==='boolean'?bundle.evaluation_only:null,
  approvalStatus:previewText(bundle?.approval_status,120)};
}
const importReviewUiKeys=['import_review_current_version','import_review_proposed_version',
 'import_review_empty_current','import_review_destination','import_review_declared_tenant',
 'import_review_declared_sources','import_review_evaluation_only','import_review_approval_status',
 'import_review_not_reported','import_review_yes','import_review_no','import_review_notice'] as const;
type ImportReviewUi=Record<(typeof importReviewUiKeys)[number],string>;
function knowledgeImportReviewUi(ui:Record<string,string>):ImportReviewUi|null{
 return importReviewUiKeys.every(key=>Object.prototype.hasOwnProperty.call(ui,key)&&previewText(ui[key],1000)!==null)?ui as ImportReviewUi:null;
}
export function KnowledgeReviewDialog({workspace,pending,onCancel,onConfirm,restoreFocus,largeText=false}:{pending:KnowledgeReview|null;onCancel:()=>void;onConfirm:()=>void}&BaseProps){
 const cancel=useRef<HTMLButtonElement>(null),ui=workspace.ui;
 const heading=pending?.operation==='import'?ui.import:pending?.operation==='publish'?ui.publish:ui.retire;
 const description=pending?.operation==='import'?ui.import_help:pending?.operation==='publish'?ui.confirm_publish:ui.confirm_retire;
 const preview=pending?.operation==='import'?knowledgeImportPreview(pending.bundle):null;
 const reviewUi=preview?knowledgeImportReviewUi(ui):null;
 return <Dialog open={pending!==null} onOpenChange={open=>{if(!open)onCancel();}}>
  <DialogContent showCloseButton={false} overlayClassName={INSTITUTIONAL_DIALOG_LAYER} className={`${INSTITUTIONAL_DIALOG_LAYER} institutional-assistant-dialog institutional-assistant-dialog--review${largeText?' institutional-assistant-dialog--large':''}`}
   onOpenAutoFocus={event=>{event.preventDefault();cancel.current?.focus();}}
   onCloseAutoFocus={event=>{event.preventDefault();restoreFocus();}}>
   <header className="institutional-assistant-dialog__header"><div>
    <p>{workspace.tenant.name}</p><DialogTitle>{heading}</DialogTitle>
   </div></header>
   <div className="institutional-assistant-dialog__review" role="region" tabIndex={0} aria-label={heading}>
    <DialogDescription>{description}</DialogDescription>
    {pending?.filename?<p className="institutional-assistant-dialog__filename">{pending.filename}</p>:null}
    {preview&&reviewUi?<>
     <section role="group" aria-label={reviewUi.import_review_current_version} className="space-y-2 rounded-lg border p-3">
      <h3 className="font-medium">{reviewUi.import_review_current_version}</h3>
      <p className="institutional-assistant-dialog__version">{workspace.knowledge?.version??reviewUi.import_review_empty_current}</p>
      <dl className="text-sm"><div><dt>{reviewUi.import_review_destination}</dt><dd className="break-words">{workspace.tenant.slug}</dd></div></dl>
     </section>
     <section role="group" aria-label={reviewUi.import_review_proposed_version} className="space-y-2 rounded-lg border p-3">
      <h3 className="font-medium">{reviewUi.import_review_proposed_version}</h3>
      <p className="institutional-assistant-dialog__version break-words">{preview.version??reviewUi.import_review_not_reported}</p>
      <dl className="space-y-2 text-sm">
       <div><dt>{reviewUi.import_review_declared_tenant}</dt><dd className="break-words">{preview.tenant??reviewUi.import_review_not_reported}</dd></div>
       <div><dt>{reviewUi.import_review_declared_sources}</dt><dd>{preview.sourceCount??reviewUi.import_review_not_reported}</dd></div>
       <div><dt>{reviewUi.import_review_evaluation_only}</dt><dd>{preview.evaluationOnly===null?reviewUi.import_review_not_reported:preview.evaluationOnly?reviewUi.import_review_yes:reviewUi.import_review_no}</dd></div>
       <div><dt>{reviewUi.import_review_approval_status}</dt><dd className="break-words">{preview.approvalStatus??reviewUi.import_review_not_reported}</dd></div>
      </dl>
     </section>
     <p className="text-sm text-muted-foreground">{reviewUi.import_review_notice}</p>
    </>:pending?.operation==='import'?(preview?.version?<p className="institutional-assistant-dialog__version">{ui.version} {preview.version}</p>:null)
     :workspace.knowledge?<p className="institutional-assistant-dialog__version">{ui.version} {workspace.knowledge.version}</p>:null}
   </div>
   <footer className="institutional-assistant-dialog__footer">
    <button ref={cancel} type="button" onClick={onCancel}>{ui.cancel}</button>
    <button type="button" className="institutional-assistant__primary" onClick={onConfirm}>{ui.confirm}</button>
   </footer>
  </DialogContent>
 </Dialog>;
}
