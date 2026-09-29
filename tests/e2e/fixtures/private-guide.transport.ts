export async function apiFetch<T>(path:string,options:{tenantSlug?:string;method?:string}={}):Promise<T>{
 const response=await fetch(path,{method:options.method??'GET',headers:{'x-qa-tenant':options.tenantSlug??''}});
 const data=await response.json();if(!response.ok)throw new Error('PRIVATE SERVER BODY');return data;
}
