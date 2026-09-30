import React,{useRef} from 'react';
import {BookOpen,FileText,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {publicKnowledgeUrl,type KnowledgeWorkspace} from './institutionalAssistantContract';
export interface KnowledgeReview {operation:'import'|'publish'|'retire';bundle?:unknown;filename?:string}
interface BaseProps {workspace:KnowledgeWorkspace;restoreFocus:()=>void}
export function KnowledgeSourceDialog({workspace,open,onOpenChange,restoreFocus}:{open:boolean;onOpenChange:(open:boolean)=>void}&BaseProps){
 const title=useRef<HTMLHeadingElement>(null),ui=workspace.ui;
 return <Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent showCloseButton={false} className="institutional-assistant-dialog institutional-assistant-dialog--sources"
   aria-describedby={undefined}
   onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus();}}
   onCloseAutoFocus={event=>{event.preventDefault();restoreFocus();}}>
   <header className="institutional-assistant-dialog__header">
    <div><p>{workspace.tenant.name}</p><DialogTitle ref={title} tabIndex={-1}>{ui.sources}</DialogTitle></div>
    <DialogClose asChild><button type="button" aria-label={ui.close}><X size={20}/></button></DialogClose>
   </header>
   <div className="institutional-assistant-dialog__documents" role="region" aria-label={ui.sources} tabIndex={0}>
    {workspace.knowledge?.sources.map(source=><article key={source.id}>
     <FileText size={21} aria-hidden="true"/>
     <div><h3>{source.title}</h3>
      {publicKnowledgeUrl(source.url)?<a href={publicKnowledgeUrl(source.url)!} target="_blank" rel="noopener noreferrer">{source.title}</a>:null}
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
