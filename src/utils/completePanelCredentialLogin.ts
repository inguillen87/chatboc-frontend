import {loginPanelWithCredentials} from '@/api/panelLogin';
import {persistPanelLoginSession, type PanelLoginUser} from './panelLoginSession';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent} from './sessionLogout';
import {panelLoginDestination} from './panelLoginDestination';
export class ObsoletePanelLogin extends Error {
  constructor(){super('La solicitud de acceso ya no corresponde a esta pantalla.');this.name='ObsoletePanelLogin';}
}
interface Input {
  email:string; password:string; pathname:string; search:string;
  isCurrent:()=>boolean; setUser:(user:PanelLoginUser)=>void;
}
export async function completePanelCredentialLogin(input:Input) {
  const {email,password,pathname,search,isCurrent,setUser}=input;
  const revision=captureChatbocSessionRevision();
  const isCurrentAttempt=()=>isCurrent()&&isChatbocSessionRevisionCurrent(revision);
  const ensureCurrent=()=>{if(!isCurrentAttempt())throw new ObsoletePanelLogin();};
  ensureCurrent();
  let data: Awaited<ReturnType<typeof loginPanelWithCredentials>>;
  try { data=await loginPanelWithCredentials(email,password,pathname,isCurrentAttempt); }
  catch(error){ensureCurrent();throw error;}
  ensureCurrent();
  const slug=data.user.tenant_slug||null;
  const destination=panelLoginDestination(search,slug,data.user.rol||data.user.role||'');
  const user=persistPanelLoginSession({token:data.token,sessionRetirement:data.session_retirement,user:data.user,entityToken:data.entityToken,
    tipoChat:data.tipo_chat,tenantSlugHint:slug,replaceIdentity:true,setUser});
  return {user,destination};
}
