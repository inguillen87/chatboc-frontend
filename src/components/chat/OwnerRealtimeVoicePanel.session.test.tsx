import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import OwnerRealtimeVoicePanel from '@/components/chat/OwnerRealtimeVoicePanel';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
const {apiFetch,start,close,mute,create}=vi.hoisted(()=>({apiFetch:vi.fn(),start:vi.fn(),close:vi.fn().mockResolvedValue(true),mute:vi.fn(),create:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch}));
vi.mock('@/utils/ownerRealtimeVoice',()=>({createOwnerVoiceTransport:create}));
const ui={title:'Voz de prueba',description:'Fixture sintético',disabled:'No habilitada',consent:'Activar mi micrófono',start:'Iniciar voz',stop:'Terminar voz',mute:'Silenciar',unmute:'Activar',text:'Volver al texto',idle:'Apagado',connecting:'Conectando',live:'Conectado',pending:'Cierre pendiente',ended:'Terminado',error:'Error',you:'Vos',assistant:'Asistente',captions:'Subtítulos',avatar_notice:'Ilustrativo',limit_notice:'UX'};
const cap={enabled:true,revision:'r',ui,tenant:{slug:'a'},owner_trial:true,contract_version:'browser.realtime.owner_trial.v1'};
let options:any;
beforeEach(()=>{vi.clearAllMocks();close.mockResolvedValue(true);apiFetch.mockResolvedValue(cap);create.mockImplementation((value:any)=>{options=value;return{start,close,mute};});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function open(){fireEvent.click(await screen.findByRole('button',{name:'Probar conversación por voz'}));}
async function begin(){await open();fireEvent.click(screen.getByRole('checkbox'));await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Iniciar voz'}));});}
const delayed=()=>{let resolve!:(v:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return{promise,resolve};};
it('retires an initial capability response when the application session generation changes',async()=>{
 const read=delayed();apiFetch.mockImplementation(()=>new Promise(()=>{}));apiFetch.mockReturnValueOnce(read.promise);render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);
 act(()=>{advanceChatbocSessionRevision();});await act(async()=>{read.resolve(cap);});
 expect(screen.queryByRole('button',{name:'Probar conversación por voz'})).not.toBeInTheDocument();expect(create).not.toHaveBeenCalled();
});
it('does not create a transport from a preflight issued before the session retired',async()=>{
 render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);await open();fireEvent.click(screen.getByRole('checkbox'));
 const read=delayed();apiFetch.mockReturnValueOnce(read.promise);fireEvent.click(screen.getByRole('button',{name:'Iniciar voz'}));
 act(()=>{advanceChatbocSessionRevision();});await act(async()=>{read.resolve(cap);});expect(create).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled();
});
it('closes the local live transport and removes its captions after session retirement',async()=>{
 render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);await begin();act(()=>{options.state('live');options.captions([{id:'old',speaker:'assistant',text:'Respuesta anterior'}]);});
 await act(async()=>{advanceChatbocSessionRevision();});expect(close).toHaveBeenCalledOnce();expect(screen.queryByText('Respuesta anterior')).not.toBeInTheDocument();
});
it('ignores old callbacks after two session changes return to the same tenant',async()=>{
 render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);await begin();const old=options;
 await act(async()=>{advanceChatbocSessionRevision();advanceChatbocSessionRevision();});
 act(()=>{old.state('live');old.captions([{id:'late',speaker:'assistant',text:'Respuesta retirada'}]);});
 expect(screen.queryByText('Respuesta retirada')).not.toBeInTheDocument();expect(close).toHaveBeenCalledOnce();
});
it.each(['reject','throw'] as const)('retires visual state without retry when old close %s',async kind=>{
 render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);await begin();act(()=>{options.state('live');options.captions([{id:'old',speaker:'assistant',text:'Respuesta anterior'}]);});
 close.mockImplementationOnce(()=>{if(kind==='throw')throw Error('synthetic-local-close');return Promise.reject(Error('synthetic-remote-close'));});
 await act(async()=>{advanceChatbocSessionRevision();});expect(close).toHaveBeenCalledOnce();expect(screen.queryByText('Respuesta anterior')).not.toBeInTheDocument();
 expect(start).toHaveBeenCalledOnce();expect(screen.queryByText(ui.live)).not.toBeInTheDocument();
});
it('control: a current confirmed capability starts once without session change',async()=>{
 render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);await begin();await waitFor(()=>expect(create).toHaveBeenCalledOnce());expect(start).toHaveBeenCalledOnce();expect(apiFetch).toHaveBeenCalledTimes(2);expect(close).not.toHaveBeenCalled();
});
it('control: a disabled capability never creates local transport',async()=>{
 apiFetch.mockResolvedValue({...cap,enabled:false});render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);await open();expect(screen.getByText(ui.disabled)).toBeVisible();expect(create).not.toHaveBeenCalled();
});
it('releases synthetic tracks and sends one remote close with the real transport on a session change',async()=>{
 const actual=await vi.importActual<typeof import('@/utils/ownerRealtimeVoice')>('@/utils/ownerRealtimeVoice');
 const track={stop:vi.fn(),enabled:true};const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 const channel:any={close:vi.fn(),readyState:'open',onopen:null,onmessage:null};
 const peer:any={addTrack:vi.fn(),createDataChannel:()=>channel,createOffer:vi.fn().mockResolvedValue({sdp:'synthetic-offer'}),setLocalDescription:vi.fn().mockResolvedValue(undefined),setRemoteDescription:vi.fn().mockResolvedValue(undefined),close:vi.fn(),connectionState:'connected'};
 vi.stubGlobal('RTCPeerConnection',function(){return peer;});
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue(stream)}});
 vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
 apiFetch.mockImplementation((path:string,request:any)=>Promise.resolve(request?.method==='POST' ? path.endsWith('/stop')?{provider_close_accepted:true}:{session_id:'a'.repeat(32),sdp:'synthetic-answer',limits:{client_duration_seconds:120}} : cap));
 create.mockImplementationOnce(actual.createOwnerVoiceTransport);
 render(<OwnerRealtimeVoicePanel tenantSlug="a"/>);await begin();await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent(ui.live));
 act(()=>{advanceChatbocSessionRevision();});await waitFor(()=>expect(track.stop).toHaveBeenCalledOnce());
 expect(peer.close).toHaveBeenCalledOnce();expect(channel.close).toHaveBeenCalledOnce();
 await waitFor(()=>expect(apiFetch.mock.calls.filter(([path])=>path.endsWith('/stop'))).toHaveLength(1));
 expect(screen.queryByText('Conectado')).not.toBeInTheDocument();
});
