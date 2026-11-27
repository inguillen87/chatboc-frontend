import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {readInstitutionalAudio,type InstitutionalAudioReading,type InstitutionalAudioScope} from './institutionalAssistantAudio';
import './institutionalResponseAudio.css';

interface Props {scope:InstitutionalAudioScope;copy:InstitutionalAudioReading;
  /** Published text of the same answer, read with the device voice when the recorded reading is unavailable. */
  fallbackText?:string}
const DEVICE_VOICE_NOTE='Se lee con la voz de este dispositivo.';
const MAX_DEVICE_CHARS=6000;
const READING_RATES=[0.75,1,1.25,1.5] as const;
const RATE_KEY='chatboc.institutional-reading-rate';
const storedRate=():number=>{
  try{const value=Number(window.localStorage.getItem(RATE_KEY));return (READING_RATES as readonly number[]).includes(value)?value:1;}
  catch{return 1;}
};
const rateLabel=(rate:number)=>`${rate.toLocaleString('es-AR')}×`;
let currentReading:{token:symbol;stop:()=>void}|null=null;
export function stopInstitutionalReading(){currentReading?.stop();}
/** Retiring a tenant, revision or answer also retires its audio and download. */
export function InstitutionalResponseAudio(props:Props) {
  return <ResponseAudio key={JSON.stringify([props.scope.tenant.id,props.scope.tenant.slug,props.scope.revision,props.scope.nodeIds])} {...props}/>;
}
function ResponseAudio({scope,copy,fallbackText}:Props) {
  const player=useRef<HTMLAudioElement>(null),url=useRef<string|null>(null),request=useRef<AbortController|null>(null),active=useRef(true),serial=useRef(0);
  const preparing=useRef(false),device=useRef(false);
  const [deviceVoice,setDeviceVoice]=useState(false);
  const token=useRef(Symbol('institutional-reading')),stopCurrent=useRef<()=>void>(()=>{});
  const primary=useRef<HTMLButtonElement>(null),stopControl=useRef<HTMLButtonElement>(null),restoreFocus=useRef(false),errorFocus=useRef<HTMLButtonElement|null>(null);
  const [state,setState]=useState<'idle'|'loading'|'ready'|'playing'|'paused'|'error'>('idle');
  // Reading speed is offered only when the backend names the control. It is a
  // per-viewer convenience: the choice survives reloads in this browser.
  const speedLabel=typeof copy.speed==='string'&&copy.speed.trim()?copy.speed:null;
  const [rate,setRate]=useState<number>(()=>speedLabel?storedRate():1);
  useEffect(()=>{const audio=player.current;if(audio){audio.defaultPlaybackRate=rate;audio.playbackRate=rate;}},[rate,state]);
  const chooseRate=(value:number)=>{setRate(value);try{window.localStorage.setItem(RATE_KEY,String(value));}catch{/* the choice still applies to this page */}};
  useLayoutEffect(()=>{
    if(restoreFocus.current&&state==='idle'){restoreFocus.current=false;primary.current?.focus({preventScroll:true});}
    if(errorFocus.current&&state==='error'){
      const retired=errorFocus.current;errorFocus.current=null;
      // Repair only the focused control that disappeared, without taking focus
      // from someone who moved back to their question while a read was pending.
      if(!retired.isConnected&&(document.activeElement===retired||document.activeElement===document.body))primary.current?.focus({preventScroll:true});
    }
  },[state]);
  const release=(audio=player.current)=>{
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();}
    if(url.current){URL.revokeObjectURL(url.current);url.current=null;}
  };
  const fail=()=>{
    if(!url.current&&stopControl.current&&document.activeElement===stopControl.current)errorFocus.current=stopControl.current;
    setState('error');
  };
  const silenceDevice=()=>{if(device.current){try{window.speechSynthesis?.cancel();}catch{/* nothing left to stop */}}};
  useEffect(()=>{active.current=true;const audio=player.current;return()=>{active.current=false;preparing.current=false;serial.current++;request.current?.abort();silenceDevice();release(audio);if(currentReading?.token===token.current)currentReading=null;};},[]);
  const play=async(seq:number)=>{
    const audio=player.current;if(!audio||!active.current)return;
    try{await audio.play();if(active.current&&serial.current===seq)setState('playing');}
    catch{if(active.current&&serial.current===seq)fail();}
  };
  // The recorded reading depends on an external voice service. When it does
  // not answer, the same published text is read by the browser's own voice.
  const speakWithDevice=(seq:number):boolean=>{
    const synth=typeof window!=='undefined'?window.speechSynthesis:undefined;
    const text=(fallbackText??'').replace(/[•*_]/g,' ').replace(/[ \t]{2,}/g,' ').replace(/\s+\n/g,'\n').trim().slice(0,MAX_DEVICE_CHARS);
    if(!synth||!text||typeof SpeechSynthesisUtterance==='undefined')return false;
    try{
      synth.cancel();
      const utterance=new SpeechSynthesisUtterance(text);
      utterance.lang='es-AR';utterance.rate=rate;
      utterance.onend=()=>{if(active.current&&serial.current===seq)setState('ready');};
      utterance.onerror=()=>{if(active.current&&serial.current===seq){device.current=false;setDeviceVoice(false);fail();}};
      device.current=true;setDeviceVoice(true);synth.speak(utterance);setState('playing');return true;
    }catch{return false;}
  };
  const listen=async()=>{
    const audio=player.current;if(!audio||preparing.current||state==='loading')return;
    if(device.current&&state==='playing'){window.speechSynthesis.pause();setState('paused');return;}
    if(device.current&&state==='paused'){window.speechSynthesis.resume();setState('playing');return;}
    if(state==='playing'){audio.pause();setState('paused');return;}
    if(currentReading?.token!==token.current)currentReading?.stop();
    currentReading={token:token.current,stop:()=>stopCurrent.current()};
    const seq=++serial.current;
    if(device.current){if(!speakWithDevice(seq))fail();return;}
    if(url.current){await play(seq);return;}
    // ARIA keeps the initiating button in the keyboard order. This synchronous
    // guard also blocks repeated activations before React commits loading.
    const controller=new AbortController();request.current=controller;preparing.current=true;setState('loading');
    try{
      const blob=await readInstitutionalAudio(scope,{signal:controller.signal,isCurrent:()=>active.current&&request.current===controller});
      if(!active.current||controller.signal.aborted||request.current!==controller)return;
      url.current=URL.createObjectURL(blob);audio.src=url.current;
      // This follows an explicit Listen action. Rendering/new replies never play.
      await play(seq);
    }catch{if(active.current&&!controller.signal.aborted&&request.current===controller){if(!speakWithDevice(seq))fail();}}
    finally{if(request.current===controller)preparing.current=false;}
  };
  const stop=(returnFocus=false)=>{restoreFocus.current=returnFocus;preparing.current=false;serial.current++;request.current?.abort();request.current=null;silenceDevice();release();if(currentReading?.token===token.current)currentReading=null;setState('idle');};
  stopCurrent.current=stop;
  return <section className="institutional-response-audio" aria-label={copy.listen}>
    <p className="institutional-response-audio__disclosure">{deviceVoice?DEVICE_VOICE_NOTE:copy.disclosure}</p>
    <div className="institutional-response-audio__controls">
      <button ref={primary} type="button" aria-disabled={state==='loading'} onClick={()=>void listen()}>
        {state==='loading'?copy.loading:state==='playing'?copy.pause:state==='paused'?copy.resume:copy.listen}
      </button>
      {(state==='loading'||url.current||(deviceVoice&&(state==='playing'||state==='paused')))?<button ref={stopControl} type="button" onClick={()=>stop(true)}>{copy.stop}</button>:null}
    </div>
    {speedLabel?<div className="institutional-response-audio__speed" role="group" aria-label={speedLabel}>
      <span aria-hidden="true">{speedLabel}</span>
      {READING_RATES.map(value=><button key={value} type="button" aria-pressed={rate===value} onClick={()=>chooseRate(value)}>{rateLabel(value)}</button>)}
    </div>:null}
    <audio ref={player} preload="none" onEnded={()=>{if(active.current)setState('ready');}} onError={()=>{if(active.current){release();fail();}}} />
    {state==='loading'?<p role="status">{copy.loading}</p>:null}
    {state==='error'?<p role="alert">{copy.error}</p>:null}
  </section>;
}
