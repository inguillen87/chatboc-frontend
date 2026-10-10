export const domainScope = { id:17,slug:'government-east' };
export const domainPayload = (patch: Record<string,unknown> = {}) => ({
  contract_version:'organization.domain.v1',tenant:domainScope,revision:'a'.repeat(64),version:1,
  host:'atencion.example.test',status:'pending_dns',active:false,can_edit:true,can_revoke:true,reason_code:'ready',
  dns_proof:{type:'TXT',name:'_chatboc-verify.atencion.example.test',value:'chatboc-domain-verification='+'b'.repeat(64),expires_at:Math.floor(Date.now()/1000)+3600},
  valid_until:null,save_endpoint:'/api/admin/tenants/government-east/domain',provider_changes_performed:false,
  scope_note:'La solicitud sólo configura el dominio. DNS y publicación se verifican por separado.',...patch,
});
