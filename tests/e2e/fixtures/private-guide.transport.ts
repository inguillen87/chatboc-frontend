// Controlled loopback transport only; the real profile provider, private read
// helper and contract parsers remain in the browser dependency graph.
export class ApiError extends Error {
 constructor(message:string,public readonly status:number,public readonly body:unknown=null){
  super(message);this.name='ApiError';Object.setPrototypeOf(this,ApiError.prototype);
 }
}
export async function apiFetch<T>(path:string,options:{tenantSlug?:string;method?:string;signal?:AbortSignal;isCurrent?:()=>boolean;headers?:HeadersInit;body?:unknown}={}):Promise<T>{
 const assertCurrent=()=>{
  options.signal?.throwIfAborted();
  if(options.isCurrent?.()===false)throw new DOMException('Synthetic private scope expired','AbortError');
 };
 assertCurrent();
 const headers=new Headers(options.headers);headers.set('x-qa-tenant',options.tenantSlug??'');
 headers.set('x-qa-actor',localStorage.getItem('clerkUserId')??'');
 if(options.body!==undefined)headers.set('content-type','application/json');
 const response=await fetch(path,{method:options.method??'GET',signal:options.signal,headers,
  ...(options.body===undefined?{}:{body:JSON.stringify(options.body)}),
 });
 assertCurrent();const data=await response.json();assertCurrent();
 if(!response.ok)throw new ApiError('Controlled private read failed',response.status,data);return data;
}
