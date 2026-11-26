import React,{useEffect,useRef,useState} from 'react';
import {Share2} from 'lucide-react';
import type {SendPayload} from '@/types/chat';
import {institutionalChoiceLabel,institutionalChatActions,institutionalPresentationMode,isInstitutionalSourceNavigationMessage,type InstitutionalChatMessage as InstitutionalMessage,type InstitutionalCanonicalChatMessage as CanonicalMessage,type InstitutionalSourceNavigationMessage} from '@/features/chat/institutionalChatMessage';
import {KnowledgeSourceMetadata} from '@/components/knowledge/InstitutionalAssistantSourceMetadata';
import {InstitutionalAcronyms,InstitutionalTextBlocks,buildInstitutionalPortalUrl,buildInstitutionalWhatsAppUrl,openInstitutionalWhatsAppShare,readInstitutionalLargeText,rememberInstitutionalLargeText,resolveInstitutionalShareLabels} from '@/components/knowledge/InstitutionalTextBlocks';
import {InstitutionalChoices} from '@/components/knowledge/InstitutionalChoices';
import {InstitutionalResponseAudio,stopInstitutionalReading} from '@/components/knowledge/InstitutionalResponseAudio';
import {InstitutionalEasyRead} from '@/components/knowledge/InstitutionalEasyRead';
import {knowledgeSourceExternalUrl,readKnowledgeAcronyms} from '@/components/knowledge/institutionalAssistantContract';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent,subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import './institutionalChatMessage.css';

