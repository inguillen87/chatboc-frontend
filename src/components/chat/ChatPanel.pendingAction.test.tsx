import React from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import {usePanelSessionStore, useWidgetSessionStore} from '@/stores';
import {resetBackendBootstrapGateForTests} from '@/utils/backendBootstrapGate';

// Synthetic mounted consumer + actual chat hook/apiFetch. No HTTP leaves this test.
vi.mock('@/config', async original => ({...await original<typeof import('@/config')>(), API_BASE_CANDIDATES:['/api'], BASE_API_URL:'/api', SAME_ORIGIN_PROXY_BASE:'/api'}));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
vi.mock('@/hooks/useUser', () => ({useUser: () => ({user:null})}));
vi.mock('@/hooks/use-mobile', () => ({useIsMobile: () => false}));
vi.mock('@/hooks/useBusinessHours', () => ({useBusinessHours: () => ({isLiveChatEnabled:false, horariosAtencion:'', availabilityLabel:'', timezone:''})}));
vi.mock('@/utils/frontendTelemetry', () => ({trackFrontendEvent:vi.fn()}));
vi.mock('@/utils/widgetTelemetry', () => ({trackWidgetEvent:vi.fn()}));
vi.mock('./ChatHeader', () => ({default: () => <div/>}));
vi.mock('./ChatInput', () => ({default: React.forwardRef(function DraftInput({onSendMessage}: {onSendMessage:(payload:{text:string;source:'input'})=>void}, _ref) {
  const [draft,setDraft]=React.useState('');
  return <><input aria-label="Borrador de consulta" value={draft} onChange={event=>setDraft(event.target.value)}/>
    <button onClick={()=>onSendMessage({text:draft,source:'input'})}>Enviar consulta de prueba</button></>;
})}));
vi.mock('./RealtimeAvatarStage', () => ({default: () => null}));
vi.mock('@/components/ui/ScrollToBottomButton', () => ({default: () => null}));
import ChatPanel from './ChatPanel';

const originalFetch=global.fetch;
const key='pending_widget_action';
const legacyNotice=/abrí.*seguimiento.*número.*PIN/i;
const panel=(slug='qa-visitor')=><ChatPanel tipoChat="municipio" tenantSlug={slug} mode="script"/>;
const chatPosts=()=>vi.mocked(global.fetch).mock.calls.filter(([url,request])=>String(url).includes('/ask/municipio')&&request?.method==='POST');
const settle=async()=>act(async()=>{for(let i=0;i<30;i++)await Promise.resolve();});
const advance=async(ms=500)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
const ordinaryAction={action:'contactos_utiles',text:'Consultar contactos'};

beforeEach(()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  vi.spyOn(console,'log').mockImplementation(()=>{});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  vi.spyOn(console,'error').mockImplementation(()=>{});
  safeLocalStorage.clear();window.sessionStorage.clear();
  safeLocalStorage.setItem('chat_session_id','synthetic-existing-session');
  safeLocalStorage.setItem('user',JSON.stringify({id:900,name:'Synthetic panel user'}));
  usePanelSessionStore.setState({authToken:'synthetic-panel-token',user:null});
  useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
  global.fetch=vi.fn().mockImplementation(async(url,request)=>{
    if(request?.method==='POST')return new Response(JSON.stringify({message_body:'Respuesta de prueba vigente'}),{headers:{'Content-Type':'application/json'}});
    const value=workspace({visibility:'public',can_edit:false});
    value.tenant.slug=String(url).includes('qa-other')?'qa-other':'qa-visitor';
    return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
  });
});
afterEach(()=>{
  cleanup();global.fetch=originalFetch;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();resetBackendBootstrapGateForTests();
});

