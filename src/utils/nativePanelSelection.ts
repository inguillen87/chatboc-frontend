import {safeLocalStorage,safeSessionStorage} from './safeLocalStorage';

const SELECTION_KEY='chatbocNativeImpersonationSelection.v1';
interface Selection {actorId:string;lineageId:string;initiatedByActorId:string}
export const clearNativePanelSelection=()=>safeSessionStorage.removeItem(SELECTION_KEY);
export const selectNativePanelImpersonation=(selection:Selection)=>safeSessionStorage.setItem(SELECTION_KEY,JSON.stringify(selection));

/** A denial-only choice: suppress SDK restoration, never authenticate a user. */
export function hasSelectedNativePanelImpersonation():boolean{
 try{
  const selection=JSON.parse(safeSessionStorage.getItem(SELECTION_KEY)??'null') as Selection|null;
  const token=safeLocalStorage.getItem('authToken');
  if(!selection||!token||safeLocalStorage.getItem('authProvider')==='clerk')return false;
  const part=token.split('.')[1];if(!part)return false;
  const payload=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
  return payload.auth_provider==='native'&&String(payload.user_id)===selection.actorId&&payload.asid===selection.lineageId&&
   String(payload.impersonated_by)===selection.initiatedByActorId&&typeof payload.exp==='number'&&payload.exp>Date.now()/1000;
 }catch{return false;}
}
