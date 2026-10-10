import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {readInstitutionalAudio,type InstitutionalAudioReading,type InstitutionalAudioScope} from './institutionalAssistantAudio';
import './institutionalResponseAudio.css';

interface Props {scope:InstitutionalAudioScope;copy:InstitutionalAudioReading}
let currentReading:{token:symbol;stop:()=>void}|null=null;
export function stopInstitutionalReading(){currentReading?.stop();}
/** Retiring a tenant, revision or answer also retires its audio and download. */
export function InstitutionalResponseAudio(props:Props) {
  return <ResponseAudio key={JSON.stringify([props.scope.tenant.id,props.scope.tenant.slug,props.scope.revision,props.scope.nodeIds])} {...props}/>;
}
function ResponseAudio({scope,copy}:Props) {
  const player=useRef<HTMLAudioElement>(null),url=useRef<string|null>(null),request=useRef<AbortController|null>(null),active=useRef(true),serial=useRef(0);
  const token=useRef(Symbol('institutional-reading')),stopCurrent=useRef<()=>void>(()=>{});
  const primary=useRef<HTMLButtonElement>(null),restoreFocus=useRef(false);
  const [state,setState]=useState<'idle'|'loading'|'ready'|'playing'|'paused'|'error'>('idle');
  useLayoutEffect(()=>{if(restoreFocus.current&&state==='idle'){restoreFocus.current=false;primary.current?.focus({preventScroll:true});}},[state]);
  const release=(audio=player.current)=>{
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
    if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
  };
  useEffect(()=>{active.current=true;const audio=player.current;return()=>{active.current=false;serial.current++;request.current?.abort();release(audio);if(currentReading?.token===token.current)currentReading=null;};},[]);
  const play=async(seq:number)=>{
    const audio=player.current;if(!audio||!active.current)return;
    try{await audio.play();if(active.current&&serial.current===seq)setState('playing');}
    catch{if(active.current&&serial.current===seq)setState('error');}
  };
  const listen=async()=>{
    const audio=player.current;if(!audio||state==='loading')return;
    if(state==='playing'){audio.pause();setState('paused');return;}
    if(currentReading?.token!==token.current)currentReading?.stop();
    currentReading={token:token.current,stop:()=>stopCurrent.current()};
    const seq=++serial.current;
    if(url.current){await play(seq);return;}
    const controller=new AbortController();request.current=controller;setState('loading');
    try{
      const blob=await readInstitutionalAudio(scope,{signal:controller.signal,isCurrent:()=>active.current&&request.current===controller});
      if(!active.current||controller.signal.aborted||request.current!==controller)return;
      url.current=URL.createObjectURL(blob);audio.src=url.current;setState('ready');
      // This follows an explicit Listen action. Rendering/new replies never play.
      await play(seq);
    }catch{if(active.current&&!controller.signal.aborted&&request.current===controller)setState('error');}
  };
  const stop=(returnFocus=false)=>{restoreFocus.current=returnFocus;serial.current++;request.current?.abort();request.current=null;release();if(currentReading?.token===token.current)currentReading=null;setState('idle');};
  stopCurrent.current=stop;
  return <section className="institutional-response-audio" aria-label={copy.listen}>
    <p className="institutional-response-audio__disclosure">{copy.disclosure}</p>
    <div className="institutional-response-audio__controls">
      <button ref={primary} type="button" disabled={state==='loading'} onClick={()=>void listen()}>
        {state==='loading'?copy.loading:state==='playing'?copy.pause:state==='paused'?copy.resume:copy.listen}
      </button>
      {(state==='loading'||url.current)?<button type="button" onClick={()=>stop(true)}>{copy.stop}</button>:null}
    </div>
    <audio ref={player} preload="none" onEnded={()=>{if(active.current)setState('ready');}} onError={()=>{if(active.current){release();setState('error');}}} />
    {state==='loading'?<p role="status">{copy.loading}</p>:null}
    {state==='error'?<p role="alert">{copy.error}</p>:null}
  </section>;
}
