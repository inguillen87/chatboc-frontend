import { createHash } from 'node:crypto';
// Export-only rendering; this module never contacts a messaging provider.
const shorten=(value,max)=>[...value].length<=max?value:[...value].slice(0,max-1).join('')+'…';
const shortNames={'start:2':'Para un familiar','main:1':'Documentación','main:2':'Salud y medicación','main:4':'Escuela y apoyos','documentation:1':'Preparar consulta CUD','support:1':'Inscripción escolar','employment:1':'Inclusión laboral'};
export function buildWhatsAppPack(guide) {
 if(guide?.evaluation_only!==true || !guide.nodes) throw new Error('evaluation_guide_required');
 const messages=[];
 const bindings={};
 for(const node of Object.values(guide.nodes)) {
  const body=`${node.title}\n\n${node.text}`;
  if(body.length>1024 || !node.actions.length || node.actions.length>10) throw new Error('unsupported_whatsapp_node');
  const buttons=node.actions.length<=3;
  const items=node.actions.map(a=>{
   if(!guide.nodes[a.target]) throw new Error('unknown_target');
   const id=`${node.id}:${a.code}`;
   if(id.length>200 || bindings[id]) throw new Error('invalid_action_identity');
   bindings[id]={node:node.id,selection:a.code,target:a.target};
   return {id,label:shorten(shortNames[id]||a.label,buttons?20:24),original_label:a.label};
  });
  if(new Set(items.map(a=>a.label)).size!==items.length) throw new Error('ambiguous_short_labels');
  const type=buttons?'twilio/quick-reply':'twilio/list-picker';
  const content=buttons?{body,actions:items.map(a=>({id:a.id,title:a.label}))}
   :{body,button:'Ver opciones',items:items.map(a=>({id:a.id,item:a.label,description:shorten(a.original_label,72)}))};
  const interactive=buttons?{type:'button',body:{text:body},action:{buttons:items.map(a=>({type:'reply',reply:{id:a.id,title:a.label}}))}}
   :{type:'list',body:{text:body},action:{button:'Ver opciones',sections:[{title:'Opciones',rows:items.map(a=>({id:a.id,title:a.label,description:shorten(a.original_label,72)}))}]}};
  messages.push({node:node.id,source_pages:node.source_pages,transport:buttons?'quick_reply':'list',
   twilio:{friendly_name:`accessible_${node.id.replaceAll('-','_')}_v1`,language:'es',types:{[type]:content}},
   meta:{messaging_product:'whatsapp',type:'interactive',interactive},recipient_required:true});
 }
 const result={contract_version:'accessible.whatsapp.draft_pack.v1',status:'draft',provider_calls:0,send_enabled:false,
  evaluation_only:true,source:guide.source,guide_digest:createHash('sha256').update(JSON.stringify(guide)).digest('hex'),
  messages,bindings,session_window_required:true,list_approval_supported:false,
  production_gates:['verified_tenant_sender','approved_content','verified_webhooks','consent','session_or_approved_template','idempotent_event','delivery_acceptance']};
 return result;
}
