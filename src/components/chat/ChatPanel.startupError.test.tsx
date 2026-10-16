import React from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ApiError} from '@/utils/api';
import {getRubrosHierarchy} from '@/api/rubros';
import ChatPanel from './ChatPanel';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';

// Real mounted panel and its error renderer; controlled chat/identity/catalog
// seams. No request or provider operation leaves this fixture.
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
vi.mock('@/api/rubros', () => ({getRubrosHierarchy:vi.fn()}));
const chatLogic={messages:[],visitorName:null,isTyping:false,institutionalBootstrapPending:false,
  suppressLegacyInitialMenu:false,handleSend:vi.fn(),activeTicketId:null,liveChatTicketId:null,
  liveChatSocketRoom:null,liveChatAccessToken:null,isLiveChatActive:false,setMessages:vi.fn(),
  setContexto:vi.fn(),setActiveTicketId:vi.fn(),contexto:{},uxContext:{},addSystemMessage:vi.fn(),
  initializeConversation:vi.fn()};
vi.mock('@/hooks/useChatLogic',async original=>({...await original<typeof import('@/hooks/useChatLogic')>(),useChatLogic:()=>chatLogic}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/hooks/use-mobile',()=>({useIsMobile:()=>false}));
vi.mock('@/hooks/useBusinessHours',()=>({useBusinessHours:()=>({isLiveChatEnabled:false,horariosAtencion:'',availabilityLabel:'',timezone:''})}));
vi.mock('./ChatHeader',()=>({default:()=>null}));
vi.mock('./ChatInput',()=>({default:React.forwardRef(function Input(){return null;})}));
vi.mock('./RealtimeAvatarStage',()=>({default:()=>null}));
vi.mock('@/components/ui/ScrollToBottomButton',()=>({default:()=>null}));
vi.mock('@/utils/frontendTelemetry',()=>({trackFrontendEvent:vi.fn()}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));

const issue=(status=500,id='synthetic-startup-request')=>new ApiError('Internal server error',status,
  {contract_version:'shared.error.v1',status_code:status,reason_code:status===503?'database_unavailable':'server_error',
    message:'Internal server error',request_id:id,retryable:status!==503},id);
const panel=()=><ChatPanel tipoChat="pyme" mode="script"/>;
const settle=()=>act(async()=>{for(let i=0;i<20;i++)await Promise.resolve();});
const loader=()=>vi.mocked(getRubrosHierarchy);

beforeEach(()=>{
  vi.clearAllMocks();window.localStorage.clear();window.sessionStorage.clear();
  chatLogic.uxContext={};
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('No network allowed in startup fixture');}));
  vi.spyOn(console,'error').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
  loader().mockReset().mockRejectedValue(issue());
});
afterEach(()=>{cleanup();document.documentElement.className='';vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('mounted widget startup recovery',()=>{
  it.each(['','dark'])('presents unexpected500 with a Spanish alert and secondary diagnostics (%s)',async theme=>{
    document.documentElement.className=theme;render(panel());
    const alert=await screen.findByRole('alert');
    expect(within(alert).getByRole('heading',{name:'No pudimos iniciar el asistente'})).toBeVisible();
    expect(alert).toHaveTextContent('Ocurrió un problema en el servidor. Podés intentar nuevamente más tarde.');
    expect(screen.queryByText(/Internal server error|Req ID:/)).not.toBeInTheDocument();
    const details=within(alert.closest('section')!).getByText('Detalles técnicos').closest('details')!;
    expect(details.open).toBe(false);
    expect(within(details).getByText('Código HTTP: 500')).not.toBeVisible();
    expect(within(details).getByText('synthetic-startup-request')).toHaveClass('select-text');
    fireEvent.click(within(details).getByText('Detalles técnicos'));
    // jsdom does not implement summary's native keyboard toggle; Chromium
    // coverage separately exercises real Tab/Space/Enter.
    expect(screen.getByRole('button',{name:'Reintentar'})).toBeVisible();
    expect(loader()).toHaveBeenCalledTimes(1);
  });

  it.each(['','dark'])('preserves503 availability without claiming a working chat (%s)',async theme=>{
    document.documentElement.className=theme;loader().mockRejectedValue(issue(503));render(panel());
    const alert=await screen.findByRole('alert');
    expect(within(alert).getByRole('heading',{name:'El asistente no está disponible por el momento'})).toBeVisible();
    expect(alert).toHaveTextContent('El servicio no está disponible temporalmente. Podés intentar nuevamente más tarde.');
    expect(within(alert.closest('section')!).getByText('Código HTTP: 503')).toBeInTheDocument();
    expect(chatLogic.handleSend).not.toHaveBeenCalled();
    await settle();expect(loader()).toHaveBeenCalledTimes(1);
  });

  it('keeps the retry control and focus during pending; deduplicates and permits explicit recovery',async()=>{
    let reject:(error:unknown)=>void=()=>{};
    loader().mockRejectedValueOnce(issue()).mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;}));
    render(panel());const button=await screen.findByRole('button',{name:'Reintentar'});button.focus();
    fireEvent.click(button);fireEvent.click(button);await settle();
    expect(loader()).toHaveBeenCalledTimes(2);
    expect(button).toBeInTheDocument();expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled','true');expect(button).toHaveAttribute('aria-busy','true');
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando disponibilidad');
    await act(async()=>reject(issue(503,'synthetic-later-request')));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Reintentar'})).toBe(button));
    expect(button).toHaveFocus();expect(button).toHaveAttribute('aria-disabled','false');
    expect(screen.queryByText('synthetic-startup-request')).not.toBeInTheDocument();
    expect(screen.getByText('synthetic-later-request')).toBeInTheDocument();
    expect(loader()).toHaveBeenCalledTimes(2);
  });

  it('does not recover focus from an outside control after a delayed failure',async()=>{
    let reject:(error:unknown)=>void=()=>{};
    loader().mockRejectedValueOnce(issue()).mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;}));
    render(<><button>Control externo</button>{panel()}</>);
    fireEvent.click(await screen.findByRole('button',{name:'Reintentar'}));
    const external=screen.getByRole('button',{name:'Control externo'});external.focus();
    await act(async()=>reject(issue(503)));await settle();
    expect(external).toHaveFocus();expect(loader()).toHaveBeenCalledTimes(2);
  });

  it('removes the failure only after a successful explicit load and keeps legitimate empty state',async()=>{
    loader().mockRejectedValueOnce(issue()).mockResolvedValueOnce([]);render(panel());
    fireEvent.click(await screen.findByRole('button',{name:'Reintentar'}));
    await screen.findByText('No hay rubros disponibles por el momento.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(loader()).toHaveBeenCalledTimes(2);expect(chatLogic.handleSend).not.toHaveBeenCalled();
  });

  it('keeps a genuine empty200 distinct from failure without retrying it',async()=>{
    loader().mockResolvedValue([]);render(panel());
    await screen.findByText('No hay rubros disponibles por el momento.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Reintentar'})).not.toBeInTheDocument();
    expect(loader()).toHaveBeenCalledTimes(1);
  });

  it('loads once for each new organization boundary, including A to B to A',async()=>{
    chatLogic.uxContext={visibility_rules:{show_rubro_selector:true}};
    loader().mockResolvedValue([]);
    const scoped=(slug:string)=><ChatPanel tipoChat="pyme" mode="script" tenantSlug={slug}/>;
    const view=render(scoped('qa-a'));await screen.findByText('No hay rubros disponibles por el momento.');
    view.rerender(scoped('qa-a'));await settle();expect(loader()).toHaveBeenCalledTimes(1);
    view.rerender(scoped('qa-b'));await settle();expect(loader()).toHaveBeenCalledTimes(2);
    view.rerender(scoped('qa-a'));await settle();expect(loader()).toHaveBeenCalledTimes(3);
    expect(screen.getByText('No hay rubros disponibles por el momento.')).toBeVisible();
  });

  it('re-enables the loader after a real disable and re-enable',async()=>{
    loader().mockResolvedValue([]);const view=render(panel());await settle();
    expect(loader()).toHaveBeenCalledTimes(1);
    view.rerender(<ChatPanel tipoChat="municipio" mode="script"/>);await settle();
    expect(loader()).toHaveBeenCalledTimes(1);
    view.rerender(panel());await settle();expect(loader()).toHaveBeenCalledTimes(2);
    expect(screen.getByText('No hay rubros disponibles por el momento.')).toBeVisible();
  });

  it('retires an old empty result rather than removing the active organization failure',async()=>{
    chatLogic.uxContext={visibility_rules:{show_rubro_selector:true}};
    let release:(value:[])=>void=()=>{};
    loader().mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockRejectedValueOnce(issue(503,'current-b'));
    const view=render(<ChatPanel tipoChat="pyme" mode="script" tenantSlug="qa-a"/>);await settle();
    view.rerender(<ChatPanel tipoChat="pyme" mode="script" tenantSlug="qa-b"/>);await screen.findByRole('alert');
    await act(async()=>release([]));await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('no está disponible');
    expect(screen.getByText('current-b')).toBeInTheDocument();
    expect(screen.queryByText('No hay rubros disponibles por el momento.')).not.toBeInTheDocument();
  });

  it('retires an old failure rather than replacing the active empty result',async()=>{
    chatLogic.uxContext={visibility_rules:{show_rubro_selector:true}};
    let reject:(value:unknown)=>void=()=>{};
    loader().mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;})).mockResolvedValueOnce([]);
    const view=render(<ChatPanel tipoChat="pyme" mode="script" tenantSlug="qa-a"/>);await settle();
    view.rerender(<ChatPanel tipoChat="pyme" mode="script" tenantSlug="qa-b"/>);await screen.findByText('No hay rubros disponibles por el momento.');
    await act(async()=>reject(issue(503,'retired-a')));await settle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(loader()).toHaveBeenCalledTimes(2);
  });

  it('requests a fresh result on session revision without reviving the previous error',async()=>{
    loader().mockRejectedValueOnce(issue()).mockResolvedValueOnce([]);render(panel());await screen.findByRole('alert');
    act(()=>{advanceChatbocSessionRevision();});await screen.findByText('No hay rubros disponibles por el momento.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(loader()).toHaveBeenCalledTimes(2);
  });

  it('ignores a delayed failure after unmount without starting another load',async()=>{
    let reject:(value:unknown)=>void=()=>{};
    loader().mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;}));
    const view=render(panel());await settle();view.unmount();
    await act(async()=>reject(issue(503)));await settle();expect(loader()).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retires the initial pending A result after A to B to A while the new A fails',async()=>{
    chatLogic.uxContext={visibility_rules:{show_rubro_selector:true}};
    let release:(value:[])=>void=()=>{};
    loader().mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}))
      .mockResolvedValueOnce([]).mockRejectedValueOnce(issue(503,'current-new-a'));
    const scoped=(slug:string)=><ChatPanel tipoChat="pyme" mode="script" tenantSlug={slug}/>;
    const view=render(scoped('qa-a'));await settle();view.rerender(scoped('qa-b'));await settle();
    view.rerender(scoped('qa-a'));await screen.findByRole('alert');
    await act(async()=>release([]));await settle();
    expect(screen.getByText('current-new-a')).toBeInTheDocument();
    expect(screen.queryByText('No hay rubros disponibles por el momento.')).not.toBeInTheDocument();
    expect(loader()).toHaveBeenCalledTimes(3);
  });

  it('retires a pending result on session revision rather than replacing the new empty result',async()=>{
    let reject:(value:unknown)=>void=()=>{};
    loader().mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;})).mockResolvedValueOnce([]);
    render(panel());await settle();act(()=>{advanceChatbocSessionRevision();});
    await screen.findByText('No hay rubros disponibles por el momento.');
    await act(async()=>reject(issue(503,'retired-session')));await settle();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(loader()).toHaveBeenCalledTimes(2);
  });
});
