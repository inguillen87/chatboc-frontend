import React from 'react';
// Test transport only. The workspace, API normalizers and reply identity logic remain real.
async function request(path: string, method: string, payload: unknown, options?: {tenantSlug?: string; headers?: Record<string,string>}) {
  const response = await fetch(path, { method, headers: {'content-type':'application/json','x-qa-tenant':options?.tenantSlug || '', ...options?.headers}, ...(payload === undefined ? {} : {body:JSON.stringify(payload)}) });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error('Synthetic API failure'),{status:response.status});
  return body;
}
export const panelApi = {
  get: (path: string, options?: {tenantSlug?: string}) => request(path,'GET',undefined,options),
  post: (path: string, body: unknown, options?: {tenantSlug?: string; headers?: Record<string,string>}) => request(path,'POST',body,options),
  patch: (path: string, body: unknown, options?: {tenantSlug?: string}) => request(path,'PATCH',body,options),
};
export function useTenant() {
  const [currentSlug,setCurrentSlug] = React.useState('qa-a');
  React.useEffect(()=>{ (window as any).__qaSetInboxTenant=setCurrentSlug; return()=>{delete (window as any).__qaSetInboxTenant;}; },[]);
  return {currentSlug};
}
