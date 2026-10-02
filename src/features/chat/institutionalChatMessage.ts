import {isKnowledgeNode,isKnowledgeSource,sameKnowledgeSourceIdentity,type KnowledgeNode,type KnowledgeSource} from '@/components/knowledge/institutionalAssistantContract';

export interface InstitutionalChatMessage {
  tenant:{id:number;slug:string}; revision:string; nodes:KnowledgeNode[]; sources:KnowledgeSource[];
}
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export const isInstitutionalChatPayload=(value:unknown):boolean=>record(value)&&typeof value.fuente==='string'&&value.fuente.startsWith('institutional_knowledge');

/** Validate the existing responder envelope against this chat's explicit tenant. */
export function parseInstitutionalChatMessage(value:unknown,tenantSlug:string|null|undefined):InstitutionalChatMessage|null {
  if(!record(value)||value.fuente!=='institutional_knowledge'||!tenantSlug||!record(value.knowledge_tenant)||
    value.knowledge_tenant.slug!==tenantSlug||!Number.isSafeInteger(value.knowledge_tenant.id)||Number(value.knowledge_tenant.id)<1||
    typeof value.context_revision!=='string'||!/^[a-f0-9]{64}$/.test(value.context_revision)||
    !Array.isArray(value.knowledge_nodes)||!value.knowledge_nodes.length||value.knowledge_nodes.length>3||!value.knowledge_nodes.every(isKnowledgeNode)||
    !Array.isArray(value.knowledge_sources)||!value.knowledge_sources.length||!value.knowledge_sources.every(isKnowledgeSource)||!Array.isArray(value.botones))return null;
  const revision=value.context_revision;
  const sources=new Map<string,KnowledgeSource>();
  for(const source of value.knowledge_sources){
    const previous=sources.get(source.id);if(previous&&!sameKnowledgeSourceIdentity(previous,source))return null;
    sources.set(source.id,source);
  }
  for(const node of value.knowledge_nodes)for(const source of node.sources){
    const registered=sources.get(source.id);if(!registered||!sameKnowledgeSourceIdentity(source,registered))return null;
  }
  const actions=value.knowledge_nodes.flatMap(node=>node.actions);
  const expected=actions.filter((action,index)=>actions.findIndex(other=>other.target===action.target&&other.label===action.label)===index);
  if(value.botones.length!==expected.length||value.botones.some((button,index)=>!record(button)||
    button.texto!==expected[index].label||button.action_id!==`knowledge:${revision.slice(0,16)}:${expected[index].target}`))return null;
  return {tenant:{id:Number(value.knowledge_tenant.id),slug:tenantSlug},revision,nodes:value.knowledge_nodes,sources:[...sources.values()]};
}

/** Decorative leading emoji stay visible; assistive technology reads the words. */
export function institutionalChoiceLabel(label:string):{emoji:string|null;words:string} {
  const parts=/^(\S+)\s+(.+)$/u.exec(label.trim());
  return parts&&/\p{Extended_Pictographic}/u.test(parts[1])?{emoji:parts[1],words:parts[2]}:{emoji:null,words:label};
}
