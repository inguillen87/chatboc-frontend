import React,{useRef} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {currentInstitutionalMenu,useInstitutionalMenuNavigation} from './useInstitutionalMenuNavigation';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {node,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import type {Message,SendPayload} from '@/types/chat';
import InstitutionalChatMessage from './InstitutionalChatMessage';

const bot=(id:Message['id'],target='start'):Message=>{
  const w=workspace(),n=node(target);
  return {id,text:n.text,isBot:true,timestamp:new Date(0),institutional:{tenant:w.tenant,
    revision:w.revision!,nodes:[n],sources:n.sources}};
};
const initial=()=>bot(1), response=()=>bot(2,'requirements');
const user:Message={id:'user',text:'Consultar requisitos',isBot:false,timestamp:new Date(0)};
const payload:SendPayload={text:'Consultar requisitos',action_id:'knowledge:bbbbbbbbbbbbbbbb:requirements',source:'button'};
const deferred=()=>{let resolve!:()=>void,reject!:(value:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

type LocalCallbacks={onInstitutionalResponse?:(id:Message['id'])=>void};
function Harness({messages,send,busy=false,scope='conversation-a',slug='qa-knowledge'}:{messages:Message[];send:(p:SendPayload,c?:LocalCallbacks)=>Promise<unknown>;busy?:boolean;scope?:string;slug?:string}){
  const pane=useRef<HTMLDivElement>(null),anchor=useRef<HTMLDivElement>(null);
  const navigation=useInstitutionalMenuNavigation({messages,tenantSlug:slug,scope,busy,send,container:pane,anchor});
  return <><input aria-label="Otra tarea"/><button data-institutional-choice onClick={()=>navigation.activate(messages[0],payload)}>Otro widget</button>
    <output data-testid="scroll-block">{String(navigation.suppressAutoScroll(messages))}</output><div ref={pane} data-testid="pane">{messages.map(message=>message.institutional?
    <InstitutionalChatMessage key={message.id} ref={navigation.activeMessage===message?anchor:undefined}
      answer={message.institutional} interactive={navigation.activeMessage===message&&!busy}
      onButtonClick={value=>navigation.activate(message,value)}/>:<p key={message.id}>{message.text}</p>)}</div>
    <button onClick={()=>{navigation.activate(messages[0],payload);navigation.activate(messages[0],payload);}}>Activar dos veces sin foco</button>
    <button onClick={()=>navigation.activate(user,{text:'Control genérico',source:'button'})}>Control genérico</button></>;
}
afterEach(cleanup);

describe('institutional menu ownership and reply focus',()=>{
  it('retires a historical menu while retaining its content and the current actions',()=>{
    const first=initial(),last=response();render(<Harness messages={[first,user,last]} send={vi.fn()}/>);
    expect(screen.getByRole('button',{name:/Consultar requisitos/})).toBeDisabled();
    expect(screen.getByRole('button',{name:/Volver al menú/})).toBeEnabled();
    expect(screen.getByText(first.text)).toBeDefined();
  });
  it.each(['pending','error','ordinary','foreign','invalid'])('does not revive historical choices behind %s',kind=>{
    const latest=kind==='pending'?user:kind==='error'?{...response(),isError:true}:
      kind==='ordinary'?{...response(),institutional:undefined}:kind==='foreign'?
        {...response(),institutional:{...response().institutional!,tenant:{id:702,slug:'other'}}}:
        {...response(),institutional:{...response().institutional!,revision:'invalid'}};
    expect(currentInstitutionalMenu([initial(),latest],'qa-knowledge')).toBeNull();
  });
  it('keeps actions unavailable while a response is pending',()=>{
    render(<Harness messages={[initial()]} send={vi.fn()} busy/>);
    expect(screen.getByRole('button',{name:/Consultar requisitos/})).toBeDisabled();
  });
  it('focuses the matching new response after this request settles, not before',async()=>{
    const first=initial(),next=response(),request=deferred(),send=vi.fn((_p:SendPayload,c?:LocalCallbacks)=>{c?.onInstitutionalResponse?.(2);return request.promise;});
    const view=render(<Harness messages={[first]} send={send}/>),origin=screen.getByRole('button',{name:/Consultar requisitos/});
    origin.focus();fireEvent.click(origin);
    view.rerender(<Harness messages={[first,user,next]} send={send}/>);
    expect(screen.getByRole('heading',{name:next.institutional!.nodes[0].title})).not.toHaveFocus();
    await act(async()=>{request.resolve();await request.promise;});
    expect(screen.getByRole('heading',{name:next.institutional!.nodes[0].title})).toHaveFocus();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('waits for mounting after the exact reply ID has already been confirmed',async()=>{
    const first=initial(),request=deferred(),send=vi.fn((_p:SendPayload,c?:LocalCallbacks)=>{c?.onInstitutionalResponse?.(2);return request.promise;});
    const view=render(<Harness messages={[first]} send={send}/>),origin=screen.getByRole('button',{name:/Consultar requisitos/});
    origin.focus();fireEvent.click(origin);
    await act(async()=>{request.resolve();await request.promise;});
    expect(origin).toHaveFocus();
    view.rerender(<Harness messages={[first,user,response()]} send={send}/>);
    expect(screen.getByRole('heading',{name:response().institutional!.nodes[0].title})).toHaveFocus();
  });
  it('does not confuse another response with the same tenant, revision and target for this turn',async()=>{
    const first=initial(),request=deferred(),send=vi.fn((_p:SendPayload,c?:LocalCallbacks)=>{c?.onInstitutionalResponse?.(2);return request.promise;});
    const view=render(<Harness messages={[first]} send={send}/>),origin=screen.getByRole('button',{name:/Consultar requisitos/});
    origin.focus();fireEvent.click(origin);
    view.rerender(<Harness messages={[first,user,bot(3,'requirements')]} send={send}/>);
    await act(async()=>{request.resolve();await request.promise;});
    expect(screen.getByRole('heading',{name:response().institutional!.nodes[0].title})).not.toHaveFocus();
    const own=response();own.institutional!.nodes[0].title='Respuesta de mi turno';
    view.rerender(<Harness messages={[first,user,bot(3,'requirements'),own]} send={send}/>);
    expect(screen.getByRole('heading',{name:'Respuesta de mi turno'})).toHaveFocus();
  });
  it('never guesses reply ownership when the dispatcher does not confirm an institutional ID',async()=>{
    const first=initial(),request=deferred(),send=vi.fn(()=>request.promise);
    const view=render(<Harness messages={[first]} send={send}/>),origin=screen.getByRole('button',{name:/Consultar requisitos/});
    origin.focus();fireEvent.click(origin);
    view.rerender(<Harness messages={[first,user,response()]} send={send}/>);
    await act(async()=>{request.resolve();await request.promise;});
    expect(screen.getByRole('heading',{name:response().institutional!.nodes[0].title})).not.toHaveFocus();
  });
  it.each(['outside','blur','pointer','tab','wheel'])('preserves voluntary %s navigation while the response waits',async kind=>{
    const first=initial(),next=response(),request=deferred(),send=vi.fn((_p:SendPayload,c?:LocalCallbacks)=>{c?.onInstitutionalResponse?.(2);return request.promise;});
    const view=render(<Harness messages={[first]} send={send}/>),origin=screen.getByRole('button',{name:/Consultar requisitos/});
    origin.focus();fireEvent.click(origin);
    if(kind==='outside')screen.getByRole('textbox',{name:'Otra tarea'}).focus();
    if(kind==='blur')origin.blur();
    if(kind==='pointer')fireEvent.pointerDown(document.body);
    if(kind==='tab')fireEvent.keyDown(origin,{key:'Tab'});
    if(kind==='wheel')fireEvent.wheel(screen.getByTestId('pane'));
    view.rerender(<Harness messages={[first,user,next]} send={send}/>);
    await act(async()=>{request.resolve();await request.promise;});
    expect(screen.getByRole('heading',{name:next.institutional!.nodes[0].title})).not.toHaveFocus();
    if(kind==='outside')expect(screen.getByRole('textbox',{name:'Otra tarea'})).toHaveFocus();
  });
  it.each(['scope','aba','session','target','revision','unmount'])('retires response focus on %s',async kind=>{
    const first=initial(),request=deferred(),send=vi.fn((_p:SendPayload,c?:LocalCallbacks)=>{c?.onInstitutionalResponse?.(2);return request.promise;});
    const view=render(<Harness messages={[first]} send={send}/>),origin=screen.getByRole('button',{name:/Consultar requisitos/});
    origin.focus();fireEvent.click(origin);
    if(kind==='aba'){
      view.rerender(<Harness messages={[first]} send={send} scope="conversation-b"/>);
      view.rerender(<Harness messages={[first]} send={send}/>);
    }
    if(kind==='session')act(()=>{advanceChatbocSessionRevision();});
    if(kind==='unmount'){view.unmount();await act(async()=>{request.resolve();await request.promise;});expect(document.activeElement).toBe(document.body);return;}
    const next=kind==='target'?bot(2,'start'):kind==='revision'?
      {...response(),institutional:{...response().institutional!,revision:'c'.repeat(64)}}:response();
    view.rerender(<Harness messages={[first,user,next]} send={send} scope={kind==='scope'?'conversation-b':'conversation-a'}/>);
    await act(async()=>{request.resolve();await request.promise;});
    expect(document.activeElement?.tagName).not.toBe('H3');
  });
  it('deduplicates immediate activations even without an owned focused control',async()=>{
    const request=deferred(),send=vi.fn(()=>request.promise);render(<Harness messages={[initial()]} send={send}/>);
    fireEvent.click(screen.getByRole('button',{name:'Activar dos veces sin foco'}));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async()=>{request.resolve();await request.promise;});
  });
  it('does not attribute a button from another instance to this response',async()=>{
    const first=initial(),request=deferred(),send=vi.fn((_p:SendPayload,c?:LocalCallbacks)=>{c?.onInstitutionalResponse?.(2);return request.promise;});
    const view=render(<Harness messages={[first]} send={send}/>),outside=screen.getByRole('button',{name:'Otro widget'});
    outside.focus();fireEvent.click(outside);
    view.rerender(<Harness messages={[first,user,response()]} send={send}/>);
    await act(async()=>{request.resolve();await request.promise;});
    expect(outside).toHaveFocus();expect(document.activeElement?.tagName).not.toBe('H3');
  });
  it.each(['session','scope'])('retires the displayed menu on %s and accepts a fresh reply',kind=>{
    const first=initial(),send=vi.fn(),view=render(<Harness messages={[first]} send={send}/>);
    if(kind==='session')act(()=>{advanceChatbocSessionRevision();});
    else view.rerender(<Harness messages={[first]} send={send} scope="conversation-b"/>);
    expect(screen.getByRole('button',{name:/Consultar requisitos/})).toBeDisabled();
    const fresh=bot('fresh');view.rerender(<Harness messages={[first,fresh]} send={send} scope={kind==='scope'?'conversation-b':'conversation-a'}/>);
    expect(screen.getAllByRole('button',{name:/Consultar requisitos/})[1]).toBeEnabled();
  });
  it('blocks generic scrolling for an abandoned institutional turn, without blocking a later ordinary turn',async()=>{
    const first=initial(),request=deferred(),send=vi.fn((_p:SendPayload,c?:LocalCallbacks)=>{c?.onInstitutionalResponse?.(2);return request.promise;});
    const view=render(<Harness messages={[first]} send={send}/>),origin=screen.getByRole('button',{name:/Consultar requisitos/});
    origin.focus();fireEvent.click(origin);fireEvent.wheel(screen.getByTestId('pane'));
    view.rerender(<Harness messages={[first,user,response()]} send={send}/>);
    await act(async()=>{request.resolve();await request.promise;});
    expect(screen.getByTestId('scroll-block')).toHaveTextContent('true');
    view.rerender(<Harness messages={[first,user,response(),{...user,id:'later'}]} send={send}/>);
    expect(screen.getByTestId('scroll-block')).toHaveTextContent('false');
  });
  it('retains the scroll barrier when a generic control is ignored during the pending institutional turn',async()=>{
    const first=initial(),request=deferred(),send=vi.fn((p:SendPayload,c?:LocalCallbacks)=>{
      if(p.text==='Control genérico')return Promise.resolve();
      c?.onInstitutionalResponse?.(2);return request.promise;
    });
    const view=render(<Harness messages={[first]} send={send}/>);
    const origin=screen.getByRole('button',{name:/Consultar requisitos/});origin.focus();fireEvent.click(origin);
    fireEvent.click(screen.getByRole('button',{name:'Control genérico'}));
    view.rerender(<Harness messages={[first,user,response()]} send={send}/>);
    await act(async()=>{request.resolve();await request.promise;});
    expect(screen.getByTestId('scroll-block')).toHaveTextContent('true');
  });
  it.each(['error','ordinary'])('preserves abandoned reading when this turn ends with an %s reply',async kind=>{
    const first=initial(),request=deferred(),send=vi.fn(()=>request.promise);
    const view=render(<Harness messages={[first]} send={send}/>);
    const origin=screen.getByRole('button',{name:/Consultar requisitos/});origin.focus();fireEvent.click(origin);
    fireEvent.wheel(screen.getByTestId('pane'));
    const next={...response(),institutional:undefined,isError:kind==='error',text:'Resultado sin menú'};
    view.rerender(<Harness messages={[first,user,next]} send={send}/>);
    await act(async()=>{request.resolve();await request.promise;});
    // Read the barrier after the layout effect has retired the pending attempt,
    // as the delayed pane timer does (the first render still saw it pending).
    view.rerender(<Harness messages={[first,user,next]} send={send}/>);
    expect(screen.getByTestId('scroll-block')).toHaveTextContent('true');
    view.rerender(<Harness messages={[first,user,next,{...user,id:'later'}]} send={send}/>);
    expect(screen.getByTestId('scroll-block')).toHaveTextContent('false');
  });
  it('a rejected dispatch does not steal focus or replay the request',async()=>{
    const request=deferred(),send=vi.fn(()=>request.promise);render(<Harness messages={[initial()]} send={send}/>);
    const origin=screen.getByRole('button',{name:/Consultar requisitos/});origin.focus();fireEvent.click(origin);
    await act(async()=>{request.reject(new Error('transport'));await request.promise.catch(()=>{});});
    expect(origin).toHaveFocus();expect(send).toHaveBeenCalledTimes(1);
  });
});
