import React,{forwardRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Building2} from 'lucide-react';
import type {PrivateWorkspaceIdentity} from '@/utils/privateWorkspaceIdentity';
import './privateWorkspace.css';
export const PrivateWorkspaceBrand=forwardRef<HTMLAnchorElement,{identity:PrivateWorkspaceIdentity|null}>(({identity},ref)=>{
  const [failed,setFailed]=useState(false);
  const contents=<>{identity?.logoUrl&&!failed?<img src={identity.logoUrl} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Building2 aria-hidden="true" size={30}/>}
    <span><strong>{identity?.name||'Organización'}</strong><small>Panel privado{identity?` · ${identity.tenantSlug}`:''}</small></span></>;
  return identity?<Link ref={ref} to="/perfil" className="private-workspace-brand" aria-label={`Panel de ${identity.name}`}
    data-testid="private-workspace-brand" data-tenant-slug={identity.tenantSlug}>{contents}</Link>
    :<span className="private-workspace-brand" data-testid="private-workspace-pending">{contents}</span>;
});
PrivateWorkspaceBrand.displayName='PrivateWorkspaceBrand';
export function PrivateWorkspaceFooter({identity}:{identity:PrivateWorkspaceIdentity|null}){
  return <footer className="private-workspace-footer" aria-label="Información del panel privado">
    <span>{identity?.name||'Panel de la organización'}</span>
    <nav aria-label="Información legal de la plataforma"><Link to="/privacidad">Privacidad de la plataforma</Link><Link to="/terminos">Términos de la plataforma</Link></nav>
  </footer>;
}
