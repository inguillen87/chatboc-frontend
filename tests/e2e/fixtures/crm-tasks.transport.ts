// Only the HTTP transport is replaced; task contracts and workflow stay real.
export async function apiFetch<T>(path:string,options:any={}):Promise<T>{
 const response=await fetch(path,{method:options.method||'GET',headers:{'Content-Type':'application/json',...options.headers},body:options.body?JSON.stringify(options.body):undefined});
 const body=await response.json();
 if(!response.ok)throw Object.assign(new Error(body.error?.message||'Request rejected'),{status:response.status,body});
 return body;
}
