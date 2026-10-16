// Synthetic HTTP/session boundary only. Actual apiClient, market API and normalizers stay real.
export class ApiError extends Error {
  constructor(message:string, public status:number, public body?:Record<string,unknown>) {super(message);}
}
export async function apiFetch<T>(path:string, options:{method?:string;body?:unknown;tenantSlug?:string;skipAuth?:boolean}={}):Promise<T> {
  const response=await fetch(path,{method:options.method??'GET',headers:{'Content-Type':'application/json','x-qa-tenant':options.tenantSlug??''},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
  const value=await response.json();
  if(!response.ok)throw new ApiError('Synthetic request failed',response.status,value);
  return value;
}
export const useTenant=()=>({currentSlug:'qa-order'});
