import React from 'react';
import { Navigate } from 'react-router-dom';

import { ViewState } from '@/components/app-shell/ViewState';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';

const ChatCRMPage: React.FC = () => {
  const { currentSlug, isLoadingTenant } = useTenant();

  if (isLoadingTenant) {
    return (
      <main className="p-6">
        <ViewState
          status="loading"
          title="Abriendo ChatCRM"
          description="Estamos resolviendo el inbox operativo de tu organización."
        />
      </main>
    );
  }

  const tenantInbox = currentSlug ? buildTenantPath('/inbox', currentSlug) : null;
  const destination = tenantInbox && tenantInbox !== '/inbox'
    ? tenantInbox
    : '/perfil?tab=tickets';

  return <Navigate to={destination} replace />;
};

export default ChatCRMPage;
