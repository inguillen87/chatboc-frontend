// Synthetic HTTP/session boundary; the actual page, components and parsers remain in use.
import React from 'react';
export const useTenant=()=>({currentSlug:'qa-knowledge',tenant:{id:701,slug:'qa-knowledge',nombre:'Institución de prueba'}});
export const useUser=()=>({loading:false,hasVerifiedSession:true,user:{id:701,rol:'tenant_admin',tenant_slug:'qa-knowledge'}});
export async function apiFetch(path:string,options:any={}){
  const response=await fetch(path,{method:options.method??'GET',headers:{'content-type':'application/json',...(options.headers??{})},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
  const data=await response.json();if(!response.ok)throw new Error('Synthetic HTTP rejection');return data;
}
export default function UnrelatedProvisioningPanel(){return null;}
