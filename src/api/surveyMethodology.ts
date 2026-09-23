import { apiFetch } from '@/utils/api';
import { readMethodology, type MethodologyScope, type MethodologyWrite } from '@/utils/surveyMethodology';

function endpoint(scope:MethodologyScope,revision?:number|null) {
 if(!Number.isSafeInteger(scope.surveyId)||scope.surveyId<=0||!Number.isSafeInteger(scope.tenantId)||scope.tenantId<=0||!scope.tenantSlug.trim())throw new Error('methodology_scope_required');
 if(revision!=null&&(!Number.isSafeInteger(revision)||revision<1))throw new Error('methodology_revision_invalid');
 const query=new URLSearchParams({tenant_slug:scope.tenantSlug});
 if(revision!=null)query.set('revision',String(revision));
 return `/api/admin/encuestas/${scope.surveyId}/methodology?${query}`;
}
const parse=(value:unknown,scope:MethodologyScope)=>{
 const parsed=readMethodology(value,scope);
 if(!parsed)throw new Error('methodology_response_unverified');
 return parsed;
};
export async function getSurveyMethodology(scope:MethodologyScope,revision?:number|null) {
 const value=await apiFetch<unknown>(endpoint(scope,revision),{tenantSlug:scope.tenantSlug,persistTenantSlug:false});
 const data=parse(value,scope);
 if(revision!=null&&data.available&&data.profile.revision!==revision)throw new Error('methodology_history_response_mismatch');
 return data;
}
export async function saveSurveyMethodology(scope:MethodologyScope,payload:MethodologyWrite) {
 const value=await apiFetch<unknown>(endpoint(scope),{method:'PUT',tenantSlug:scope.tenantSlug,persistTenantSlug:false,
  headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=parse(value,scope);
 const expected=payload.expected_revision+(data.unchanged===true?0:1);
 if(!data.available||data.profile.revision!==expected||data.latest_revision!==expected||data.profile.instrument_revision!==payload.expected_instrument_revision)
  throw new Error('methodology_write_confirmation_unverified');
 const normalize=(text:string)=>text.replace(/\r\n?/g,'\n').normalize('NFC').trim();
 if(Object.keys(payload.fields).some(key=>data.profile.fields[key]!==normalize(payload.fields[key]))||
   data.unchanged!==true&&data.profile.change_reason!==normalize(payload.change_reason))
  throw new Error('methodology_write_content_unverified');
 return data;
}
