// Synthetic transport/session boundary. Directory page, query and normalizers stay real.
export class ApiError extends Error {
  constructor(message:string,public status:number,public body?:unknown){super(message);}
}
export async function apiFetch<T>(path:string,options:{tenantSlug?:string;method?:string;body?:unknown}={}):Promise<T>{
  const response=await fetch(path,{method:options.method??'GET',headers:{'x-qa-tenant':options.tenantSlug??'','content-type':'application/json'},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
  const data=await response.json();
  if(!response.ok)throw new ApiError('PRIVATE TRANSPORT BODY',response.status,data);
  return data;
}
export const getErrorMessage=(_error:unknown,fallback:string)=>fallback;
export const useUser=()=>({user:{id:1,rol:'superadmin',tenantSlug:'qa-a'}});
export const useSocket=()=>({socket:null,isConnected:false});
export default function UnusedSessionOrCampaignFixture(){return null;}
// The fixture supplies the active organization directly; no persisted login or URL inference.
export const resolveTenantSlug=(explicitTenant?:string|null)=>explicitTenant??null;
