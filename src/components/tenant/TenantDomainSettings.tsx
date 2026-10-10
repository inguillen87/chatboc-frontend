import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getTenantDomain, saveTenantDomain, tenantDomainErrorMessage, type DomainTenantScope, type TenantDomainDescriptor } from '@/api/tenantDomain';

const labels = { unconfigured:'Sin dominio propio',pending_dns:'Pendiente de verificar DNS',pending_platform:'DNS confirmado · falta publicación y HTTPS',
  active:'Dominio verificado y activo',revoked:'Dominio desvinculado',verification_expired:'Verificación vencida' };
export function TenantDomainSettings({ tenant, scopeKey }: { tenant: DomainTenantScope; scopeKey: string }) {
  const key = JSON.stringify([scopeKey,tenant.id,tenant.slug]);
  const active = useRef(key); active.current = key;
  const inFlight = useRef<string | null>(null);
  const [state,setState] = useState<{key:string;domain:TenantDomainDescriptor|null;error:string|null;busy:boolean}>({key,domain:null,error:null,busy:true});
  const [draft,setDraft] = useState(''), [confirmRevoke,setConfirmRevoke] = useState(false), [copied,setCopied] = useState(false);
  const isCurrent = (initiating:string) => active.current === initiating;
  const load = async () => {
    if(inFlight.current===key)return;
    inFlight.current=key;
    const initiating=key; setState(previous=>({...previous,key,domain:previous.key===key?previous.domain:null,error:null,busy:true}));
    try {
      const domain=await getTenantDomain(tenant,()=>isCurrent(initiating));
      if(isCurrent(initiating))setState({key,domain,error:null,busy:false});
    } catch(error){if(isCurrent(initiating))setState(previous=>({...previous,key,error:tenantDomainErrorMessage(error),busy:false}));}
    finally{if(inFlight.current===initiating)inFlight.current=null;}
  };
  useEffect(()=>{
    active.current=key;setDraft('');setConfirmRevoke(false);setCopied(false);void load();
    return()=>{if(active.current===key)active.current='';};
  },[key]);
  const current=state.key===key?state:null, domain=current?.domain, busy=!current || current.busy;
  const mutate=async(operation:'request'|'verify_dns'|'revoke')=>{
    if(!domain||busy||inFlight.current===key||!isCurrent(key)||(operation==='revoke'?!domain.can_revoke:!domain.can_edit))return;
    inFlight.current=key;
    const initiating=key;setState(previous=>({...previous,error:null,busy:true}));setCopied(false);
    try{
      const updated=await saveTenantDomain(tenant,domain,operation,operation==='request'?draft:undefined,()=>isCurrent(initiating));
      if(isCurrent(initiating)){setState({key,domain:updated,error:null,busy:false});if(operation==='request')setDraft(updated.host||'');}
    }catch(error){if(isCurrent(initiating))setState(previous=>({...previous,error:tenantDomainErrorMessage(error),busy:false}));}
    finally{if(inFlight.current===initiating)inFlight.current=null;}
  };
  const copyProof=async()=>{
    const initiating=key, proof=domain?.dns_proof;if(!proof||busy)return;
    try{await navigator.clipboard.writeText(proof.value);if(isCurrent(initiating))setCopied(true);}
    catch{if(isCurrent(initiating))setState(previous=>({...previous,error:'No pudimos copiar el valor. Podés seleccionarlo y copiarlo desde el registro TXT.'}));}
  };
  return <Card className="mt-4" aria-busy={busy}>
    <CardHeader><CardTitle>Dominio propio</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {domain?<><p role="status" className="font-semibold">{labels[domain.status]}</p>{domain.host?<p className="break-all">{domain.host}</p>:null}
        <p className="text-sm text-muted-foreground">{domain.scope_note}</p>
        {domain.active?<a className="inline-flex min-h-11 items-center underline" href={`https://${domain.host}/`}>Abrir sitio público</a>:null}
        {!domain.active?<p className="text-sm text-muted-foreground">El sitio no se habilita hasta verificar DNS, publicación y HTTPS. Este panel no realiza cambios en tu proveedor.</p>:null}
        {domain.can_edit && !domain.active && !['pending_dns','pending_platform'].includes(domain.status)?<form className="space-y-2" onSubmit={event=>{event.preventDefault();void mutate('request');}}>
          <Label htmlFor="tenant-domain-host">Dominio completo</Label>
          <Input id="tenant-domain-host" className="min-h-11" autoComplete="off" placeholder="atencion.tu-organizacion.ar" value={draft} disabled={busy} onChange={event=>setDraft(event.target.value)} />
          <p className="text-sm text-muted-foreground">Sin https://, puerto ni ruta. La propiedad se comprueba con un registro TXT.</p>
          <Button type="submit" className="min-h-11 h-auto whitespace-normal" disabled={busy||!draft.trim()}>Solicitar verificación</Button>
        </form>:null}
        {domain.dns_proof?<div className="space-y-3 rounded-lg border p-4">
          <p>Agregá este registro en el DNS del dominio:</p>
          <dl className="grid gap-2"><dt>Tipo</dt><dd>TXT</dd><dt>Nombre</dt><dd className="select-text break-all font-mono text-sm">{domain.dns_proof.name}</dd><dt>Valor</dt><dd className="select-text break-all font-mono text-sm">{domain.dns_proof.value}</dd></dl>
          <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>void copyProof()}>Copiar valor TXT</Button>
          {domain.can_edit?<Button className="min-h-11" disabled={busy} onClick={()=>void mutate('verify_dns')}>Comprobar TXT</Button>:null}</div>
          {copied?<p role="status">Valor TXT copiado.</p>:null}
        </div>:null}
        {!domain.can_edit?<p className="text-sm text-muted-foreground">La edición requiere un administrador autorizado y el plan Pro o Full.</p>:null}
      </>:<p role="status">{busy?'Consultando dominio…':'No pudimos confirmar el estado del dominio.'}</p>}
      {current?.error?<p role="alert" className="text-sm text-destructive">{current.error}</p>:null}
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>void load()}>Recargar estado</Button>
      {domain?.can_revoke?<Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>setConfirmRevoke(true)}>Desvincular dominio</Button>:null}</div>
      <AlertDialog open={confirmRevoke&&Boolean(domain)&&isCurrent(key)} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desvincular {domain?.host}</AlertDialogTitle>
          <AlertDialogDescription>Este dominio dejará de abrir la organización. No elimina datos ni modifica DNS en tu proveedor.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={()=>void mutate('revoke')}>Confirmar desvinculación</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  </Card>;
}
