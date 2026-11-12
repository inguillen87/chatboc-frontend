import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import type {Message, SendPayload} from '@/types/chat';
import {isKnowledgeNode} from '@/components/knowledge/institutionalAssistantContract';
import {institutionalChatActions} from '@/features/chat/institutionalChatMessage';
import {captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';

/** A later error, ordinary reply or pending user turn cannot revive an old menu. */
export function currentInstitutionalMenu(messages: Message[], slug: string | null | undefined): Message | null {
  const latest=messages.at(-1), answer=latest?.institutional;
  return latest?.isBot && !latest.isError && answer && slug && answer.tenant.slug===slug &&
    Number.isSafeInteger(answer.tenant.id) && answer.tenant.id>0 && /^[a-f0-9]{64}$/.test(answer.revision) &&
    answer.nodes.length>0 && answer.nodes.length<=3 && answer.nodes.every(isKnowledgeNode) ? latest : null;
}

type Navigation = {
  scope:string; source:Message; target:string; session:number; priorIds:Set<Message['id']>;
  origin:HTMLButtonElement|null; ownsFocus:boolean; settled:boolean; cleanup:()=>void;
  replyId:Message['id']|null;
};

/** Focus belongs to one explicit canonical activation, never merely to a new card. */
export function useInstitutionalMenuNavigation({messages,tenantSlug,scope,busy,send,container,anchor}: {
  messages:Message[];tenantSlug:string|null|undefined;scope:string;busy:boolean;
  send:(payload:SendPayload,callbacks?:{onInstitutionalResponse?:(id:Message['id'])=>void})=>void|Promise<unknown>;
  container:RefObject<HTMLDivElement>;anchor:RefObject<HTMLDivElement>;
}) {
  const revoked=useRef(new WeakSet<Message>());
  const previous=useRef({messages,scope});
  if(previous.current.scope!==scope)previous.current.messages.forEach(message=>revoked.current.add(message));
  previous.current={messages,scope};
  const candidate=currentInstitutionalMenu(messages,tenantSlug);
  const latest=candidate&&!revoked.current.has(candidate)?candidate:null;
  const live=useRef({messages,latest,scope,busy,send}); live.current={messages,latest,scope,busy,send};
  const pending=useRef<Navigation|null>(null), anchoredResponse=useRef<Message['id']|null>(null);
  const scrollBarrier=useRef<Navigation|null>(null);
  const [completed,setCompleted]=useState(0);
  const retire=()=>{const old=pending.current;pending.current=null;old?.cleanup();};

  useLayoutEffect(()=>{
    const unsubscribe=subscribeChatbocSessionRevision(()=>{
      live.current.messages.forEach(message=>revoked.current.add(message));
      live.current.latest=null;retire();anchoredResponse.current=null;scrollBarrier.current=null;
      setCompleted(value=>value+1);
    });
    return()=>{unsubscribe();retire();anchoredResponse.current=null;scrollBarrier.current=null;};
  },[]);
  useLayoutEffect(()=>{retire();anchoredResponse.current=null;scrollBarrier.current=null;},[scope]);

  useLayoutEffect(()=>{
    const request=pending.current;
    if(!request)return;
    if(request.scope!==scope||!isChatbocSessionRevisionCurrent(request.session)){retire();return;}
    if(!request.settled)return;
    if(request.replyId===null){retire();return;}
    if(!messages.some(message=>message.id===request.replyId))return;
    if(!request.ownsFocus||!request.origin){retire();return;}
    const answer=latest?.institutional;
    if(!latest||latest.id!==request.replyId||!answer||request.priorIds.has(latest.id)||
      answer.tenant.id!==request.source.institutional!.tenant.id||
      answer.revision!==request.source.institutional!.revision||answer.nodes[0]?.id!==request.target){retire();return;}
    const focused=document.activeElement;
    // Only native retirement/disable of our origin may leave an owned BODY.
    if(focused!==request.origin&&!(focused===document.body&&(!request.origin.isConnected||request.origin.disabled))){retire();return;}
    const heading=anchor.current?.querySelector<HTMLHeadingElement>('h3');
    const pane=container.current;
    if(!heading?.isConnected||!pane?.contains(heading)){retire();return;}
    heading.focus({preventScroll:true});
    if(document.activeElement===heading){
      pane.scrollTop+=heading.getBoundingClientRect().top-pane.getBoundingClientRect().top;
      anchoredResponse.current=latest.id;
    }
    retire();
  },[messages,latest,scope,completed,anchor,container]);

  const activate=(message:Message,payload:SendPayload)=>{
    const state=live.current, answer=message.institutional;
    if(!answer){if(!pending.current)scrollBarrier.current=null;void state.send(payload);return;}
    if(state.busy||pending.current||state.latest!==message)return;
    const action=institutionalChatActions(answer.nodes).find(item=>
      payload.action_id===`knowledge:${answer.revision.slice(0,16)}:${item.target}`&&payload.text===item.label);
    if(!action)return;
    const origin=document.activeElement;
    anchoredResponse.current=null;
    const owned=origin instanceof HTMLButtonElement&&origin.hasAttribute('data-institutional-choice')&&
      Boolean(anchor.current?.contains(origin)&&container.current?.contains(origin));
    const request:Navigation={scope:state.scope,source:message,target:action.target,
      session:captureChatbocSessionRevision(),priorIds:new Set(state.messages.map(item=>item.id)),
      origin:owned?origin:null,ownsFocus:owned,settled:false,replyId:null,cleanup:()=>{}};
    pending.current=request;
    scrollBarrier.current=request;
    if(owned){
      const moved=()=>{if(pending.current===request){request.ownsFocus=false;request.cleanup();}};
      const focus=(event:FocusEvent)=>{if(event.target!==origin&&event.target!==document.body)moved();};
      const blur=(event:FocusEvent)=>{
        if(event.target===origin&&!(event.relatedTarget===null&&(!origin.isConnected||origin.disabled)))moved();
      };
      const keyboard=(event:KeyboardEvent)=>{if(['Tab','Escape','PageDown','PageUp','Home','End','ArrowDown','ArrowUp'].includes(event.key))moved();};
      document.addEventListener('focusin',focus);document.addEventListener('focusout',blur);
      document.addEventListener('pointerdown',moved,true);document.addEventListener('keydown',keyboard,true);
      document.addEventListener('wheel',moved,{capture:true,passive:true});
      request.cleanup=()=>{
        document.removeEventListener('focusin',focus);document.removeEventListener('focusout',blur);
        document.removeEventListener('pointerdown',moved,true);document.removeEventListener('keydown',keyboard,true);
        document.removeEventListener('wheel',moved,true);
      };
    }
    let result:void|Promise<unknown>;
    try{result=state.send(payload,{onInstitutionalResponse:id=>{
      if(pending.current===request&&live.current.scope===request.scope&&isChatbocSessionRevisionCurrent(request.session))request.replyId=id;
    }});}catch{retire();return;}
    void Promise.resolve(result).then(()=>{
      if(request&&pending.current===request&&live.current.scope===request.scope&&isChatbocSessionRevisionCurrent(request.session)){
        request.settled=true;setCompleted(value=>value+1);
      }
    },()=>{if(pending.current===request)retire();});
  };
  const suppressAutoScroll=(scheduledMessages:Message[])=>{
    const barrier=scrollBarrier.current,last=scheduledMessages.at(-1);
    if(!barrier||barrier.scope!==live.current.scope||!isChatbocSessionRevisionCurrent(barrier.session))return false;
    const sourceIndex=scheduledMessages.findIndex(message=>message.id===barrier.source.id);
    // An error or generic reply has no institutional correlation callback. Keep
    // the visitor's abandoned reading position for this one visible user turn;
    // the next user turn restores the ordinary scrolling policy.
    const abandonedTurn=sourceIndex>=0&&!barrier.ownsFocus&&last?.isBot&&
      scheduledMessages.slice(sourceIndex+1).filter(message=>!message.isBot).length===1;
    return Boolean(pending.current===barrier||last?.id===barrier.source.id||last?.id===barrier.replyId||abandonedTurn);
  };
  return {activeMessage:latest,activate,anchoredResponse,suppressAutoScroll};
}
