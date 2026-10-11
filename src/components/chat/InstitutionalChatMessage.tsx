import React,{useEffect,useRef,useState} from 'react';
import type {SendPayload} from '@/types/chat';
import {institutionalChoiceLabel,institutionalChatActions,type InstitutionalChatMessage as InstitutionalMessage} from '@/features/chat/institutionalChatMessage';
import {KnowledgeSourceMetadata} from '@/components/knowledge/InstitutionalAssistantSourceMetadata';
import {InstitutionalTextBlocks} from '@/components/knowledge/InstitutionalTextBlocks';
import {InstitutionalChoices} from '@/components/knowledge/InstitutionalChoices';
import {InstitutionalResponseAudio,stopInstitutionalReading} from '@/components/knowledge/InstitutionalResponseAudio';
import {knowledgeSourceExternalUrl} from '@/components/knowledge/institutionalAssistantContract';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent,subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import './institutionalChatMessage.css';

/** The ordinary embedded chat uses this reader only for a validated institutional response. */
const InstitutionalChatMessage=React.forwardRef<HTMLDivElement,{answer:InstitutionalMessage;onButtonClick:(value:SendPayload)=>void}>(
 ({answer,onButtonClick},ref)=>{
  const [large,setLarge]=useState(false),heading=useRef<HTMLHeadingElement>(null);
  const scope=JSON.stringify([answer.tenant.id,answer.tenant.slug,answer.revision]);
  const requestFocus=useRef<{answer:InstitutionalMessage;scope:string;target:string;origin:HTMLButtonElement;owned:boolean;fromBody:boolean;retiring:boolean;moved:boolean;session:number}|null>(null);
  useEffect(()=>{
   const trackFocus=(event:FocusEvent)=>{
    const request=requestFocus.current;
    if(request&&event.target!==request.origin&&event.target!==document.body)request.moved=true;
   };
   const trackBlur=(event:FocusEvent)=>{
    const request=requestFocus.current;
    if(request&&event.target===request.origin&&request.origin.isConnected&&
     !(request.retiring&&event.relatedTarget===null&&document.activeElement===document.body))request.moved=true;
   };
   const unsubscribe=subscribeChatbocSessionRevision(()=>{requestFocus.current=null;});
   document.addEventListener('focusin',trackFocus);document.addEventListener('focusout',trackBlur);
   return()=>{requestFocus.current=null;unsubscribe();document.removeEventListener('focusin',trackFocus);document.removeEventListener('focusout',trackBlur);};
  },[]);
  useEffect(()=>{
   stopInstitutionalReading();
  },[answer.revision,answer.nodes.map(node=>node.id).join(':')]);
  useEffect(()=>{
   const request=requestFocus.current;
   if(!request)return;
   if(request.answer===answer&&request.scope===scope)return;
   requestFocus.current=null;
   // Only an activation in this reader owns its response. A newly mounted card
   // cannot infer another card's request from a document-wide focus attribute.
   if(request.scope!==scope||request.answer===answer||!request.owned||request.moved||!isChatbocSessionRevisionCurrent(request.session)||
    !answer.nodes.some(node=>node.id===request.target))return;
   const focused=document.activeElement;
   if(focused===request.origin||(focused===document.body&&(request.fromBody||!request.origin.isConnected)))heading.current?.focus({preventScroll:true});
  },[answer,scope]);
  const actions=institutionalChatActions(answer.nodes);
  return <div ref={ref} className={`institutional-chat-message${large?' institutional-chat-message--large':''}`} data-testid="institutional-chat-message">
   <button type="button" className="institutional-chat-message__text-size" aria-pressed={large} onClick={()=>setLarge(value=>!value)}>{answer.ui?.large_text??'Texto más grande'}</button>
   {answer.nodes.map((node,index)=><article key={node.id}>
    <h3 ref={index===0?heading:undefined} tabIndex={-1}>{node.title}</h3>
    <div className="institutional-chat-message__prose"><InstitutionalTextBlocks text={node.text}/></div>
    {node.links.length?<div className="institutional-chat-message__links">{node.links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</div>:null}
    <details className="institutional-chat-message__sources"><summary>{answer.ui?.source_details??'Fuentes y revisión'}</summary>{node.sources.map(source=><section key={source.id}>
     <h4>{source.title}</h4><KnowledgeSourceMetadata source={source} mode="public"/>
     {knowledgeSourceExternalUrl(source,'public')?<a href={knowledgeSourceExternalUrl(source,'public')!} target="_blank" rel="noopener noreferrer">Referencia externa: {source.title}</a>:null}
    </section>)}</details>
   </article>)}
   {answer.audioReading?<InstitutionalResponseAudio scope={{tenant:answer.tenant,revision:answer.revision,nodeIds:answer.nodes.map(node=>node.id)}} copy={answer.audioReading}/>:null}
   <InstitutionalChoices actions={actions} navigation={answer.ui??null} responseIdentity={answer} className="institutional-chat-message__choices" renderChoice={action=>{
    const label=institutionalChoiceLabel(action.label),actionId=`knowledge:${answer.revision.slice(0,16)}:${action.target}`;
    let renderedButton:HTMLButtonElement|null=null;
    return <button key={`${action.target}:${action.label}`} type="button" data-institutional-choice ref={element=>{
     const request=requestFocus.current;
     // React clears the ref before Chromium blurs a removed focused button.
     // A still-mounted ref replacement clears the marker on reattachment.
     if(!element&&request?.origin===renderedButton&&request.owned&&!request.moved&&document.activeElement===renderedButton)request.retiring=true;
     if(element&&request?.origin===element)request.retiring=false;
     renderedButton=element;
    }}
     onClick={event=>{
      const origin=event.currentTarget,focused=document.activeElement;
      requestFocus.current={answer,scope,target:action.target,origin,owned:focused===origin||focused===document.body,fromBody:focused===document.body,retiring:false,moved:false,session:captureChatbocSessionRevision()};
      stopInstitutionalReading();onButtonClick({text:action.label,action:actionId,action_id:actionId,source:'button'});
     }}>
     <span className="inline-flex min-w-[1.5em] shrink-0 justify-center font-semibold tabular-nums">{action.code}</span>
     {label.emoji?<span aria-hidden="true">{label.emoji}</span>:null}<span>{label.words}</span>
    </button>;
   }}/>
  </div>;
 });
InstitutionalChatMessage.displayName='InstitutionalChatMessage';
export default InstitutionalChatMessage;
