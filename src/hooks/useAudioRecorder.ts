import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent,subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';

type AudioRecorderState='inactive'|'starting'|'recording'|'stopping'|'paused';
interface RecordingAttempt {
  generation:number;session:number;stream:MediaStream|null;recorder:MediaRecorder|null;chunks:Blob[];
  stoppedTracks:boolean;stopRequested:boolean;retired:boolean;completion:Promise<Blob|null>|null;
  resolve:((value:Blob|null)=>void)|null;
}
export interface AudioRecorderOptions {scopeKey?:string;enabled?:boolean}
interface UseAudioRecorderReturn {
  recorderState:AudioRecorderState;startRecording:()=>Promise<void>;
  stopRecording:()=>Promise<Blob|null>;cancelRecording:()=>void;
  captureRecordingOwner:()=>()=>boolean;isRecording:boolean;isStarting:boolean;
}

/** Preserve the format selected by the browser instead of relabeling MP4 as WebM. */
export function recordedAudioFilename(blob:Blob,prefix='audio-grabado'):string {
  const mime=blob.type.split(';')[0].trim().toLowerCase();
  const extension=({'audio/mp4':'m4a','audio/m4a':'m4a','audio/x-m4a':'m4a','audio/ogg':'ogg','audio/opus':'opus',
    'audio/mpeg':'mp3','audio/mp3':'mp3','audio/mpga':'mp3','audio/wav':'wav','audio/wave':'wav','audio/x-wav':'wav'} as Record<string,string>)[mime]??'webm';
  return `${prefix}-${Date.now()}.${extension}`;
}

export const useAudioRecorder=({scopeKey='default',enabled=true}:AudioRecorderOptions={}):UseAudioRecorderReturn=>{
  const [recorderState,setRecorderState]=useState<AudioRecorderState>('inactive');
  const mounted=useRef(true),generation=useRef(0),attempt=useRef<RecordingAttempt|null>(null);
  const identity=useRef({scopeKey,enabled});
  // Invalidate at render so queued callbacks cannot outlive a scope change,
  // including A -> B -> A. Resource cleanup follows in the layout phase.
  if(identity.current.scopeKey!==scopeKey||identity.current.enabled!==enabled){
    identity.current={scopeKey,enabled};generation.current++;
  }
  const releaseTracks=(value:RecordingAttempt)=>{
    if(value.stoppedTracks||!value.stream)return;
    value.stoppedTracks=true;
    value.stream.getTracks().forEach(track=>{try{track.stop();}catch{/* Release the remaining tracks too. */}});
  };
  const retire=(value:RecordingAttempt,update=true)=>{
    value.retired=true;
    if(attempt.current===value)attempt.current=null;
    const recorder=value.recorder;
    if(recorder){
      recorder.onstart=null;recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null;
      if(!value.stopRequested&&recorder.state!=='inactive'){
        value.stopRequested=true;try{recorder.stop();}catch{/* Tracks still need releasing. */}
      }
    }
    releaseTracks(value);value.chunks=[];value.resolve?.(null);value.resolve=null;
    if(update&&mounted.current)setRecorderState('inactive');
  };
  const current=(value:RecordingAttempt)=>mounted.current&&identity.current.enabled&&!value.retired&&
    attempt.current===value&&generation.current===value.generation&&isChatbocSessionRevisionCurrent(value.session);
  useLayoutEffect(()=>{
    mounted.current=true;
    const old=attempt.current;if(old)retire(old);
    setRecorderState('inactive');
    return()=>{mounted.current=false;generation.current++;const value=attempt.current;if(value)retire(value,false);};
  },[scopeKey,enabled]);
  const captureRecordingOwner=useCallback(()=>{
    const captured=generation.current,session=captureChatbocSessionRevision();
    return ()=>mounted.current&&identity.current.enabled&&generation.current===captured&&isChatbocSessionRevisionCurrent(session);
  },[]);
  const cancelRecording=useCallback(()=>{
    generation.current++;
    const value=attempt.current;if(value)retire(value);
  },[]);
  useLayoutEffect(()=>subscribeChatbocSessionRevision(cancelRecording),[cancelRecording]);
  const startRecording=useCallback(async()=>{
    if(!mounted.current||!identity.current.enabled||attempt.current)return;
    const value:RecordingAttempt={generation:generation.current,session:captureChatbocSessionRevision(),stream:null,recorder:null,chunks:[],stoppedTracks:false,stopRequested:false,retired:false,completion:null,resolve:null};
    attempt.current=value;setRecorderState('starting');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      value.stream=stream;
      if(!current(value)){releaseTracks(value);return;}
      const recorder=new MediaRecorder(stream);value.recorder=recorder;
      recorder.ondataavailable=event=>{if(current(value)&&event.data.size>0)value.chunks.push(event.data);};
      recorder.onstart=()=>{if(current(value)&&!value.completion)setRecorderState('recording');};
      recorder.onerror=()=>{if(attempt.current===value)retire(value);};
      recorder.onstop=()=>{
        const valid=current(value),chunks=value.chunks;
        const mime=recorder.mimeType||chunks.find(chunk=>chunk.type)?.type||'audio/webm';
        const blob=valid&&value.completion&&chunks.length?new Blob(chunks,{type:mime}):null;
        if(attempt.current===value)attempt.current=null;
        releaseTracks(value);value.chunks=[];value.retired=true;
        value.resolve?.(blob);value.resolve=null;
        if(valid)setRecorderState('inactive');
      };
      recorder.start();
      // MediaRecorder.state changes synchronously; onstart may arrive later.
      if(current(value))setRecorderState('recording');
    }catch(error){
      const valid=current(value);retire(value,valid);
      if(valid)throw error;
    }
  },[]);
  const stopRecording=useCallback(()=>{
    const value=attempt.current;
    if(!value||!current(value))return Promise.resolve(null);
    if(value.completion)return value.completion;
    if(!value.recorder){cancelRecording();return Promise.resolve(null);}
    value.completion=new Promise<Blob|null>(resolve=>{value.resolve=resolve;});
    const result=value.completion;setRecorderState('stopping');
    value.stopRequested=true;
    try{value.recorder.stop();releaseTracks(value);}catch{retire(value);}
    return result;
  },[cancelRecording]);
  return {recorderState,startRecording,stopRecording,cancelRecording,captureRecordingOwner,
    isRecording:recorderState==='recording'||recorderState==='stopping',isStarting:recorderState==='starting'};
};
export default useAudioRecorder;
