import React from 'react';
import {useSearchParams} from 'react-router-dom';
import {useTenant} from '@/context/TenantContext';
import {useUser} from '@/hooks/useUser';
import InstitutionalAssistant from '@/components/knowledge/InstitutionalAssistant';
import {normalizeProfileTenantSlug,readExplicitTenantRequest} from '@/utils/profileTenantAuthority';

/** The knowledge console shows persisted server state, never example documents. */
export const KnowledgeSourcesPage:React.FC=()=>{
  const [params]=useSearchParams();
  const {currentSlug}=useTenant();
  const {user,loading,hasVerifiedSession}=useUser();
  const requested=readExplicitTenantRequest(params);
  const invalidExplicit=['tenant','tenant_slug'].some(key=>{
    if(!params.has(key))return false;
    const values=params.getAll(key),raw=values[0]??'';
    return values.length!==1||normalizeProfileTenantSlug(raw)!==raw.trim().normalize('NFC').toLowerCase();
  });
  const tenantSlug=requested.present
    ? requested.valid?requested.slug:null
    : normalizeProfileTenantSlug(currentSlug)||normalizeProfileTenantSlug(user?.tenant_slug||user?.tenantSlug||user?.tenant?.slug);
  if(invalidExplicit||!tenantSlug||loading||!hasVerifiedSession||!user?.id)return null;
  return <section className="mx-auto w-full max-w-6xl py-6">
    <InstitutionalAssistant tenantSlug={tenantSlug} sessionKey={String(user.id)}/>
  </section>;
};
