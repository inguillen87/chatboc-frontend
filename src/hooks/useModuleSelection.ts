import {useCallback,useEffect,useRef,useState} from 'react';
import {apiFetch} from '@/utils/api';
import {readModuleSelection,validModules,equalModules,type ModuleId,type ModuleSelection} from '@/utils/organizationModules';
export function useModuleSelection(slug:string,ui:Record<string,string>,onSaved:()=>void) {
  const [snapshot,setSnapshot]=useState<ModuleSelection|null>(null),[draft,setDraft]=useState<ModuleId[]>([]);
  const [latest,setLatest]=useState<ModuleSelection|null>(null),[pending,setPending]=useState(false);
  const [review,setReview]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const live=useRef(false),generation=useRef(0),busy=useRef(false),expectedId=useRef<number|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const bounded=async<T,>(promise:Promise<T>):Promise<T>=>{
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {return await Promise.race([promise,new Promise<never>((_,reject)=>{
      timeout=setTimeout(()=>reject(new Error('module_request_timeout')),15000);timer.current=timeout;
    })]);}finally{clearTimeout(timeout);if(timer.current===timeout)timer.current=null;}
  };
  const read=useCallback(async(comparison=false)=>{
    if(!live.current||busy.current)return;busy.current=true;setPending(true);setError(null);setMessage(null);const seq=++generation.current;
    try {
      const raw=await bounded(apiFetch<any>(`/api/admin/tenants/${encodeURIComponent(slug)}/config`,{tenantSlug:slug,persistTenantSlug:false,cache:'no-store'}));
      const value=readModuleSelection(raw?.organization_modules,slug);
      if(!live.current||seq!==generation.current)return;
      if(!value||(expectedId.current!==null&&expectedId.current!==value.tenant.id))throw new Error('module_contract_invalid');
      expectedId.current=value.tenant.id;
      if(comparison){setLatest(value);}else{setSnapshot(value);setDraft(value.selected);setLatest(null);setReview(false);}
    }catch(e:any){if(!live.current||seq!==generation.current)return;
      if([401,403].includes(e?.status)){setSnapshot(null);setDraft([]);setLatest(null);}
      setError(ui.error);
    }finally{if(live.current&&seq===generation.current){busy.current=false;setPending(false);}}
  },[slug,ui.error]);
  useEffect(()=>{live.current=true;void read();return()=>{live.current=false;++generation.current;busy.current=false;if(timer.current)clearTimeout(timer.current);};},[read]);
  const dirty=!!snapshot&&!equalModules(snapshot.selected,draft);
  useEffect(()=>{
    if(!snapshot||(!dirty&&!review))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty,review,!!snapshot]);
  const edit=(selected:ModuleId[])=>{
    if(!live.current||!snapshot?.can_edit||busy.current||!validModules(selected,snapshot.catalog))return;
    setDraft(snapshot.catalog.filter(m=>selected.includes(m.id)).map(m=>m.id));setMessage(null);
  };
  const save=async()=>{
    if(!live.current||!snapshot?.can_edit||busy.current||error||review||latest||!validModules(draft,snapshot.catalog))return;
    if(!dirty&&snapshot.source==='saved')return;
    busy.current=true;setPending(true);setMessage(null);const seq=++generation.current;const expected=[...draft];
    try {
      const raw=await bounded(apiFetch<any>(snapshot.save_endpoint,{method:'PUT',tenantSlug:slug,persistTenantSlug:false,
        body:{expected_revision:snapshot.revision,organization_modules:{selected:expected}}}));
      if(!live.current||seq!==generation.current)return;
      const result=readModuleSelection(raw?.selection,slug);
      const changed=snapshot.source==='defaults'||!equalModules(snapshot.selected,expected);
      if(!result||raw.contract_version!=='organization.setup_modules_save.v1'||raw.saved!==changed
        ||raw.tenant?.id!==snapshot.tenant.id||raw.tenant?.slug!==slug||result.tenant.id!==snapshot.tenant.id
        ||result.version!==snapshot.version+(changed?1:0)||result.source!=='saved'||!equalModules(expected,result.selected)
        ||raw.provider_calls_performed!==false||raw.changes_runtime_access!==false)throw new Error('module_receipt_invalid');
      setSnapshot(result);setDraft(result.selected);setLatest(null);setReview(false);setMessage(result.ui.success);onSaved();
    }catch(e:any){if(!live.current||seq!==generation.current)return;
      if([401,403].includes(e?.status)){setSnapshot(null);setDraft([]);setLatest(null);}
      setReview(true);setError(e?.status===412?ui.conflict:ui.error);
    }finally{if(live.current&&seq===generation.current){busy.current=false;setPending(false);}}
  };
  const choose=(keepDraft:boolean)=>{
    if(!latest||busy.current)return;
    if(keepDraft&&!validModules(draft,latest.catalog))return;
    setSnapshot(latest);if(!keepDraft)setDraft(latest.selected);setLatest(null);setReview(false);setError(null);setMessage(null);
  };
  const discard=()=>{if(!snapshot||busy.current||review||latest||error)return;setDraft(snapshot.selected);setMessage(null);};
  return {snapshot,draft,dirty,latest,pending,review,error,message,edit,save,discard,choose,
    refresh:()=>read(!!snapshot),retry:()=>read(false)};
}
