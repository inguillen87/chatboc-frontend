import React from 'react';
import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import ChatPanel from './ChatPanel';
import type {RenderBrandAvatar} from './BrandBotAvatar';

// Real mounted panel with controlled chat seams: no request leaves this fixture.
vi.mock('@/api/rubros', () => ({getRubrosHierarchy:vi.fn(async()=>[])}));
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

const settle=()=>act(async()=>{for(let i=0;i<20;i++)await Promise.resolve();});
const mascot=vi.fn<RenderBrandAvatar>((state,size)=><svg data-testid={`mascot-${state}`} width={size}/>);

beforeEach(()=>{
  vi.clearAllMocks();window.localStorage.clear();window.sessionStorage.clear();
  chatLogic.institutionalBootstrapPending=false;
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('No network allowed in this fixture');}));
  vi.spyOn(console,'error').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('panel with a published brand identity',()=>{
  it('marks the «globa» bubble shape and greets with the mascot',async()=>{
    render(<ChatPanel tipoChat="municipio" mode="standalone" bubbleStyle="globa" renderBrandAvatar={mascot}/>);
    await settle();
    expect(screen.getByRole('region',{name:'Chat widget'})).toHaveAttribute('data-bubble-style','globa');
    expect(screen.getByTestId('chat-empty-brand-avatar')).toContainElement(screen.getByTestId('mascot-idle'));
  });

  it('thinks with the mascot while the institutional conversation loads',async()=>{
    chatLogic.institutionalBootstrapPending=true;
    render(<ChatPanel tipoChat="municipio" mode="standalone" renderBrandAvatar={mascot}/>);
    await settle();
    const status=screen.getByRole('status',{name:'Cargando conversación'});
    expect(status).toContainElement(screen.getByTestId('mascot-thinking'));
  });

  it('keeps the default shape and icons without an identity',async()=>{
    render(<ChatPanel tipoChat="municipio" mode="standalone"/>);
    await settle();
    expect(screen.getByRole('region',{name:'Chat widget'})).not.toHaveAttribute('data-bubble-style');
    expect(screen.queryByTestId('chat-empty-brand-avatar')).toBeNull();
    expect(mascot).not.toHaveBeenCalled();
  });
});
