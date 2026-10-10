import React,{forwardRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Building2} from 'lucide-react';
import type {PublishedTenantIdentity} from '@/utils/publishedTenantIdentity';
export const InstitutionalAccessBrand=forwardRef<HTMLAnchorElement,{identity:PublishedTenantIdentity;homePath?:string;subtitle?:string}>(({identity,homePath,subtitle},ref)=>{
  const [failed,setFailed]=useState(false);
  return <Link ref={ref} to={homePath ?? `/t/${encodeURIComponent(identity.tenantSlug)}`} aria-label={identity.name}
    className="institutional-access-brand" data-testid="institutional-access-brand" data-tenant-id={identity.tenantId}>
    {identity.logoUrl&&!failed?<img src={identity.logoUrl} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Building2 aria-hidden="true" size={30}/>}
    <span><strong>{identity.name}</strong><small>{subtitle ?? identity.tenantSlug}</small></span>
  </Link>;
});
InstitutionalAccessBrand.displayName='InstitutionalAccessBrand';
