import {useCallback,useEffect,useRef,useState} from 'react';
import {apiFetch} from '@/utils/api';
import {readBrandSnapshot,sameBrandValues,isBrandColor,type BrandSnapshot,type BrandValues} from '@/utils/workspaceBranding';
export function useBrandStudio(slug:string,onPublished?:(brand:BrandSnapshot)=>void) {
  const [snapshot,setSnapshot]=useState<BrandSnapshot|null>(null);
  const [draft,setDraft]=useState<BrandValues|null>(null);
  const [latest,setLatest]=useState<BrandSnapshot|null>(null);
  const [writing,setWriting]=useState(false);
  const [pending,setPending]=useState(false);const [needsReview,setNeedsReview]=useState(false);
  const [message,setMessage]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
  const live=useRef(false),generation=useRef(0),busy=useRef(false);
  const expectedId=useRef<number|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const clearTimer=()=>{if(timer.current!==null)clearTimeout(timer.current);timer.current=null;};
  const limited=async<T,>(promise:Promise<T>):Promise<T>=>{
    let requestTimer:ReturnType<typeof setTimeout>;
    try{return await Promise.race([promise,new Promise<never>((_,reject)=>{
      requestTimer=setTimeout(()=>reject(new Error('brand_response_timeout')),15000);timer.current=requestTimer;
    })]);}finally{clearTimeout(requestTimer!);if(timer.current===requestTimer!)timer.current=null;}
  };
  const read=useCallback(async(review=false)=>{
    if(!live.current||busy.current)return;
    busy.current=true;setPending(true);setError(null);const seq=++generation.current;

    try {
      const raw=await limited(apiFetch<any>(`/api/admin/tenants/${encodeURIComponent(slug)}/config`,{tenantSlug:slug}));
      const value=readBrandSnapshot(raw?.organization_branding,slug);
      if(!live.current||seq!==generation.current)return;
      if(!value||(expectedId.current!==null&&value.tenant.id!==expectedId.current))throw new Error('invalid_brand_contract');
      expectedId.current=value.tenant.id;
      if(review){setLatest(value);}else{setSnapshot(value);setDraft(value.values);setNeedsReview(false);setLatest(null);}
    } catch(e:any){
      if(!live.current||seq!==generation.current)return;
      if([401,403].includes(e?.status)){setSnapshot(null);setDraft(null);setLatest(null);}
      setError('No pudimos verificar la marca de esta organización. Volvé a consultar antes de publicar.');
    } finally{if(live.current&&seq===generation.current){clearTimer();busy.current=false;setPending(false);}}
  },[slug]);
  const dirty=!!snapshot&&!!draft&&!sameBrandValues(snapshot.values,draft);
  // Keep the listener only while it protects an actual draft or uncertain write.
  useEffect(()=>{
    if(!snapshot||(!dirty&&!writing&&!needsReview))return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[!!snapshot,dirty,writing,needsReview]);
  const editDraft=(values:BrandValues)=>{
    if(!live.current||busy.current||!snapshot)return;
    setDraft({...values});setMessage(null);
  };
  const discardDraft=()=>{
    if(!live.current||busy.current||!snapshot||needsReview||error||latest)return;
    setDraft({...snapshot.values});setMessage(null);
  };
  const publish=async(restoreVersion?:number)=>{
    if(!live.current||busy.current||needsReview||error||latest||!snapshot?.can_edit||!draft)return;
    if(restoreVersion===undefined&&(!isBrandColor(draft.primary_color)||!isBrandColor(draft.accent_color)||sameBrandValues(snapshot.values,draft)))return;
    if(restoreVersion!==undefined&&!snapshot.history.some(entry=>entry.version===restoreVersion))return;
    busy.current=true;setPending(true);setWriting(true);setMessage(null);const seq=++generation.current;

    const values={...draft,primary_color:draft.primary_color.toUpperCase(),accent_color:draft.accent_color.toUpperCase()};
    const expectedValues=restoreVersion===undefined?values:snapshot.history.find(h=>h.version===restoreVersion)?.values;
    try{
      const raw=await limited(apiFetch<any>(snapshot.save_endpoint,{method:'PUT',tenantSlug:slug,body:{
        expected_revision:snapshot.revision,organization_branding:restoreVersion===undefined
          ?{operation:'publish',values}:{operation:'restore',version:restoreVersion}}}));
      const brand=readBrandSnapshot(raw?.brand,slug);
      if(!live.current||seq!==generation.current)return;
      if(raw?.contract_version!=='organization.branding_save.v1'||typeof raw.saved!=='boolean'||!brand
        ||raw.tenant?.id!==snapshot.tenant.id||raw.tenant?.slug!==slug||brand.tenant.id!==snapshot.tenant.id
        ||raw.provider_calls_performed!==false||!expectedValues||['enabled','primary_color','accent_color'].some(key=>brand.values[key as keyof BrandValues]!==expectedValues[key as keyof BrandValues])
        ||brand.version!==(raw.saved?snapshot.version+1:snapshot.version))throw new Error('invalid_brand_receipt');
      setSnapshot(brand);setDraft(brand.values);setLatest(null);setNeedsReview(false);
      setMessage(raw.saved?'La paleta quedó publicada y confirmada por el servidor.':'La paleta ya coincidía con la versión guardada.');
      onPublished?.(brand);
    }catch(e:any){
      if(!live.current||seq!==generation.current)return;
      if([401,403].includes(e?.status)){setSnapshot(null);setDraft(null);setLatest(null);}
      setNeedsReview(true);setError(e?.status===412?'Otra persona cambió la marca. Revisá la versión actual sin perder tu borrador.':'No pudimos confirmar la publicación. Consultá el estado antes de reintentar.');
    }finally{if(live.current&&seq===generation.current){clearTimer();busy.current=false;setPending(false);setWriting(false);}}
  };
  useEffect(()=>{
    live.current=true;void read();
    return()=>{live.current=false;++generation.current;clearTimer();busy.current=false;};
  },[read]);
  const chooseLatest=(keepDraft:boolean)=>{
    if(!latest||pending)return;
    setSnapshot(latest);if(!keepDraft)setDraft(latest.values);setLatest(null);setNeedsReview(false);setError(null);setMessage(null);
  };
  return {snapshot,draft,setDraft:editDraft,dirty,discardDraft,pending,needsReview,latest,message,error,publish,chooseLatest,
    refresh:()=>read(!!snapshot),retryInitial:()=>read(false)};
}
