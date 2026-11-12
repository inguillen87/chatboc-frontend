// Synthetic HTTP boundary only; the workspace, hook and normalizers remain real.
export class ApiError extends Error {
  constructor(message:string,public status:number,public body?:unknown){super(message);}
}
export async function apiFetch<T>(path:string,options:{tenantSlug?:string}={}):Promise<T>{
  const response=await fetch(path,{headers:{'x-qa-tenant':options.tenantSlug??''}});
  const data=await response.json();
  if(!response.ok)throw new ApiError('Synthetic unavailable detail',response.status,data);
  return data;
}
export const getErrorMessage=(_error:unknown,fallback:string)=>fallback;
