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
  const revision=captureChatbocSessionRevision();
  const ensureCurrent=()=>{if(!input.isCurrent()||!isChatbocSessionRevisionCurrent(revision))throw new ObsoletePanelLogin();};
  ensureCurrent();
  const data=await loginPanelWithCredentials(input.email,input.password,input.pathname);
  ensureCurrent();
  const slug=data.user.tenant_slug||null;
  const destination=panelLoginDestination(input.search,slug,data.user.rol||data.user.role||'');
  const user=persistPanelLoginSession({token:data.token,user:data.user,entityToken:data.entityToken,
    tipoChat:data.tipo_chat,tenantSlugHint:slug,replaceIdentity:true,setUser:input.setUser});
  return {user,destination};
}
