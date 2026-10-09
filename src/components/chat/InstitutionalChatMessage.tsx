import React,{useEffect,useRef,useState} from 'react';
import type {SendPayload} from '@/types/chat';
import {institutionalChoiceLabel,institutionalChatActions,type InstitutionalChatMessage as InstitutionalMessage} from '@/features/chat/institutionalChatMessage';
import {KnowledgeSourceMetadata} from '@/components/knowledge/InstitutionalAssistantSourceMetadata';
import {InstitutionalTextBlocks} from '@/components/knowledge/InstitutionalTextBlocks';
import {knowledgeSourceExternalUrl} from '@/components/knowledge/institutionalAssistantContract';
import './institutionalChatMessage.css';

/** The ordinary embedded chat uses this reader only for a validated institutional response. */
const InstitutionalChatMessage=React.forwardRef<HTMLDivElement,{answer:InstitutionalMessage;onButtonClick:(value:SendPayload)=>void}>(
 ({answer,onButtonClick},ref)=>{
  const [large,setLarge]=useState(false),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
   // Continue keyboard navigation from the preceding menu without taking focus
   // away from someone who is typing or reading elsewhere on the host page.
   if(document.activeElement?.hasAttribute('data-institutional-choice'))heading.current?.focus({preventScroll:true});
  },[answer.revision,answer.nodes.map(node=>node.id).join(':')]);
  const actions=institutionalChatActions(answer.nodes);
  return <div ref={ref} className={`institutional-chat-message${large?' institutional-chat-message--large':''}`} data-testid="institutional-chat-message">
   <button type="button" className="institutional-chat-message__text-size" aria-pressed={large} onClick={()=>setLarge(value=>!value)}>Texto más grande</button>
   {answer.nodes.map((node,index)=><article key={node.id}>
    <h3 ref={index===0?heading:undefined} tabIndex={-1}>{node.title}</h3>
    <div className="institutional-chat-message__prose"><InstitutionalTextBlocks text={node.text}/></div>
    {node.links.length?<div className="institutional-chat-message__links">{node.links.map(link=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</div>:null}
    <details className="institutional-chat-message__sources"><summary>Fuentes y revisión</summary>{node.sources.map(source=><section key={source.id}>
     <h4>{source.title}</h4><KnowledgeSourceMetadata source={source} mode="public"/>
     {knowledgeSourceExternalUrl(source,'public')?<a href={knowledgeSourceExternalUrl(source,'public')!} target="_blank" rel="noopener noreferrer">Referencia externa: {source.title}</a>:null}
    </section>)}</details>
   </article>)}
   {actions.length?<div className="institutional-chat-message__choices">{actions.map(action=>{
    const label=institutionalChoiceLabel(action.label),actionId=`knowledge:${answer.revision.slice(0,16)}:${action.target}`;
    return <button key={`${action.target}:${action.label}`} type="button" data-institutional-choice aria-label={label.words}
     onClick={()=>onButtonClick({text:action.label,action:actionId,action_id:actionId,source:'button'})}>
     {label.emoji?<span aria-hidden="true">{label.emoji}</span>:null}<span>{label.words}</span>
    </button>;
   })}</div>:null}
  </div>;
 });
InstitutionalChatMessage.displayName='InstitutionalChatMessage';
export default InstitutionalChatMessage;
