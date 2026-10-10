import {useLocation} from 'react-router-dom';
import {useSessionAuthority} from '@/components/access/SessionAuthorityContext';
import {useTenant} from '@/context/TenantContext';
import {useUser} from '@/hooks/useUser';
import {privateWorkspacePresentation} from '@/utils/privateWorkspaceIdentity';
export function usePrivateWorkspacePresentation(){
  const location=useLocation();
  const {user,organizationProfileVerified,loading}=useUser();
  const {hasVerifiedSession}=useSessionAuthority();
  const {currentSlug}=useTenant();
  return privateWorkspacePresentation({pathname:location.pathname,search:location.search,user,
    hasVerifiedSession,profileVerified:organizationProfileVerified,loading,currentSlug});
}
