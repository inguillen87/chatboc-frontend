import {apiClient} from '@/api/client';
import {apiFetch,ApiError} from '@/utils/api';
import {usePanelSessionStore} from '@/stores';
import {panelReadOptions} from './panelReadOptions';
import {normalizedLoginTenant,validatePanelLoginResponse} from './panelLoginResponse';
import {persistPanelLoginSession} from './panelLoginSession';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent,logoutChatbocSession} from './sessionLogout';
import {validateSessionRetirementProof} from './sessionRetirement';
import {buildTenantPath} from './tenantPaths';

export class ImpersonationBoundaryError extends Error{
 constructor(){super('No se pudo verificar el acceso a esa organización. Se conservó la cuenta activa.');this.name='ImpersonationBoundaryError';}
}
export const impersonationErrorMessage=(error:unknown)=>error instanceof ApiError&&error.body?.reason_code==='impersonation_provider_unsupported'
 ?'Esta organización usa Clerk. Este acceso como administrador sólo admite cuentas nativas.'
 :error instanceof ApiError&&error.body?.reason_code==='impersonation_actor_unavailable'
 ?'La cuenta administradora de esta organización no está disponible.'
 :'No se pudo verificar el acceso a esa organización. Se conservó la cuenta activa.';

/** Verify candidate B with HTTP before changing any part of the current A. */
export async function completeNativeImpersonation(tenantSlug:string,isCurrent:()=>boolean){
 const revision=captureChatbocSessionRevision(),adminId=usePanelSessionStore.getState().user?.id;
 const slug=normalizedLoginTenant(tenantSlug);
 const current=()=>isCurrent()&&isChatbocSessionRevisionCurrent(revision)&&usePanelSessionStore.getState().user?.id===adminId;
 const ensure=()=>{if(!current())throw new ImpersonationBoundaryError();};
 if(!slug||!adminId)throw new ImpersonationBoundaryError();ensure();
 const candidate=await apiClient.superAdminImpersonate(slug,current);ensure();
 const descriptor=candidate.session_retirement;
 if(typeof candidate.token!=='string'||!candidate.token||/\s/.test(candidate.token)||candidate.token.length>16384||
  !descriptor||!validateSessionRetirementProof(descriptor,{actorId:descriptor.actor_id,provider:'native'}))throw new ImpersonationBoundaryError();
 const profile=await apiFetch<Record<string,any>>('/api/me',{
  ...panelReadOptions(),skipAuth:true,headers:{Authorization:`Bearer ${candidate.token}`},omitCredentials:true,
  allowStartupRecovery:false,preserveAuthOn401:true,suppressPanel401Redirect:true,cache:'no-store',isCurrent:current,
 });ensure();
 const verified=validateSessionRetirementProof(profile.session_retirement,{actorId:profile.id,provider:'native'});
 if(!verified||verified.lineage_id!==descriptor.lineage_id||verified.proof!==descriptor.proof||
  profile.session_context?.kind!=='impersonation'||profile.session_context.initiated_by_actor_id!==String(adminId))throw new ImpersonationBoundaryError();
 const parsed=validatePanelLoginResponse({token:candidate.token,user:profile,session_retirement:verified},profile.email,slug);
 ensure();
 // A's operation is frozen before B is committed. Its completion cannot alter B.
 void logoutChatbocSession();
 persistPanelLoginSession({token:candidate.token,user:parsed.user,sessionRetirement:verified,replaceIdentity:true,
  nativeImpersonation:{initiatedByActorId:String(adminId)},setUser:user=>usePanelSessionStore.getState().setUser(user as any)});
 return {destination:buildTenantPath('/perfil',slug)};
}
