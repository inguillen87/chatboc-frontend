import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import ChatInput from '@/components/chat/ChatInput';
import ChatComposer from '@/features/chat/ChatComposer';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import useAudioRecorder,{recordedAudioFilename} from './useAudioRecorder';
import {apiFetch} from '@/utils/api';
vi.mock('@/utils/api',async original=>({...await original<typeof import('@/utils/api')>(),apiFetch:vi.fn()}));

// Synthetic media only: this suite never asks a browser or device for a stream.
const deferred=<T,>()=>{let resolve!:(value:T)=>void;return {promise:new Promise<T>(done=>{resolve=done;}),resolve:(value:T)=>resolve(value)};};
const originalMediaDevices=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');
let getUserMedia:ReturnType<typeof vi.fn>;
let recorders:FakeRecorder[];
let resources:Array<ReturnType<typeof stream>>;
let failConstructor=false,failStart=false,deferStop=false,deferStart=false,selectedMime='audio/webm';
const stream=()=>{const track={stop:vi.fn()};return {track,value:{getTracks:()=>[track]} as unknown as MediaStream};};
class FakeRecorder {
  readonly mimeType=selectedMime;
  state='inactive';
  onstart:(()=>void)|null=null;
  ondataavailable:((event:{data:Blob})=>void)|null=null;
  onstop:(()=>void)|null=null;
  onerror:(()=>void)|null=null;
  start=vi.fn(()=>{if(failStart)throw new Error('synthetic_start_failure');this.state='recording';if(!deferStart)this.onstart?.();});
  stop=vi.fn(()=>{this.state='inactive';if(!deferStop)this.finishStop();});
  finishStop=()=>{this.ondataavailable?.({data:new Blob(['synthetic-audio'],{type:this.mimeType})});this.onstop?.();};
  constructor(readonly stream:MediaStream){if(failConstructor)throw new Error('synthetic_constructor_failure');recorders.push(this);}
}
const mediaCapabilities={composer:{actions:[{id:'audio',type:'audio',label:'Nota de voz'}]},input_modes:{audio:{enabled:true,chat_endpoint:'/ask',multipart_field:'audio_file'}}};
const resource=()=>{const value=stream();resources.push(value);return value;};
beforeEach(()=>{
  recorders=[];resources=[];failConstructor=false;failStart=false;deferStop=false;deferStart=false;selectedMime='audio/webm';
  getUserMedia=vi.fn();
  vi.mocked(apiFetch).mockReset();
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
  vi.stubGlobal('MediaRecorder',FakeRecorder);
  window.localStorage.clear();window.sessionStorage.clear();
});
afterEach(()=>{
  cleanup();
  // Dispose synthetic leftovers even when an assertion deliberately fails.
  resources.forEach(value=>value.track.stop());
  if(originalMediaDevices)Object.defineProperty(navigator,'mediaDevices',originalMediaDevices);
  else Reflect.deleteProperty(navigator,'mediaDevices');
  vi.unstubAllGlobals();vi.restoreAllMocks();
});

