// Synthetic browser transport; the analytics service and its normalizers remain real.
export class ApiError extends Error { constructor(message:string,public status=500,public body?:unknown){super(message);} }
export async function apiFetch<T>(path:string,options:any={}):Promise<T>{
  if(options.method && options.method!=='GET')throw new Error('Read-only geographic fixture');
  const response=await fetch(path,{headers:{...options.headers,'x-qa-tenant':options.tenantSlug||''}});
  options.onResponse?.(response);
  const value=await response.json();
  if(!response.ok)throw new ApiError('Synthetic response failure',response.status,value);
  return value;
}
export const useTenant=()=>({currentSlug:'geo-qa'});
