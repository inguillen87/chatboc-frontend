// Synthetic contract examples only: no client document, credential or production guide content.
export const guideTenant={id:701,slug:'qa-guide'};
export const guideCopy={heading:'Guía privada QA',description:'Recorrido de evaluación publicado por el servidor.',
  open:'Abrir guía QA',start:'Volver al inicio',back_to_menu:'Ir al menú',source_label:'Fuente publicada',
  loading:'Cargando contenido QA',error:'Contenido QA no disponible'};
export const guideAccess={contract_version:'tenant.conversation_guide_access.v1',tenant:guideTenant,
  guide_id:'qa-guide',evaluation_only:true,endpoint:'/api/admin/tenants/qa-guide/conversation-guide',ui:guideCopy};
export const guideActivation=()=>({contract_version:'tenant.channel_activation.v1',tenant:{...guideTenant},channels:[],
  organization_setup:{tenant:{...guideTenant},conversation_guide:structuredClone(guideAccess)}});
export const guideNode=(id='start')=>({contract_version:'tenant.conversation_guide.v1',tenant:{...guideTenant},
  guide_id:'qa-guide',evaluation_only:true,guide_sha256:'a'.repeat(64),writes_performed:false,provider_calls_performed:false,
  policy:{accepts_personal_data:false,creates_real_cases:false,queries_official_records:false,sends_notifications:false,stores_feedback:false},
  source:{sha256:'b'.repeat(64),page_count:14,label:'Documento sintético QA',approval_status:'Evaluación sin aprobación operativa'},
  menu:{id,title:`Nodo ${id}`,text:`Contenido de evaluación: ${id}.`,kind:'menu',source_pages:[1,2],
    actions:[{code:'1',label:'Consultar requisitos QA',target:'requirements'},{code:'2',label:'Volver al menú QA',target:'main'}]},
  ui:{...guideCopy}});