describe('audio recorder lifetime with synthetic tracks',()=>{
  it('disposes a late permission grant after unmount without starting a recorder',async()=>{
    const grant=deferred<MediaStream>(),audio=resource();getUserMedia.mockReturnValue(grant.promise);
    const hook=renderHook(()=>useAudioRecorder());
    let start!:Promise<void>;act(()=>{start=hook.result.current.startRecording();});
    hook.unmount();await act(async()=>{grant.resolve(audio.value);await start;});
    expect(audio.track.stop).toHaveBeenCalledOnce();
    expect(recorders).toHaveLength(0);
  });
  it('stops active tracks when its mounted owner disappears',async()=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const hook=renderHook(()=>useAudioRecorder());
    await act(async()=>{await hook.result.current.startRecording();});
    expect(hook.result.current.isRecording).toBe(true);
    hook.unmount();
    expect(audio.track.stop).toHaveBeenCalledOnce();
    expect(recorders[0].stop).toHaveBeenCalledOnce();
  });
  it('admits only one pending Start before a permission grant resolves',async()=>{
    const grant=deferred<MediaStream>(),audio=resource();getUserMedia.mockReturnValue(grant.promise);
    const hook=renderHook(()=>useAudioRecorder());
    let first!:Promise<void>,second!:Promise<void>;
    act(()=>{first=hook.result.current.startRecording();second=hook.result.current.startRecording();});
    await act(async()=>{grant.resolve(audio.value);await Promise.all([first,second]);});
    expect(getUserMedia).toHaveBeenCalledOnce();expect(recorders).toHaveLength(1);
  });
  it.each(['constructor','start'] as const)('disposes acquired tracks if MediaRecorder %s fails',async(failure)=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    failConstructor=failure==='constructor';failStart=failure==='start';
    const hook=renderHook(()=>useAudioRecorder());
    await act(async()=>{await expect(hook.result.current.startRecording()).rejects.toThrow(`synthetic_${failure}_failure`);});
    expect(audio.track.stop).toHaveBeenCalledOnce();expect(hook.result.current.isRecording).toBe(false);
  });
  it('keeps current Stop as an explicit completion and releases its tracks',async()=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const hook=renderHook(()=>useAudioRecorder());
    await act(async()=>{await hook.result.current.startRecording();});
    let recorded:Blob|null=null;await act(async()=>{recorded=await hook.result.current.stopRecording();});
    expect(recorded).toBeInstanceOf(Blob);expect(recorded!.size).toBeGreaterThan(0);
    expect(audio.track.stop).toHaveBeenCalledOnce();expect(hook.result.current.isRecording).toBe(false);
  });
  it('shares one asynchronous Stop and settles both callers',async()=>{
    deferStop=true;const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const hook=renderHook(()=>useAudioRecorder());await act(async()=>{await hook.result.current.startRecording();});
    let first!:Promise<Blob|null>,second!:Promise<Blob|null>;
    act(()=>{first=hook.result.current.stopRecording();second=hook.result.current.stopRecording();});
    expect(first).toBe(second);expect(recorders[0].stop).toHaveBeenCalledOnce();
    let results!:Array<Blob|null>;
    await act(async()=>{recorders[0].finishStop();results=await Promise.all([first,second]);});
    expect(results[0]).toBeInstanceOf(Blob);expect(results[1]).toBe(results[0]);expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it('retires a pending grant durably across A -> B -> A',async()=>{
    const grant=deferred<MediaStream>(),audio=resource();getUserMedia.mockReturnValue(grant.promise);
    const hook=renderHook(({scope})=>useAudioRecorder({scopeKey:scope}),{initialProps:{scope:'qa-a'}});
    let start!:Promise<void>;act(()=>{start=hook.result.current.startRecording();});
    hook.rerender({scope:'qa-b'});hook.rerender({scope:'qa-a'});
    await act(async()=>{grant.resolve(audio.value);await start;});
    expect(audio.track.stop).toHaveBeenCalledOnce();expect(recorders).toHaveLength(0);
  });
  it('cancels a pending grant without constructing a recorder',async()=>{
    const grant=deferred<MediaStream>(),audio=resource();getUserMedia.mockReturnValue(grant.promise);
    const hook=renderHook(()=>useAudioRecorder());let start!:Promise<void>;
    act(()=>{start=hook.result.current.startRecording();});expect(hook.result.current.isStarting).toBe(true);
    act(()=>hook.result.current.cancelRecording());await act(async()=>{grant.resolve(audio.value);await start;});
    expect(audio.track.stop).toHaveBeenCalledOnce();expect(recorders).toHaveLength(0);expect(hook.result.current.isRecording).toBe(false);
  });
  it('retires asynchronous completion when the session authority changes',async()=>{
    deferStop=true;const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const hook=renderHook(()=>useAudioRecorder());await act(async()=>{await hook.result.current.startRecording();});
    const owner=hook.result.current.captureRecordingOwner();let result!:Promise<Blob|null>;
    act(()=>{result=hook.result.current.stopRecording();advanceChatbocSessionRevision();});
    expect(await result).toBeNull();expect(owner()).toBe(false);expect(audio.track.stop).toHaveBeenCalledOnce();
    act(()=>recorders[0].finishStop());expect(hook.result.current.isRecording).toBe(false);
  });
  it('does not resurrect a retired attempt through a delayed onstart event',async()=>{
    deferStart=true;const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const hook=renderHook(()=>useAudioRecorder());await act(async()=>{await hook.result.current.startRecording();});
    const late=recorders[0].onstart;act(()=>hook.result.current.cancelRecording());act(()=>late?.());
    expect(hook.result.current.isRecording).toBe(false);expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it('allows Stop immediately after recorder.start while native onstart is still queued',async()=>{
    deferStart=true;const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const hook=renderHook(()=>useAudioRecorder());await act(async()=>{await hook.result.current.startRecording();});
    expect(hook.result.current.isRecording).toBe(true);
    let blob!:Blob|null;await act(async()=>{blob=await hook.result.current.stopRecording();});
    expect(blob).toBeInstanceOf(Blob);expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it('retires a pending grant when the session changes without changing tenant props',async()=>{
    const grant=deferred<MediaStream>(),audio=resource();getUserMedia.mockReturnValue(grant.promise);
    const hook=renderHook(()=>useAudioRecorder());let start!:Promise<void>;
    act(()=>{start=hook.result.current.startRecording();advanceChatbocSessionRevision();advanceChatbocSessionRevision();});
    await act(async()=>{grant.resolve(audio.value);await start;});
    expect(recorders).toHaveLength(0);expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it.each(['audio/mp4;codecs=mp4a.40.2','audio/ogg;codecs=opus','audio/webm;codecs=opus'])('preserves the recorder MIME %s',async(mime)=>{
    selectedMime=mime;const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const hook=renderHook(()=>useAudioRecorder());await act(async()=>{await hook.result.current.startRecording();});
    let blob!:Blob|null;await act(async()=>{blob=await hook.result.current.stopRecording();});
    expect(blob!.type).toBe(mime);expect(recordedAudioFilename(blob!)).toMatch(mime.startsWith('audio/mp4')?/\.m4a$/:mime.startsWith('audio/ogg')?/\.ogg$/:/\.webm$/);
  });
});

describe('actual ChatInput recording ownership',()=>{
  it('does not send an old organization recording through a new organization callback',async()=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const sendA=vi.fn(),sendB=vi.fn();
    const view=(slug:string,onSendMessage:typeof sendA)=><ChatInput onSendMessage={onSendMessage} isTyping={false} tenantSlug={slug} mediaCapabilities={mediaCapabilities}/>;
    const mounted=render(view('qa-a',sendA));
    fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Detener grabación'})).toBeVisible());
    mounted.rerender(view('qa-b',sendB));
    const stop=screen.queryByRole('button',{name:'Detener grabación'});
    if(stop)await act(async()=>{fireEvent.click(stop);});
    expect(sendB).not.toHaveBeenCalled();expect(sendA).not.toHaveBeenCalled();
    expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it('does not start a recording from a grant that belongs to the prior organization',async()=>{
    const grant=deferred<MediaStream>(),audio=resource();getUserMedia.mockReturnValue(grant.promise);
    const view=(slug:string)=><ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug={slug} mediaCapabilities={mediaCapabilities}/>;
    const mounted=render(view('qa-a'));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));
    mounted.rerender(view('qa-b'));await act(async()=>{grant.resolve(audio.value);await grant.promise;});
    expect(audio.track.stop).toHaveBeenCalledOnce();expect(recorders).toHaveLength(0);
    expect(screen.queryByRole('button',{name:'Detener grabación'})).toBeNull();
  });
  it('keeps the active Stop control reachable while a transient bot reply is pending',async()=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const view=(isTyping:boolean)=><ChatInput onSendMessage={vi.fn()} isTyping={isTyping} tenantSlug="qa-a" mediaCapabilities={mediaCapabilities}/>;
    const mounted=render(view(false));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));
    await screen.findByRole('button',{name:'Detener grabación'});mounted.rerender(view(true));
    expect(screen.getByRole('button',{name:'Detener grabación'})).toBeEnabled();
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Detener grabación'})));
    expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it('keeps a recording as an explicit local draft while typing and sends only after activation',async()=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);const send=vi.fn();
    const view=(isTyping:boolean)=><ChatInput onSendMessage={send} isTyping={isTyping} tenantSlug="qa-a" mediaCapabilities={mediaCapabilities}/>;
    const mounted=render(view(false));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));
    await screen.findByRole('button',{name:'Detener grabación'});mounted.rerender(view(true));
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Detener grabación'})));
    expect(send).not.toHaveBeenCalled();expect(audio.track.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole('button',{name:'Enviar grabación'})).toBeDisabled();
    mounted.rerender(view(false));expect(send).not.toHaveBeenCalled();
    const button=screen.getByRole('button',{name:'Enviar grabación'});
    await act(async()=>{fireEvent.click(button);fireEvent.click(button);});
    expect(send).toHaveBeenCalledOnce();expect(screen.queryByRole('button',{name:'Enviar grabación'})).toBeNull();
  });
  it.each(['scope','session','discard'] as const)('discards a held recording on %s instead of delivering it later',async(retirement)=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);const send=vi.fn();
    const view=(isTyping:boolean,slug='qa-a')=><ChatInput onSendMessage={send} isTyping={isTyping} tenantSlug={slug} mediaCapabilities={mediaCapabilities}/>;
    const mounted=render(view(false));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));
    await screen.findByRole('button',{name:'Detener grabación'});mounted.rerender(view(true));
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Detener grabación'})));
    expect(screen.getByRole('button',{name:'Enviar grabación'})).toBeVisible();
    if(retirement==='scope')mounted.rerender(view(false,'qa-b'));
    else if(retirement==='session')act(()=>advanceChatbocSessionRevision());
    else fireEvent.click(screen.getByRole('button',{name:'Descartar grabación'}));
    mounted.rerender(view(false,retirement==='scope'?'qa-b':'qa-a'));
    expect(screen.queryByRole('button',{name:'Enviar grabación'})).toBeNull();expect(send).not.toHaveBeenCalled();
  });
  it.each(['scope','session'] as const)('admits a new recording after %s retirement while an old legacy prepare remains unresolved',async(retirement)=>{
    const old=deferred<unknown>(),audioA=resource(),audioB=resource();getUserMedia.mockResolvedValueOnce(audioA.value).mockResolvedValueOnce(audioB.value);
    const prepared={ok:true,contract_version:'chat.attachment.direct.v1',operation:'prepare_direct_upload',upload_id:'synthetic-upload',intent_token:'synthetic-intent',
      upload:{method:'PUT',url:'https://objects.example.test/synthetic-audio',headers:{'Content-Type':'audio/webm'},expires_in_seconds:300},
      constraints:{max_file_bytes:1024,exact_size_required:true}};
    vi.mocked(apiFetch).mockReturnValueOnce(old.promise).mockResolvedValueOnce(prepared)
      .mockResolvedValueOnce({ok:true,url:'https://objects.example.test/new-recording.webm',filename:'new-recording.webm',mime_type:'audio/webm'});
    const put=vi.fn().mockResolvedValue(new Response('',{status:200}));vi.stubGlobal('fetch',put);
    const send=vi.fn();const view=(slug:string)=><ChatInput onSendMessage={send} isTyping={false} tenantSlug={slug}/>;
    const mounted=render(view('qa-a'));fireEvent.click(screen.getByRole('button',{name:'Audio'}));
    await screen.findByRole('button',{name:'Detener grabación'});fireEvent.click(screen.getByRole('button',{name:'Detener grabación'}));
    await waitFor(()=>expect(apiFetch).toHaveBeenCalledOnce());
    if(retirement==='scope')mounted.rerender(view('qa-b'));else act(()=>advanceChatbocSessionRevision());
    fireEvent.click(screen.getByRole('button',{name:'Audio'}));await screen.findByRole('button',{name:'Detener grabación'});
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button',{name:'Detener grabación'}));await waitFor(()=>expect(send).toHaveBeenCalledOnce());
    expect(put).toHaveBeenCalledOnce();expect(apiFetch).toHaveBeenCalledTimes(3);
    await act(async()=>{old.resolve(prepared);await old.promise;});
    expect(send).toHaveBeenCalledOnce();expect(put).toHaveBeenCalledOnce();expect(apiFetch).toHaveBeenCalledTimes(3);
  });
  it.each(['disabled','capability'] as const)('releases an active stream after %s removal',async(reason)=>{
    const audio=resource();getUserMedia.mockResolvedValue(audio.value);
    const view=(retired:boolean)=><ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="qa-a" disabled={retired&&reason==='disabled'}
      mediaCapabilities={retired&&reason==='capability'?{...mediaCapabilities,input_modes:{audio:{enabled:false}}}:mediaCapabilities}/>;
    const mounted=render(view(false));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));
    await screen.findByRole('button',{name:'Detener grabación'});mounted.rerender(view(true));
    expect(audio.track.stop).toHaveBeenCalledOnce();expect(screen.queryByRole('button',{name:'Detener grabación'})).toBeNull();
  });
});

