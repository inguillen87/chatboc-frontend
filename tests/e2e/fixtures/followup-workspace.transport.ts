// Synthetic transport only. The follow-up API workflow and UI are real.
export async function apiFetch<T>(path:string,options:any={}):Promise<T>{
  const response=await fetch(path,{method:options.method||'GET',headers:{'Content-Type':'application/json','x-qa-tenant':options.tenantSlug||''},body:options.body?JSON.stringify(options.body):undefined});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error('Synthetic request rejected'),{status:response.status});
  return data;
}