/** The ordinary embedded chat uses this reader only for a validated institutional response. */
const CanonicalInstitutionalChatMessage=React.forwardRef<HTMLDivElement,{answer:CanonicalMessage;onButtonClick:(value:SendPayload)=>void;interactive?:boolean}>(
 ({answer,onButtonClick,interactive=true},ref)=>{
  const [large,setLarge]=useState(readInstitutionalLargeText),heading=useRef<HTMLHeadingElement>(null);
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
  const presentation=institutionalPresentationMode(answer,answer.initialMenu),initialMenu=presentation==='initial-menu';
  const shareLabels=resolveInstitutionalShareLabels(answer.ui);
  const choices=<InstitutionalChoices actions={actions} navigation={answer.ui??null} responseIdentity={answer} disabled={!interactive} className="institutional-chat-message__choices" renderChoice={action=>{
    const label=institutionalChoiceLabel(action.label),actionId=`knowledge:${answer.revision.slice(0,16)}:${action.target}`;
    let renderedButton:HTMLButtonElement|null=null;
    return <button key={`${action.target}:${action.label}`} type="button" disabled={!interactive} data-institutional-choice ref={element=>{
     const request=requestFocus.current;
     // React clears the ref before Chromium blurs a removed focused button.
     // A still-mounted ref replacement clears the marker on reattachment.
     if(!element&&request?.origin===renderedButton&&request.owned&&!request.moved&&document.activeElement===renderedButton)request.retiring=true;
     if(element&&request?.origin===element)request.retiring=false;
     renderedButton=element;
    }}
     onClick={event=>{
      if(!interactive)return;
      const origin=event.currentTarget,focused=document.activeElement;
      requestFocus.current={answer,scope,target:action.target,origin,owned:focused===origin||focused===document.body,fromBody:focused===document.body,retiring:false,moved:false,session:captureChatbocSessionRevision()};
      stopInstitutionalReading();onButtonClick({text:action.label,action:actionId,action_id:actionId,source:'button'});
     }}>
     <span className="inline-flex min-w-[1.5em] shrink-0 justify-center font-semibold tabular-nums">{action.code}</span>
     {' '}{label.emoji?<><span aria-hidden="true">{label.emoji}</span>{' '}</>:null}<span>{label.words}</span>
    </button>;
   }}/>;
  return <div ref={ref} className={`institutional-chat-message${large?' institutional-chat-message--large':''}${initialMenu?' institutional-chat-message--initial-menu':''}`} data-testid="institutional-chat-message" data-institutional-presentation={presentation}>
   <button type="button" className="institutional-chat-message__text-size" aria-pressed={large} onClick={()=>{rememberInstitutionalLargeText(!large);setLarge(!large);}}>{answer.ui?.large_text??'Texto más grande'}</button>
   {answer.nodes.map((node,index)=>{
    const nodeAcronyms=readKnowledgeAcronyms(node.acronyms);
    const isOpenedAnswer=!(initialMenu&&index===0)&&node.id!==answer.initialMenu?.startNodeId;
    const whatsappUrl=isOpenedAnswer?buildInstitutionalWhatsAppUrl({
     title:node.title,
     text:node.text,
     acronyms:nodeAcronyms,
     acronymsLabel:answer.ui?.acronyms,
     links:node.links,
     portalUrl:buildInstitutionalPortalUrl(answer.tenant.slug,node.id),
    }):'';
    return <article key={node.id}>
    <h3 ref={index===0?heading:undefined} tabIndex={-1}>{node.title}</h3>
    {initialMenu&&index===0?choices:null}
    <div className="institutional-chat-message__prose"><InstitutionalTextBlocks text={node.text}/></div>
    <InstitutionalAcronyms items={nodeAcronyms} label={answer.ui?.acronyms}/>
    {answer.easyRead&&isOpenedAnswer?
     <InstitutionalEasyRead scope={{tenant:answer.tenant,revision:answer.revision,nodeId:node.id}} copy={answer.easyRead}
      initialText={index===0?answer.easyReadText??null:null}/>:null}
    {isOpenedAnswer?
     <div className="institutional-answer-actions">
      <button type="button" className="institutional-answer-actions__button" data-action="share-whatsapp" data-whatsapp-url={whatsappUrl}
       onClick={()=>openInstitutionalWhatsAppShare(whatsappUrl)}>
       <Share2 size={17} aria-hidden="true"/><span>{shareLabels.whatsapp}</span>
      </button>
     </div>:null}
    {node.links.length?<div className="institutional-chat-message__links">{node.links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</div>:null}
    <details className="institutional-chat-message__sources"><summary>{answer.ui?.source_details??'Fuentes y revisión'}</summary>{node.sources.map(source=><section key={source.id}>
     <h4>{source.title}</h4><KnowledgeSourceMetadata source={source} mode="public"/>
     {knowledgeSourceExternalUrl(source,'public')?<a href={knowledgeSourceExternalUrl(source,'public')!} target="_blank" rel="noopener noreferrer">Referencia externa: {source.title}</a>:null}
    </section>)}</details>
   </article>;})}
   {answer.audioReading?<InstitutionalResponseAudio scope={{tenant:answer.tenant,revision:answer.revision,nodeIds:answer.nodes.map(node=>node.id)}} copy={answer.audioReading}/>:null}
   {!initialMenu?choices:null}
  </div>;
 });
const SourceNavigationMessage=React.forwardRef<HTMLDivElement,{answer:InstitutionalSourceNavigationMessage}>(
 ({answer},ref)=>{
  const [large,setLarge]=useState(readInstitutionalLargeText);
  return <div ref={ref} className={`institutional-chat-message${large?' institutional-chat-message--large':''}`} data-testid="institutional-chat-message" data-institutional-presentation="source-navigation">
   <button type="button" className="institutional-chat-message__text-size" aria-pressed={large} onClick={()=>{rememberInstitutionalLargeText(!large);setLarge(!large);}}>{answer.ui.large_text}</button>
   <h3>{answer.ui.sources}</h3>
   <div role="status"><InstitutionalTextBlocks text={answer.text}/></div>
   <details className="institutional-chat-message__sources"><summary>{answer.ui.source_details}</summary>
    {answer.sources.map(source=><section key={source.id}>
     <h4>{source.title}</h4><KnowledgeSourceMetadata source={source} mode="public"/>
     {knowledgeSourceExternalUrl(source,'public')?<a href={knowledgeSourceExternalUrl(source,'public')!} target="_blank" rel="noopener noreferrer">{source.title}</a>:null}
    </section>)}
   </details>
  </div>;
 });
const InstitutionalChatMessage=React.forwardRef<HTMLDivElement,{answer:InstitutionalMessage;onButtonClick:(value:SendPayload)=>void;interactive?:boolean}>(
 (props,ref)=>isInstitutionalSourceNavigationMessage(props.answer)
  ?<SourceNavigationMessage answer={props.answer} ref={ref}/>
  :<CanonicalInstitutionalChatMessage {...props} answer={props.answer} ref={ref}/>,
);
InstitutionalChatMessage.displayName='InstitutionalChatMessage';
export default InstitutionalChatMessage;
