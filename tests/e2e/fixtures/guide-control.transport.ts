export async function apiFetch<T>(url:string,options:any={}):Promise<T>{
 const response=await fetch(url,{method:options.method??'GET',headers:{'content-type':'application/json','x-qa-tenant':options.tenantSlug??'',...options.headers},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
 const body=await response.json();if(!response.ok)throw new Error('PRIVATE QA ERROR');return body;
}
