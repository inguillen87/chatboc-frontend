import {useSyncExternalStore} from 'react';
const account=(slug:string,name:string)=>({id:slug==='org-a'?12:13,rol:'admin',tenant_slug:slug,tenantSlug:slug,nombre_empresa:name,logo_url:'/qa-logo.svg',tipo_chat:'municipio',name:'Operador de prueba',plan:'full'});
let state={user:account('org-a','Organización de prueba A') as ReturnType<typeof account>|null,verified:true,profileVerified:true,loading:false,currentSlug:'org-a'};
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
const useState=()=>useSyncExternalStore(subscribe,()=>state,()=>state);
export function setFixtureState(mode:'ready'|'refreshing'|'other'|'revoked'|'mismatch'){
  if(mode==='ready')state={user:account('org-a','Organización de prueba A'),verified:true,profileVerified:true,loading:false,currentSlug:'org-a'};
  if(mode==='refreshing')state={...state,loading:true,profileVerified:false};
  if(mode==='other')state={user:account('org-b','Organización de prueba B'),verified:true,profileVerified:true,loading:false,currentSlug:'org-b'};
  if(mode==='revoked')state={...state,user:null,verified:false,profileVerified:false};
  if(mode==='mismatch')state={...state,currentSlug:'foreign-org'};
  listeners.forEach(listener=>listener());
}
export const useUser=()=>{const value=useState();return {user:value.user,organizationProfileVerified:value.profileVerified,loading:value.loading};};
export const useTenant=()=>{const value=useState();return {currentSlug:value.currentSlug,tenant:null,isLoadingTenant:false,tenantError:null};};
export const useSessionAuthority=()=>{const value=useState();return {hasVerifiedSession:value.verified,hasBearerSession:value.verified,clerkStatus:'disabled'};};
export const useCapabilities=()=>({capabilities:['tickets.read','orders.read'],hasAnyCapability:(values:string[])=>values.some(value=>['tickets.read','orders.read'].includes(value))});
export default function useCartCount(){return 0;}
