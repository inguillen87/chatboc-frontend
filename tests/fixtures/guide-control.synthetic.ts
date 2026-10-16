export const tenant={id:901,slug:'guide-control-qa'};
export const endpoint='/api/admin/tenants/guide-control-qa/conversation-guide-control';
export const controlUi={heading:'Control QA',description:'Revisión sintética sin datos personales',open:'Abrir control QA',loading:'Leyendo QA',enabled_label:'Habilitada QA',disabled_label:'Deshabilitada QA',source_label:'Fuente QA',pending:'Confirmando QA',enable:'Habilitar QA',disable:'Deshabilitar QA',confirm:'Confirmar QA',cancel:'Cancelar QA',refresh:'Actualizar QA',confirmation:'Revisar el cambio QA',acknowledgement:'Acepto la evaluación QA',success:'Confirmado QA',error:'No confirmado QA'};
export const descriptor=()=>({contract_version:'tenant.conversation_guide_control_access.v1',tenant:{...tenant},endpoint,evaluation_only:true,ui:{...controlUi}});
export const control=(enabled=false,version=0)=>({
 contract_version:'tenant.conversation_guide_control.v1',command_contract_version:'tenant.conversation_guide_control_command.v1',
 tenant:{...tenant},endpoint,evaluation_only:true,revision:'cdef'[version%4].repeat(64),
 state:{enabled,version,guide_id:'accessible-support-evaluation'},
 can_enable:true,can_disable:true,writes_blocked:false,provider_calls_performed:false,operational_content_approved:false,
 required_headers:{'X-Chatboc-Guide-Control':'1'},ui:{...controlUi},
 installed_guide:{guide_id:'accessible-support-evaluation',evaluation_only:true,guide_sha256:'a'.repeat(64),node_count:29,source:{sha256:'b'.repeat(64),label:'Documento QA',approval_status:'Evaluación QA'}},
});
export const receipt=(enabled=true,version=1)=>({contract_version:'tenant.conversation_guide_control_save.v1',tenant:{...tenant},saved:true,provider_calls_performed:false,operational_content_approved:false,control:control(enabled,version)});
