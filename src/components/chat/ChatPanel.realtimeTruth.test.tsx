import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/utils/api";
import ChatPanel, { scrollIntoViewIfSupported } from "./ChatPanel";
import type {Message} from '@/types/chat';

const chatLogic = {
  messages: [] as Message[],
  visitorName: null as string | null,
  isTyping: false,
  institutionalBootstrapPending:false,
  suppressLegacyInitialMenu:false,
  handleSend: vi.fn(),
  activeTicketId: null,
  liveChatTicketId: null,
  liveChatSocketRoom: null,
  liveChatAccessToken: null,
  isLiveChatActive: false,
  setMessages: vi.fn(),
  setContexto: vi.fn(),
  setActiveTicketId: vi.fn(),
  contexto: {},
  uxContext: {},
  addSystemMessage: vi.fn(),
  initializeConversation: vi.fn(),
};

const profile = vi.hoisted(() => ({ user: null as {
  name: string; email: string; avatar_url: string; avatar_source: string; avatar_consent: boolean;
} | null }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => profile }));

const provisionedSession = {
  ok: true,
  channel: "voice",
  model: "gpt-realtime",
  session: {
    id: "sess_provisioned_only",
    client_secret: { value: "ephemeral-secret" },
  },
};

vi.mock("@/hooks/useChatLogic", () => ({
  useChatLogic: () => chatLogic,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useBusinessHours", () => ({
  useBusinessHours: () => ({
    isLiveChatEnabled: false,
    horariosAtencion: "",
    availabilityLabel: "",
    timezone: "",
  }),
}));

vi.mock("./ChatHeader", () => ({ default: () => <div data-testid="chat-header" /> }));
vi.mock("./ChatInput", () => ({
  default: React.forwardRef(function TestChatInput(){
    const [draft,setDraft]=React.useState('');
    return <input data-testid="chat-input" aria-label="Borrador de consulta" value={draft} onChange={event=>setDraft(event.target.value)}/>;
  }),
}));
vi.mock("@/components/ui/ScrollToBottomButton", () => ({ default: () => null }));
vi.mock("./RealtimeAvatarStage", () => ({
  default: ({ sessionState }: { sessionState: string }) => (
    <div data-testid="realtime-session-state">{sessionState}</div>
  ),
}));

