import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {InstitutionalTextBlocks} from './InstitutionalTextBlocks';
import {readInstitutionalEasyRead,type InstitutionalEasyReadCopy,type InstitutionalEasyReadScope} from './institutionalAssistantEasyRead';
import './institutionalResponseAudio.css';

interface Props {
  scope:InstitutionalEasyReadScope;
  copy:InstitutionalEasyReadCopy;
  /** Already verified text (typed «explicámelo más simple» in the chat). */
  initialText?:string|null;
  /** Set (and changed) when the person asked for it by writing: open it. */
  autoOpenToken?:number|null;
}

/** A new answer, revision or organization starts from the original again. */
export function InstitutionalEasyRead(props:Props) {
  return <EasyRead key={JSON.stringify([props.scope.tenant.id,props.scope.tenant.slug,props.scope.revision,props.scope.nodeId,props.autoOpenToken??null])} {...props}/>;
}

function EasyRead({scope,copy,initialText,autoOpenToken}:Props) {
  const [text,setText]=useState<string|null>(initialText??null);
  const [state,setState]=useState<'idle'|'loading'|'error'>('idle');
  const [open,setOpen]=useState(Boolean(initialText));
  const request=useRef<AbortController|null>(null),active=useRef(true),focusText=useRef(false);
  const panel=useRef<HTMLDivElement>(null),control=useRef<HTMLButtonElement>(null),returnFocus=useRef(false);
  const panelId=useId();
  useEffect(()=>{active.current=true;return()=>{active.current=false;request.current?.abort();};},[]);
  useLayoutEffect(()=>{
    if(open&&text&&focusText.current){focusText.current=false;panel.current?.focus({preventScroll:false});}
    if(!open&&returnFocus.current){returnFocus.current=false;control.current?.focus({preventScroll:true});}
  },[open,text]);
  const load=async()=>{
    if(state==='loading')return;
    if(text){focusText.current=true;setOpen(true);return;}
    const controller=new AbortController();request.current?.abort();request.current=controller;setState('loading');
    try{
      const value=await readInstitutionalEasyRead(scope,{signal:controller.signal,isCurrent:()=>active.current&&request.current===controller});
      if(!active.current||request.current!==controller)return;
      focusText.current=true;setText(value);setOpen(true);setState('idle');
    }catch{
      if(active.current&&request.current===controller&&!controller.signal.aborted)setState('error');
    }
  };
  useEffect(()=>{if(autoOpenToken&&!initialText)void load();},[]);// eslint-disable-line react-hooks/exhaustive-deps
  return <section className="institutional-easy-read" aria-label={copy.action} data-state={open?'open':state}>
    <button ref={control} type="button" aria-expanded={open} aria-controls={open?panelId:undefined} aria-disabled={state==='loading'}
      onClick={()=>{if(open){returnFocus.current=true;setOpen(false);}else void load();}}>
      {open?copy.original:state==='loading'?copy.loading:copy.action}
    </button>
    {state==='loading'?<p role="status" className="sr-only">{copy.loading}</p>:null}
    {state==='error'?<p role="alert">{copy.error}</p>:null}
    {open&&text?<div ref={panel} id={panelId} tabIndex={-1} className="institutional-easy-read__text" lang="es">
      <InstitutionalTextBlocks text={text}/>
      <p className="institutional-easy-read__disclosure">{copy.disclosure}</p>
    </div>:null}
  </section>;
}
