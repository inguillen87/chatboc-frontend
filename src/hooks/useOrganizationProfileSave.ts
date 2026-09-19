import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { getErrorMessage } from '@/utils/api';
import { readOrganizationProfile, readProfileSaveReceipt, profileChanges,
  type OrganizationProfileSettings, type OrganizationValues } from '@/utils/organizationProfileSettings';

type State = { key:string; pending:boolean; needsReview:boolean; denied:boolean; message:string|null; latest:OrganizationProfileSettings|null };
const clean=(key:string):State=>({key,pending:false,needsReview:false,denied:false,message:null,latest:null});
const limited=async<T>(promise:Promise<T>):Promise<T>=>{
  let timer:ReturnType<typeof setTimeout>;
  try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('No pudimos confirmar la respuesta. Revisá el estado antes de reintentar.')),15000);})]);}
  finally{clearTimeout(timer!);}
};
export function useOrganizationProfileSave(scopeKey:string, profile:OrganizationProfileSettings|null){
  const generation=useRef({key:scopeKey,number:0});
  if(generation.current.key!==scopeKey)generation.current={key:scopeKey,number:generation.current.number+1};
  const busy=useRef<number|null>(null);
  const blocked=useRef<number|null>(null);
  const [stored,setStored]=useState<State>(()=>clean(scopeKey));
  const state=stored.key===scopeKey?stored:clean(scopeKey);
  useEffect(()=>()=>{generation.current.number+=1;},[]);
  const capture=()=>{const number=generation.current.number;return {number,current:()=>generation.current.key===scopeKey&&generation.current.number===number};};
  async function save(draft:OrganizationValues):Promise<OrganizationProfileSettings|null>{
    const run=capture();
    if(!profile?.can_edit||state.needsReview||state.denied||blocked.current===run.number||busy.current===run.number)return null;
    const changes=profileChanges(draft,profile.values);
    if(!Object.keys(changes).length)return profile;
    busy.current=run.number;setStored({...clean(scopeKey),pending:true});
    try{
      const reply=await limited(apiFetch<unknown>(profile.save_endpoint,{method:'PUT',tenantSlug:profile.tenant.slug,
        body:{organization_profile:changes,expected_revision:profile.revision}}));
      if(!run.current())return null;
      const verified=readProfileSaveReceipt(reply,profile,changes);
      if(!verified)throw new Error('La respuesta no corresponde al perfil guardado. Revisá su estado.');
      setStored(clean(scopeKey));return verified;
    }catch(error){
      if(run.current()){
        blocked.current=run.number;
        const status=(error as {status?:number})?.status;
        setStored({...clean(scopeKey),needsReview:true,denied:[401,403,404].includes(status??0),
          message:getErrorMessage(error,'No pudimos confirmar el guardado. Revisá la versión actual antes de continuar.')});
      }
      return null;
    }finally{if(busy.current===run.number)busy.current=null;}
  }
  async function review(){
    const run=capture();
    if(!profile||state.denied||busy.current===run.number)return;
    busy.current=run.number;setStored({...state,pending:true,message:null});
    try{
      const reply=await limited(apiFetch<any>(profile.save_endpoint,{tenantSlug:profile.tenant.slug}));
      if(!run.current())return;
      const latest=readOrganizationProfile(reply.organization_profile,profile.tenant.slug);
      if(!latest||latest.tenant.id!==profile.tenant.id)throw new Error('No pudimos verificar la organización de la respuesta.');
      setStored({...clean(scopeKey),needsReview:true,denied:!latest.can_edit,latest:latest.can_edit?latest:null});
    }catch(error){
      if(run.current())setStored({...clean(scopeKey),needsReview:true,
        denied:[401,403,404].includes((error as {status?:number})?.status??0),
        message:getErrorMessage(error,'No pudimos consultar la versión actual. Tu edición permanece en esta pantalla.')});
    }finally{if(busy.current===run.number)busy.current=null;}
  }
  function acceptReview(){
    if(!state.latest||state.pending||state.denied)return null;
    const latest=state.latest;blocked.current=null;setStored(clean(scopeKey));return latest;
  }
  return {...state,save,review,acceptReview};
}
