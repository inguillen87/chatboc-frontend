// Transport shim for a loopback-only acceptance server. Login/session logic remains real.
export class ApiError extends Error {
  constructor(message:string,public status:number,public body?:Record<string,unknown>){super(message);}
}
export class NetworkError extends Error {}
export async function apiFetch<T>(path:string,options:any={}):Promise<T>{
  const url=new URL(path,location.origin),headers:Record<string,string>={'Content-Type':'application/json'};
  if(options.tenantSlug&&!options.omitTenant){url.searchParams.set('tenant_slug',options.tenantSlug);headers['X-Tenant']=options.tenantSlug;}
  if(!options.skipAuth){const token=localStorage.getItem('authToken');if(token)headers.Authorization=`Bearer ${token}`;}
  const result=await fetch(url,{method:options.method||'GET',headers,credentials:options.omitCredentials?'omit':'include',body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const data=await result.json();if(!result.ok)throw new ApiError('Synthetic runtime request rejected',result.status,data);
  return data;
}
