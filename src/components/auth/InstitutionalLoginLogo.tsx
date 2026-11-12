import React,{useState} from 'react';
import {Building2} from 'lucide-react';
import type {PublishedTenantIdentity} from '@/utils/publishedTenantIdentity';
/** Decorative mark only. The page heading supplies the verified organization name. */
export function InstitutionalLoginLogo({identity}:{identity:PublishedTenantIdentity}) {
  return <LogoImage key={JSON.stringify([identity.tenantId,identity.logoUrl])} identity={identity}/>;
}
function LogoImage({identity}:{identity:PublishedTenantIdentity}) {
  const [failed,setFailed]=useState(false);
  return <div className="institutional-login-mark" data-testid="institutional-login-mark" data-tenant-id={identity.tenantId}>
    {identity.logoUrl&&!failed
      ? <img src={identity.logoUrl} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>
      : <Building2 aria-hidden="true" size={34}/>}
  </div>;
}
