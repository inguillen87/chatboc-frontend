import React from 'react';
import {Navigate,useSearchParams} from 'react-router-dom';
import {useTenant} from '@/context/TenantContext';
import {useUser} from '@/hooks/useUser';
import InstitutionalAssistant from '@/components/knowledge/InstitutionalAssistant';
import {normalizeProfileTenantSlug,readExplicitTenantRequest} from '@/utils/profileTenantAuthority';
import {hasRequiredRole} from '@/utils/roles';
import {ViewState} from '@/components/app-shell/ViewState';

/** The knowledge console shows persisted server state, never example documents. */
export const KnowledgeSourcesPage:React.FC=()=>{
  const [params]=useSearchParams();
  const {currentSlug}=useTenant();
  const {user,loading,hasVerifiedSession,organizationProfileVerified}=useUser();
  const requested=readExplicitTenantRequest(params);
  const invalidExplicit=['tenant','tenant_slug'].some(key=>{
    if(!params.has(key))return false;
    const values=params.getAll(key),raw=values[0]??'';
    return values.length!==1||normalizeProfileTenantSlug(raw)!==raw.trim().normalize('NFC').toLowerCase();
  });
  const sessionTenant=normalizeProfileTenantSlug(user?.tenant_slug||user?.tenantSlug||user?.tenant?.slug||user?.tenant?.tenant_slug);
  const isSuperadmin=hasRequiredRole(user?.rol||user?.role,['superadmin']);
  const tenantSlug=requested.present
    ? requested.valid?requested.slug:null
    : isSuperadmin?normalizeProfileTenantSlug(currentSlug)||sessionTenant:sessionTenant;
  if(loading||!hasVerifiedSession||!organizationProfileVerified||!user?.id)return null;
  if(invalidExplicit||!requested.valid||(!isSuperadmin&&tenantSlug!==sessionTenant))return <Navigate to="/403" replace state={{reason:'tenant',from:'/admin/knowledge'}}/>;
  if(!tenantSlug)return <ViewState status="empty" title="Elegí una organización desde el directorio"/>;
  return <section className="mx-auto w-full max-w-6xl py-6">
    <InstitutionalAssistant tenantSlug={tenantSlug} sessionKey={String(user.id)}/>
  </section>;
};
