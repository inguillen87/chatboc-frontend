import React,{useEffect,useRef,useState} from 'react';
import {ThumbsDown,ThumbsUp} from 'lucide-react';
import {apiFetch} from '@/utils/api';
import {knowledgeEndpoint,type KnowledgeWorkspace} from './institutionalAssistantContract';

/** Send one anonymous yes/no about a published topic. Nothing else travels: no text, no identity. */
export async function sendAnswerFeedback(workspace:KnowledgeWorkspace,nodeId:string,helpful:boolean) {
  if(!workspace.revision||!/^[a-f0-9]{64}$/.test(workspace.revision)||!nodeId||nodeId.length>120)throw new Error('knowledge_feedback_scope_invalid');
  await apiFetch(knowledgeEndpoint(workspace.tenant.slug,'public')+'/feedback',{
    method:'POST',tenantSlug:workspace.tenant.slug,body:{revision:workspace.revision,node_id:nodeId,helpful},
    cache:'no-store',singleAttempt:true,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,
    persistTenantSlug:false,skipAuth:true,omitCredentials:true});
}

interface Props {workspace:KnowledgeWorkspace;nodeId:string}

/** «¿Te sirvió esta respuesta?» One tap, one answer per reading; a failed send never bothers the reader. */
export function InstitutionalAnswerFeedback({workspace,nodeId}:Props) {
  const [choice,setChoice]=useState<boolean|null>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{setChoice(null);},[nodeId,workspace.revision]);
  const mark=(helpful:boolean)=>{
    if(choice!==null)return;
    setChoice(helpful);
    void sendAnswerFeedback(workspace,nodeId,helpful).catch(()=>undefined);
  };
  return <div className="institutional-assistant__feedback" role="group" aria-labelledby={`knowledge-feedback-${nodeId}`}>
    <p id={`knowledge-feedback-${nodeId}`}>¿Te sirvió esta respuesta?</p>
    {choice===null?<div>
      <button type="button" onClick={()=>mark(true)}><ThumbsUp size={18} aria-hidden="true"/><span>Sí</span></button>
      <button type="button" onClick={()=>mark(false)}><ThumbsDown size={18} aria-hidden="true"/><span>No</span></button>
    </div>:null}
    <p role="status" className="institutional-assistant__feedback-thanks">{choice===null?'':choice
      ?'Gracias por avisarnos.'
      :'Gracias por avisarnos. Lo vamos a revisar. Si necesitás ayuda, podés consultar los contactos por ciudad.'}</p>
  </div>;
}
