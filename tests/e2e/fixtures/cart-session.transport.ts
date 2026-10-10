// Synthetic HTTP boundary. Encode QA tenant metadata for header transport; product API code stays real.
export class ApiError extends Error {
  constructor(message:string,public status:number,public body?:unknown){super(message);}
}
export async function apiFetch<T>(path:string,options:{tenantSlug?:string;method?:string;body?:unknown}={}):Promise<T>{
  const response=await fetch(path,{method:options.method??'GET',headers:{'x-qa-tenant-uri':encodeURIComponent(options.tenantSlug??''),'content-type':'application/json'},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
  const body=await response.json();
  if(!response.ok)throw new ApiError('Synthetic request unavailable',response.status,body);
  return body;
}
export const trackFrontendEvent=()=>{};