describe.each(['input','composer'] as const)('actual %s Stop completion',caller=>{
  const view=(send:ReturnType<typeof vi.fn>,slug='qa-a')=>caller==='input'
    ?<ChatInput onSendMessage={send} isTyping={false} tenantSlug={slug} mediaCapabilities={mediaCapabilities}/>
    :<ChatComposer onSend={send} tenantSlug={slug} mediaCapabilities={mediaCapabilities}/>;
  it('sends one current completion with the browser format after duplicate Stop activations',async()=>{
    deferStop=true;selectedMime='audio/mp4';const audio=resource();getUserMedia.mockResolvedValue(audio.value);const send=vi.fn();
    render(view(send));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));await screen.findByRole('button',{name:'Detener grabación'});
    const stop=screen.getByRole('button',{name:'Detener grabación'});fireEvent.click(stop);fireEvent.click(stop);
    await act(async()=>recorders[0].finishStop());
    expect(recorders[0].stop).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({audioBlob:expect.any(Blob),audioFilename:expect.stringMatching(/\.m4a$/)});
    expect(send.mock.calls[0][0].audioBlob.type).toBe('audio/mp4');expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it.each(['scope','unmount','session'] as const)('discards completion after %s retirement',async(retirement)=>{
    deferStop=true;const audio=resource();getUserMedia.mockResolvedValue(audio.value);const send=vi.fn();
    const mounted=render(view(send));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));await screen.findByRole('button',{name:'Detener grabación'});
    fireEvent.click(screen.getByRole('button',{name:'Detener grabación'}));
    if(retirement==='scope')mounted.rerender(view(send,'qa-b'));
    else if(retirement==='unmount')mounted.unmount();
    else act(()=>advanceChatbocSessionRevision());
    await act(async()=>recorders[0].finishStop());
    expect(send).not.toHaveBeenCalled();expect(audio.track.stop).toHaveBeenCalledOnce();
  });
  it('rejects an already resolved Stop blob if its scope changes before the send continuation',async()=>{
    deferStop=true;const audio=resource();getUserMedia.mockResolvedValue(audio.value);const send=vi.fn();
    const mounted=render(view(send));fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));await screen.findByRole('button',{name:'Detener grabación'});
    fireEvent.click(screen.getByRole('button',{name:'Detener grabación'}));
    act(()=>{recorders[0].finishStop();mounted.rerender(view(send,'qa-b'));});
    await act(async()=>{await Promise.resolve();});expect(send).not.toHaveBeenCalled();
  });
});