describe("ChatPanel realtime transport truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatLogic.institutionalBootstrapPending=false;
    chatLogic.suppressLegacyInitialMenu=false;
    chatLogic.messages=[];
    chatLogic.visitorName=null;
    chatLogic.contexto={};
    profile.user=null;
    window.localStorage.clear();window.sessionStorage.clear();
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === "/api/public/realtime/session" ? provisionedSession : {},
    );
  });

  it.each(['iframe','script','standalone'] as const)('keeps the %s visitor bubble generic despite an administrative profile and an unscoped stored name', async (mode) => {
    profile.user={name:'Synthetic panel operator',email:'panel@example.invalid',avatar_url:'https://images.example.invalid/panel.jpg',avatar_source:'google',avatar_consent:true};
    window.localStorage.setItem('user',JSON.stringify(profile.user));
    window.localStorage.setItem('visitor_name','Unscoped prior visitor');
    chatLogic.messages=[{id:'public-question',text:'Consulta del visitante',isBot:false,timestamp:new Date()}];
    const panel=render(<ChatPanel tipoChat="municipio" tenantSlug="qa-visitor" mode={mode}/>);
    await waitFor(()=>expect(screen.getByTitle('Usuario - Avatar generativo por identidad')).toBeVisible());
    expect(screen.queryByTitle(/Synthetic panel operator/)).not.toBeInTheDocument();
    expect(panel.container.querySelector('img[src="https://images.example.invalid/panel.jpg"]')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('user')).toBe(JSON.stringify(profile.user));
    expect(window.localStorage.getItem('visitor_name')).toBe('Unscoped prior visitor');
    expect(chatLogic.handleSend).not.toHaveBeenCalled();
  });

  it('shows only the explicit current visitor name and retires it when switching the widget tenant', async () => {
    profile.user={name:'Synthetic panel operator',email:'panel@example.invalid',avatar_url:'https://images.example.invalid/panel.jpg',avatar_source:'google',avatar_consent:true};
    chatLogic.visitorName='Synthetic visitor';
    chatLogic.messages=[{id:'visitor-question',text:'Consulta del visitante',isBot:false,timestamp:new Date()}];
    const panel=render(<ChatPanel tipoChat="municipio" tenantSlug="qa-visitor" mode="iframe"/>);
    await waitFor(()=>expect(screen.getByTitle('Synthetic visitor - Avatar generativo por identidad')).toBeVisible());
    expect(screen.queryByTitle(/Synthetic panel operator/)).not.toBeInTheDocument();
    chatLogic.visitorName=null;
    panel.rerender(<ChatPanel tipoChat="municipio" tenantSlug="qa-other" mode="iframe"/>);
    expect(screen.getByTitle('Usuario - Avatar generativo por identidad')).toBeVisible();
    expect(screen.queryByTitle(/Synthetic visitor/)).not.toBeInTheDocument();
  });

  it('preserves the private conversation profile and its consented avatar', async () => {
    profile.user={name:'Synthetic panel operator',email:'panel@example.invalid',avatar_url:'https://images.example.invalid/panel.jpg',avatar_source:'google',avatar_consent:true};
    chatLogic.messages=[{id:'private-question',text:'Consulta privada',isBot:false,timestamp:new Date()}];
    render(<ChatPanel tipoChat="municipio" tenantSlug="qa-private"/>);
    await waitFor(()=>expect(screen.getByTitle('Synthetic panel operator - Avatar con imagen consentida (google)')).toBeVisible());
    expect(screen.queryByTitle('Usuario - Avatar generativo por identidad')).not.toBeInTheDocument();
  });

  it('requests visitor details for an explicit public lead CTA instead of taking the administrative profile',()=>{
    window.localStorage.setItem('user',JSON.stringify({name:'Synthetic operator',email:'panel@example.invalid',phone:'999999999'}));
    render(<ChatPanel tipoChat="municipio" tenantSlug="qa-visitor" leadCapture={{enabled:true,endpoint:'/api/public/lead-capture',fields:[]}}
      conversionCtas={{actions:[{id:'visitor-follow-up',label:'Guardar mi seguimiento',endpoint:'/api/public/lead-capture'}]}}/>);
    fireEvent.click(screen.getByRole('button',{name:'Ver acciones'}));
    fireEvent.click(screen.getAllByRole('button',{name:'Guardar mi seguimiento'})
      .find(button=>button.closest('.chatboc-chat-footer'))!);
    expect(vi.mocked(apiFetch).mock.calls.some(([path])=>path==='/api/public/lead-capture')).toBe(false);
    expect(chatLogic.setMessages).toHaveBeenCalled();
    const next=chatLogic.setMessages.mock.calls.at(-1)![0]([]);
    expect(next.at(-1)).toMatchObject({text:'Para guardar el seguimiento, decime tu nombre y un WhatsApp o email.',data:{pedir_info:'nombre'}});
    expect(window.localStorage.getItem('user')).toContain('panel@example.invalid');
  });

  it('keeps an explicit public lead CTA using only the visitor details in the current conversation',async()=>{
    window.localStorage.setItem('user',JSON.stringify({name:'Synthetic operator',email:'panel@example.invalid',phone:'999999999'}));
    chatLogic.contexto={datos_reclamo:{nombre_ciudadano:'Synthetic visitor',email_ciudadano:'visitor@example.invalid',telefono_ciudadano:'111111111'}};
    render(<ChatPanel tipoChat="municipio" tenantSlug="qa-visitor" leadCapture={{enabled:true,endpoint:'/api/public/lead-capture',fields:[]}}
      conversionCtas={{actions:[{id:'visitor-follow-up',label:'Guardar mi seguimiento',endpoint:'/api/public/lead-capture'}]}}/>);
    fireEvent.click(screen.getByRole('button',{name:'Ver acciones'}));
    fireEvent.click(screen.getAllByRole('button',{name:'Guardar mi seguimiento'})
      .find(button=>button.closest('.chatboc-chat-footer'))!);
    await waitFor(()=>expect(apiFetch).toHaveBeenCalledWith('/api/public/lead-capture',expect.objectContaining({method:'POST',
      body:expect.objectContaining({tenant_slug:'qa-visitor',name:'Synthetic visitor',email:'visitor@example.invalid',phone:'111111111'}),
      skipAuth:true})));
    const request=vi.mocked(apiFetch).mock.calls.find(([path])=>path==='/api/public/lead-capture')![1];
    expect(JSON.stringify(request)).not.toContain('panel@example.invalid');
    expect(chatLogic.handleSend).not.toHaveBeenCalled();
  });

  it('shows only pending conversation status while resolving the public institutional menu',()=>{
    chatLogic.institutionalBootstrapPending=true;chatLogic.suppressLegacyInitialMenu=true;
    render(<ChatPanel tipoChat="municipio" tenantSlug="qa-knowledge"
      defaultMenu={[{texto:'Legacy municipal operation',action_id:'crear_reclamo'}]}
      experienceBlueprint={{first_visit:{title:'Legacy welcome shell'}}}/>);
    expect(screen.getByRole('status',{name:'Cargando conversación'})).toBeVisible();
    expect(screen.queryByText('Legacy welcome shell')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Legacy municipal operation'})).not.toBeInTheDocument();
  });

  it('suppresses a duplicate configured municipal menu without concealing a real response error',async()=>{
    chatLogic.suppressLegacyInitialMenu=true;
    chatLogic.messages=[{id:'qa-error',text:'Real quota denial remains visible',isBot:true,isError:true,timestamp:new Date()}];
    render(<ChatPanel tipoChat="municipio" tenantSlug="qa-knowledge"
      defaultMenu={[{texto:'Legacy municipal operation',action_id:'crear_reclamo'}]}/>);
    await waitFor(()=>expect(screen.getByText(/Real quota denial remains visible/)).toBeVisible());
    expect(screen.queryByRole('button',{name:'Legacy municipal operation'})).not.toBeInTheDocument();
  });

  it('retains a typed draft while the institutional bootstrap changes from pending to a response',()=>{
    chatLogic.institutionalBootstrapPending=true;chatLogic.suppressLegacyInitialMenu=true;
    const panel=render(<ChatPanel tipoChat="municipio" tenantSlug="qa-knowledge"/>);
    fireEvent.change(screen.getByRole('textbox',{name:'Borrador de consulta'}),{target:{value:'Consulta todavía sin enviar'}});
    chatLogic.institutionalBootstrapPending=false;
    chatLogic.messages=[{id:'loaded-menu',text:'Menú recibido del backend',isBot:true,timestamp:new Date()}];
    panel.rerender(<ChatPanel tipoChat="municipio" tenantSlug="qa-knowledge"/>);
    expect(screen.getByRole('textbox',{name:'Borrador de consulta'})).toHaveValue('Consulta todavía sin enviar');
  });

  it('retains the backend configured welcome and actions when no institutional corpus is published',()=>{
    render(<ChatPanel tipoChat="municipio" tenantSlug="qa-legacy"
      defaultMenu={[{texto:'Legacy municipal operation',action_id:'crear_reclamo'}]}
      experienceBlueprint={{first_visit:{title:'Legacy welcome shell'}}}/>);
    expect(screen.getByText('Legacy welcome shell')).toBeVisible();
    expect(screen.getByRole('button',{name:'Legacy municipal operation'})).toBeVisible();
  });

  it("degrades auto-scroll safely when the rendered element has no scrollIntoView implementation", () => {
    const element = document.createElement("div");
    Object.defineProperty(element, "scrollIntoView", {
      configurable: true,
      value: undefined,
    });

    expect(scrollIntoViewIfSupported(element, { behavior: "auto", block: "end" })).toBe(false);
  });

  it("does not conceal errors thrown by a real scrollIntoView implementation", () => {
    const element = document.createElement("div");
    const scrollFailure = new Error("scroll implementation failed");
    Object.defineProperty(element, "scrollIntoView", {
      configurable: true,
      value: vi.fn(() => {
        throw scrollFailure;
      }),
    });

    expect(() => scrollIntoViewIfSupported(element, { behavior: "auto", block: "end" })).toThrow(scrollFailure);
  });

  it("does not announce a provisioned client secret as a live call", async () => {
    render(
      <ChatPanel
        tipoChat="pyme"
        tenantSlug="empresa-demo"
        supportChannels={{
          voice_call: {
            enabled: true,
            label: "Llamada IA",
            session_endpoint: "/api/public/realtime/session",
          },
        }}
        realtimeVoice={{
          enabled: true,
          contract_version: "realtime.voice_capabilities.v1",
          recommended_model: "gpt-realtime",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver acciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Llamada IA" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/public/realtime/session",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(await screen.findByTestId("realtime-session-state")).toHaveTextContent("ended");
    expect(
      screen.getAllByText("La llamada no se conectó. Podés seguir por chat.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Escuchando")).not.toBeInTheDocument();
  });

  it("announces live only after the transport connector returns duplex live audio", async () => {
    const close = vi.fn();
    const connectRealtimeVoiceTransport = vi.fn().mockResolvedValue({
      connectionState: "connected",
      getSenders: () => [{ track: { kind: "audio", readyState: "live" } }],
      getReceivers: () => [{ track: { kind: "audio", readyState: "live" } }],
      close,
    });

    render(
      <ChatPanel
        tipoChat="pyme"
        tenantSlug="empresa-demo"
        connectRealtimeVoiceTransport={connectRealtimeVoiceTransport}
        supportChannels={{
          voice_call: {
            enabled: true,
            label: "Llamada IA",
            session_endpoint: "/api/public/realtime/session",
          },
        }}
        realtimeVoice={{
          enabled: true,
          contract_version: "realtime.voice_capabilities.v1",
          recommended_model: "gpt-realtime",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver acciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Llamada IA" }));

    await waitFor(() => {
      expect(connectRealtimeVoiceTransport).toHaveBeenCalledWith(provisionedSession);
      expect(screen.getByTestId("realtime-session-state")).toHaveTextContent("live");
    });
    expect(screen.queryByText("La llamada no se conectó. Podés seguir por chat.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finalizar" }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