describe('pending widget action retirement',()=>{
  it.each([
    {action:'ticket_public_tracking'},
    {action:'contactos_utiles',payload:{action:'ticket_live_or_offline_message'}},
    {action:'contactos_utiles',payload:{type:'ticket_live_or_offline_message'}},
    {action:'contactos_utiles',action_id:'ticket_public_tracking'},
  ])('keeps obsolete tracking out of the mounted chat request (%#)',async action=>{
    const previousProfile=safeLocalStorage.getItem('user');
    safeLocalStorage.setItem(key,JSON.stringify({...action,payload:{...('payload' in action?action.payload:{}),ticketId:901,pin:'synthetic-pin'}}));
    render(panel());
    fireEvent.change(screen.getByRole('textbox',{name:'Borrador de consulta'}),{target:{value:'Consulta sin enviar'}});
    await settle();await advance();
    expect(chatPosts().length).toBe(0);
    expect(screen.getByText(legacyNotice)).toBeInTheDocument();
    expect(screen.getByRole('textbox',{name:'Borrador de consulta'})).toHaveValue('Consulta sin enviar');
    expect(safeLocalStorage.getItem('user')===previousProfile).toBe(true);
    expect(safeLocalStorage.getItem('chat_session_id')==='synthetic-existing-session').toBe(true);
    expect(safeLocalStorage.getItem('chatboc_public_chat_context')===null).toBe(true);
    expect(safeLocalStorage.getItem(key)===null).toBe(true);
    expect(screen.queryByText('ticket_public_tracking')).not.toBeInTheDocument();
  });

  it('sends an ordinary queued action once through the actual hook and API after bootstrap updates',async()=>{
    safeLocalStorage.setItem(key,JSON.stringify(ordinaryAction));
    render(panel());await settle();await advance(200);await settle();
    expect(screen.getByText('Elegí un tema o escribí una pregunta.')).toBeInTheDocument();
    await advance(300);
    expect(chatPosts().length).toBe(1);
    const [_,request]=chatPosts()[0];
    const body=JSON.parse(String(request?.body));
    expect(body.action===ordinaryAction.action&&body.pregunta===ordinaryAction.text&&body.tenant_slug==='qa-visitor').toBe(true);
    expect(new Headers(request?.headers).get('Authorization')===null).toBe(true);
    expect(request?.credentials==='omit').toBe(true);
    expect(screen.queryByText(legacyNotice)).not.toBeInTheDocument();
    await advance(1000);expect(chatPosts().length).toBe(1);
  });

  it('appends the notice without replacing prior messages or the current draft',async()=>{
    render(panel());await settle();await advance(200);await settle();
    expect(screen.getByText('Elegí un tema o escribí una pregunta.')).toBeInTheDocument();
    safeLocalStorage.setItem(key,JSON.stringify({action:'ticket_public_tracking'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Borrador de consulta'}),{target:{value:'Consulta previa de prueba'}});
    fireEvent.click(screen.getByRole('button',{name:'Enviar consulta de prueba'}));
    await settle();await advance();
    expect(chatPosts().length).toBe(1);
    expect(screen.getByText('Elegí un tema o escribí una pregunta.')).toBeInTheDocument();
    expect(screen.getByText(/Consulta previa de prueba/)).toBeInTheDocument();
    expect(screen.getByText(/Respuesta de prueba vigente/)).toBeInTheDocument();
    expect(screen.getByText(legacyNotice)).toBeInTheDocument();
    expect(screen.getByRole('textbox',{name:'Borrador de consulta'})).toHaveValue('Consulta previa de prueba');
  });

  it('discards malformed queue data without logging its contents',async()=>{
    safeLocalStorage.setItem(key,'{"pin":"synthetic-pin",');
    render(panel());await settle();await advance();
    expect(chatPosts().length).toBe(0);
    expect(vi.mocked(console.error).mock.calls.length).toBe(0);
    expect(vi.mocked(console.warn).mock.calls.some(args=>args.some(value=>String(value).includes('synthetic-pin')))).toBe(false);
    expect(safeLocalStorage.getItem(key)===null).toBe(true);
  });

  it.each(['unmount','tenant change'] as const)('cancels the pending timer on %s without dispatching',async retirement=>{
    const clear=vi.spyOn(globalThis,'clearTimeout');
    const schedule=vi.spyOn(globalThis,'setTimeout');
    safeLocalStorage.setItem(key,JSON.stringify(ordinaryAction));
    const view=render(panel());await settle();
    const index=schedule.mock.calls.findIndex(([,delay])=>delay===500);
    expect(index>=0).toBe(true);
    const timer=schedule.mock.results[index].value;
    if(retirement==='unmount')view.unmount();else view.rerender(panel('qa-other'));
    await settle();await advance();
    expect(clear.mock.calls.some(([id])=>id===timer)).toBe(true);
    expect(chatPosts().length).toBe(0);
  });

  it('preserves ordinary actions across the StrictMode effect replay',async()=>{
    safeLocalStorage.setItem(key,JSON.stringify(ordinaryAction));
    render(<React.StrictMode>{panel()}</React.StrictMode>);
    await settle();await advance();
    expect(chatPosts().length).toBe(1);
  });

  it('does not revive the queued mutation after A → B → A',async()=>{
    safeLocalStorage.setItem(key,JSON.stringify(ordinaryAction));
    const view=render(panel());await settle();
    view.rerender(panel('qa-other'));await settle();
    view.rerender(panel());await settle();await advance();
    expect(chatPosts().length).toBe(0);
  });
});
